#pip install langchain langchain-core langchain-community langgraph langchain-google-genai tavily-python fastapi uvicorn python-dotenv starlette sqlalchemy

from typing import TypedDict, Annotated, Optional
from langgraph.graph import add_messages, StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessageChunk, ToolMessage
from dotenv import load_dotenv
from langchain_community.tools.tavily_search import TavilySearchResults
from fastapi import FastAPI, Query, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
from uuid import uuid4
from langgraph.checkpoint.memory import MemorySaver
from datetime import datetime
from sqlalchemy.orm import Session

# Local imports
from database import SessionLocal
from models import Conversation

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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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

# ---------------- SSE Chat Generator ----------------
async def generate_chat_responses(message: str, checkpoint_id: Optional[str], db: Session):
    is_new_conversation = checkpoint_id is None

    if is_new_conversation:
        new_thread_id = str(uuid4())

        # ✅ Save new conversation in DB
        conv = Conversation(
            threadId=new_thread_id,
            title="Untitled Chat",
            createdAt=datetime.utcnow()
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

        config = {"configurable": {"thread_id": new_thread_id}}

        events = graph.astream_events(
            {"messages": [HumanMessage(content=message)]},
            version="v2",
            config=config,
        )

        # Send checkpoint ID to frontend
        yield f"data: {{\"type\": \"checkpoint\", \"checkpoint_id\": \"{new_thread_id}\"}}\n\n"
    else:
        config = {"configurable": {"thread_id": checkpoint_id}}
        events = graph.astream_events(
            {"messages": [HumanMessage(content=message)]},
            version="v2",
            config=config,
        )

    async for event in events:
        event_type = event["event"]

        if event_type == "on_chat_model_stream":
            chunk_content = serialise_ai_message_chunk(event["data"]["chunk"])
            payload = {"type": "content", "content": chunk_content}
            yield f"data: {json.dumps(payload)}\n\n"

        elif event_type == "on_chat_model_end":
            tool_calls = getattr(event["data"]["output"], "tool_calls", [])
            search_calls = [
                call for call in tool_calls if call["name"] == "tavily_search_results_json"
            ]
            if search_calls:
                search_query = search_calls[0]["args"].get("query", "")
                safe_query = search_query.replace('"', '\\"').replace("'", "\\'").replace("\n", "\\n")
                yield f"data: {{\"type\": \"search_start\", \"query\": \"{safe_query}\"}}\n\n"

        elif event_type == "on_tool_end" and event["name"] == "tavily_search_results_json":
            output = event["data"]["output"]
            if isinstance(output, list):
                urls = [item["url"] for item in output if isinstance(item, dict) and "url" in item]
                urls_json = json.dumps(urls)
                yield f"data: {{\"type\": \"search_results\", \"urls\": {urls_json}}}\n\n"

    yield f"data: {{\"type\": \"end\"}}\n\n"

# ---------------- API Routes ----------------
@app.get("/chat_stream/{message}")
async def chat_stream(message: str, checkpoint_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return StreamingResponse(
        generate_chat_responses(message, checkpoint_id, db),
        media_type="text/event-stream",
    )

@app.get("/conversations")
def get_conversations(db: Session = Depends(get_db)):
    return db.query(Conversation).all()

@app.post("/conversations/{thread_id}")
def save_conversation(thread_id: str, title: str = "Untitled Chat", db: Session = Depends(get_db)):
    conv = Conversation(threadId=thread_id, title=title, createdAt=datetime.utcnow())
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv
