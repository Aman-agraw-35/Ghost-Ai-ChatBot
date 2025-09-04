# models.py
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import Column, String, DateTime, Integer, Boolean, ForeignKey, Text
from datetime import datetime

Base = declarative_base()

class Conversation(Base):
    __tablename__ = "conversations"

    threadId = Column(String, primary_key=True, index=True)
    title = Column(String, default="Untitled Chat")
    createdAt = Column(DateTime, default=datetime.utcnow)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    threadId = Column(String, ForeignKey("conversations.threadId"), index=True, nullable=False)
    content = Column(Text, nullable=True)
    is_user = Column(Boolean, default=False)
    createdAt = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
