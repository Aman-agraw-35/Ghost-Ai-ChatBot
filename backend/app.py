from typing import TypedDict, Annotated, Optional
from langgraph.graph import add_messages, StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from langchain_community.tools.tavily_search import TavilySearchResults
from langgraph.checkpoint.memory import MemorySaver
from uuid import uuid4
import json

load_dotenv()

# Initialize model
model = ChatGoogleGenerativeAI(model="gemini-2.5-flash")

# Send a query
response = model.invoke("Tell me a joke.")

# Print just the text response
print(response.content)