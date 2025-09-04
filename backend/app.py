# main.py
# pip install langchain langchain-core langchain-community langgraph langchain-google-genai tavily-python fastapi uvicorn python-dotenv starlette sqlalchemy

from typing import TypedDict, Annotated, Optional
from langgraph.graph import add_messages, StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessageChunk, ToolMessage
from dotenv import load_dotenv
from langchain_community.tools.tavily_search import TavilySearchResults
from fastapi import FastAPI, Query, Depends, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import json
from fastapi import status
from uuid import uuid4
from langgraph.checkpoint.memory import MemorySaver
from datetime import datetime
from sqlalchemy.orm import Session
import re  # <-- new
import asyncio  # <-- added for running blocking llm.invoke without blocking the event loop

# Local imports
from database import SessionLocal
from models import Conversation, Message, Base

load_dotenv()

# ---------------- LangGraph Setup ----------------
memory = MemorySaver()

class State(TypedDict):
    messages: Annotated[list, add_messages]

search_tool = TavilySearchResults(max_results=4)
tools = [search_tool]

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")
llm_with_tools = llm.bind_tools(tools=tools)

async def model(state: State):
    result = await llm_with_tools.ainvoke(state["messages"])
    return {"messages": [result]}

async def tools_router(state: State):
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and len(last_message.tool_calls) > 0:
        return "tool_node"
    return END

async def tool_node(state):
    tool_calls = state["messages"][-1].tool_calls
    tool_messages = []
    for tool_call in tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        tool_id = tool_call["id"]

        if tool_name == "tavily_search_results_json":
            search_results = await search_tool.ainvoke(tool_args)
            tool_message = ToolMessage(
                content=str(search_results),
                tool_call_id=tool_id,
                name=tool_name,
            )
            tool_messages.append(tool_message)
    return {"messages": tool_messages}

graph_builder = StateGraph(State)
graph_builder.add_node("model", model)
graph_builder.add_node("tool_node", tool_node)
graph_builder.set_entry_point("model")
graph_builder.add_conditional_edges("model", tools_router)
graph_builder.add_edge("tool_node", "model")
graph = graph_builder.compile(checkpointer=memory)

# ---------------- FastAPI Setup ----------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Type"],
)

# ---------------- Helper Functions ----------------
def serialise_ai_message_chunk(chunk):
    if isinstance(chunk, AIMessageChunk):
        return chunk.content
    raise TypeError(
        f"Object of type {type(chunk).__name__} is not correctly formatted for serialisation"
    )

def extract_text(obj) -> str:
    """
    Safely extract text from various possible LLM outputs.
    """
    if obj is None:
        return ""
    if isinstance(obj, str):
        return obj
    # try common fields
    if hasattr(obj, "content"):
        return getattr(obj, "content") or ""
    if hasattr(obj, "text"):
        return getattr(obj, "text") or ""
    # fallback to str()
    return str(obj)


def sanitize_title(raw: str, max_words: int = 3) -> str:
    """Return first `max_words` alphanumeric words from raw string; fallback to 'New Chat'."""
    if not raw:
        return "New Chat"
    # remove surrounding quotes/punctuation and collapse whitespace
    raw = raw.strip().strip('"').strip("'")
    # extract words (letters/numbers)
    words = re.findall(r"[A-Za-z0-9]+", raw)
    if not words:
        return "New Chat"
    title = " ".join(words[:max_words])
    return title


async def maybe_update_title(thread_id: str):
    """
    Update the Conversation.title using llm.invoke for the first 3 user messages.
    Uses llm.invoke (run in a thread to avoid blocking the event loop).
    """
    session = SessionLocal()
    try:
        # count how many user messages exist for this thread
        user_msg_count = (
            session.query(Message).filter(Message.threadId == thread_id, Message.is_user == True).count()
        )

        # only update for the first 3 user messages
        if user_msg_count == 0 or user_msg_count > 3:
            return

        # fetch all user messages for context (ordered by id)
        msgs = (
            session.query(Message)
            .filter(Message.threadId == thread_id, Message.is_user == True)
            .order_by(Message.id)
            .all()
        )
        combined = "\n\n".join([m.content for m in msgs if m.content])

        title_prompt = (
            "Create a concise 2-3 word title (no punctuation if possible) that summarizes "
            "this conversation's topic based on the user's messages so far. Return only the title.\n\n"
            f"User messages so far:\n{combined}\n\nTitle:"
        )

        try:
            title_resp = await asyncio.to_thread(llm.invoke, [HumanMessage(content=title_prompt)])
            raw_title = extract_text(title_resp).strip()
            new_title = sanitize_title(raw_title, max_words=3)

            if new_title and new_title != "New Chat":
                conv = session.query(Conversation).filter(Conversation.threadId == thread_id).first()
                if conv:
                    conv.title = new_title
                    session.commit()
        except Exception as e:
            # if title generation fails, keep existing title and continue
            print("Title generation (invoke) failed:", e)
    finally:
        session.close()

# ---------------- SSE Chat Generator ----------------
async def generate_chat_responses(message: str, checkpoint_id: Optional[str]):
    """
    Creates conversation if checkpoint_id is None, persist user message,
    then stream LLM replies. Messages (user + assistant) are persisted.
    Also generates a short 2-3 word title for new conversations using the LLM.
    """
    is_new_conversation = checkpoint_id is None

    # create a DB session for conversation/message creation
    if is_new_conversation:
        thread_id = str(uuid4())
        # initially create the conversation with a placeholder title "New Chat"
        session = SessionLocal()
        try:
            existing = session.query(Conversation).filter(Conversation.threadId == thread_id).first()
            if not existing:
                conv = Conversation(threadId=thread_id, title="New Chat", createdAt=datetime.utcnow())
                session.add(conv)
                session.commit()
                session.refresh(conv)
        finally:
            session.close()

        # persist user's initial message
        session = SessionLocal()
        try:
            user_msg = Message(threadId=thread_id, content=message, is_user=True, createdAt=datetime.utcnow())
            session.add(user_msg)
            session.commit()
            session.refresh(user_msg)
        finally:
            session.close()

        # Generate/update a short title for this new conversation using llm.invoke
        try:
            await maybe_update_title(thread_id)
        except Exception as e:
            print("Initial title generation failed:", e)

        # create empty assistant message placeholder (we'll update it as chunks arrive)
        session = SessionLocal()
        try:
            ai_msg = Message(threadId=thread_id, content="", is_user=False, createdAt=datetime.utcnow())
            session.add(ai_msg)
            session.commit()
            session.refresh(ai_msg)
            ai_msg_id = ai_msg.id
        finally:
            session.close()

        config = {"configurable": {"thread_id": thread_id}}

        events = graph.astream_events(
            {"messages": [HumanMessage(content=message)]},
            version="v2",
            config=config,
        )

        # send checkpoint id (thread id) to frontend
        yield f"data: {json.dumps({'type': 'checkpoint', 'checkpoint_id': thread_id})}\n\n"
    else:
        thread_id = checkpoint_id

        # persist the user's message to DB
        session = SessionLocal()
        try:
            user_msg = Message(threadId=thread_id, content=message, is_user=True, createdAt=datetime.utcnow())
            session.add(user_msg)
            session.commit()
            session.refresh(user_msg)
        finally:
            session.close()

        # Update title for the first 3 user messages using llm.invoke
        try:
            await maybe_update_title(thread_id)
        except Exception as e:
            print("Title update failed:", e)

        # create assistant placeholder row
        session = SessionLocal()
        try:
            ai_msg = Message(threadId=thread_id, content="", is_user=False, createdAt=datetime.utcnow())
            session.add(ai_msg)
            session.commit()
            session.refresh(ai_msg)
            ai_msg_id = ai_msg.id
        finally:
            session.close()

        config = {"configurable": {"thread_id": thread_id}}

        events = graph.astream_events(
            {"messages": [HumanMessage(content=message)]},
            version="v2",
            config=config,
        )

    # stream LLM events and persist assistant message by appending chunks
    async for event in events:
        event_type = event["event"]

        if event_type == "on_chat_model_stream":
            chunk_content = serialise_ai_message_chunk(event["data"]["chunk"])

            # Update assistant message row by appending chunk
            session = SessionLocal()
            try:
                ai_row = session.get(Message, ai_msg_id)
                if ai_row is None:
                    # safety fallback: recreate
                    ai_row = Message(threadId=thread_id, content=chunk_content, is_user=False, createdAt=datetime.utcnow())
                    session.add(ai_row)
                else:
                    ai_row.content = (ai_row.content or "") + chunk_content
                session.commit()
            finally:
                session.close()

            payload = {"type": "content", "content": chunk_content}
            yield f"data: {json.dumps(payload)}\n\n"

        elif event_type == "on_chat_model_end":
            tool_calls = getattr(event["data"]["output"], "tool_calls", [])
            search_calls = [call for call in tool_calls if call["name"] == "tavily_search_results_json"]
            if search_calls:
                search_query = search_calls[0]["args"].get("query", "")
                safe_query = search_query.replace('"', '\\"').replace("'", "\\'").replace("\n", "\\n")
                yield f"data: {json.dumps({'type':'search_start', 'query': safe_query})}\n\n"

        elif event_type == "on_tool_end" and event["name"] == "tavily_search_results_json":
            output = event["data"]["output"]
            if isinstance(output, list):
                urls = [item["url"] for item in output if isinstance(item, dict) and "url" in item]
                yield f"data: {json.dumps({'type':'search_results', 'urls': urls})}\n\n"

    # final 'end' event
    yield f"data: {json.dumps({'type': 'end'})}\n\n"

# ---------------- API Routes ----------------
@app.get("/chat_stream/{message}")
async def chat_stream(message: str, checkpoint_id: Optional[str] = Query(None)):
    """
    SSE endpoint used by frontend.
    If checkpoint_id is not provided, a new conversation is created and its thread id
    is returned in the 'checkpoint' SSE event.
    """
    return StreamingResponse(
        generate_chat_responses(message, checkpoint_id),
        media_type="text/event-stream",
    )

@app.get("/conversations")
def get_conversations():
    session = SessionLocal()
    try:
        rows = session.query(Conversation).order_by(Conversation.createdAt.desc()).all()
        out = []
        for c in rows:
            out.append({
                "threadId": c.threadId,
                # show DB title (we set "New Chat" initially, then overwrite when LLM responds)
                "title": c.title,
                "createdAt": c.createdAt.isoformat() if c.createdAt else None,
            })
        return out
    finally:
        session.close()

@app.get("/messages/{thread_id}")
def get_messages(thread_id: str):
    session = SessionLocal()
    try:
        msgs = session.query(Message).filter(Message.threadId == thread_id).order_by(Message.id).all()
        out = []
        for m in msgs:
            out.append({
                "id": m.id,
                "threadId": m.threadId,
                "content": m.content,
                "isUser": bool(m.is_user),
                "createdAt": m.createdAt.isoformat() if m.createdAt else None,
            })
        return out
    finally:
        session.close()

@app.put("/conversations/{thread_id}")
def update_conversation(thread_id: str, title: str):
    session = SessionLocal()
    try:
        conv = session.query(Conversation).filter(Conversation.threadId == thread_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conv.title = title
        session.commit()
        session.refresh(conv)
        return {
            "threadId": conv.threadId,
            "title": conv.title,
            "createdAt": conv.createdAt.isoformat() if conv.createdAt else None,
        }
    finally:
        session.close()

@app.delete("/conversations/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(thread_id: str):
    session = SessionLocal()
    try:
        conv = session.query(Conversation).filter(Conversation.threadId == thread_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")

        # Delete all related messages first
        session.query(Message).filter(Message.threadId == thread_id).delete()

        # Delete the conversation itself
        session.delete(conv)
        session.commit()
        return JSONResponse(content={"detail": "Conversation deleted successfully"}, status_code=200)
    finally:
        session.close()