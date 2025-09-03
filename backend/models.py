# models.py
from sqlalchemy import Column, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()

class Conversation(Base):
    __tablename__ = "conversations"

    threadId = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, default="Untitled Chat")
    createdAt = Column(DateTime, default=datetime.utcnow)
