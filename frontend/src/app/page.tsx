"use client";

import Header from "@/components/Header";
import InputBar from "@/components/InputBar";
import MessageArea from "@/components/MessageArea";
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

interface SearchInfo {
  stages: string[];
  query: string;
  urls: string[];
}

interface Message {
  id: number;
  content: string;
  isUser: boolean;
  type: string;
  isLoading?: boolean;
  searchInfo?: SearchInfo;
}

interface Conversation {
  threadId: string;
  title: string;
  createdAt: string;
}

const Home = () => {
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messagesByThread, setMessagesByThread] = useState<
    Record<string, Message[]>
  >({});
  const [currentMessage, setCurrentMessage] = useState("");

  const currentMessages = activeThreadId
    ? messagesByThread[activeThreadId] || []
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || !activeThreadId) return;

    const threadMessages = messagesByThread[activeThreadId] || [];
    const newMessageId =
      threadMessages.length > 0
        ? Math.max(...threadMessages.map((msg) => msg.id)) + 1
        : 1;

    const userMessage: Message = {
      id: newMessageId,
      content: currentMessage,
      isUser: true,
      type: "message",
    };

    setMessagesByThread((prev) => ({
      ...prev,
      [activeThreadId]: [...(prev[activeThreadId] || []), userMessage],
    }));

    const userInput = currentMessage;
    setCurrentMessage("");

    try {
      const aiResponseId = newMessageId + 1;

      // Add placeholder bot message


      setMessagesByThread((prev) => ({
        ...prev,
        [activeThreadId]: [
          ...(prev[activeThreadId] || []),
          {
            id: aiResponseId,
            content: "",
            isUser: false,
            type: "message",
            isLoading: true,
            searchInfo: { stages: [], query: "", urls: [] },
          },
        ],
      }));

      let url = `http://127.0.0.1:8000/chat_stream/${encodeURIComponent(
        userInput
      )}`;
      if (checkpointId)
        url += `?checkpoint_id=${encodeURIComponent(checkpointId)}`;

      const eventSource = new EventSource(url);
      let streamedContent = "";
      let searchData: any = null;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          setMessagesByThread((prev) => {
            const updated = [...(prev[activeThreadId] || [])];
            const idx = updated.findIndex((msg) => msg.id === aiResponseId);

            if (idx !== -1) {
              if (data.type === "checkpoint") {
                setCheckpointId(data.checkpoint_id);
              } else if (data.type === "content") {
                streamedContent += data.content;
                updated[idx] = {
                  ...updated[idx],
                  content: streamedContent,
                  isLoading: false,
                };
              } else if (data.type === "search_start") {
                searchData = { stages: ["searching"], query: data.query, urls: [] };
                updated[idx] = {
                  ...updated[idx],
                  content: streamedContent,
                  searchInfo: searchData,
                  isLoading: false,
                };
              } else if (data.type === "search_results") {
                const urls =
                  typeof data.urls === "string" ? JSON.parse(data.urls) : data.urls;
                searchData = {
                  stages: [...(searchData?.stages || []), "reading"],
                  query: searchData?.query || "",
                  urls,
                };
                updated[idx] = {
                  ...updated[idx],
                  content: streamedContent,
                  searchInfo: searchData,
                  isLoading: false,
                };
              } else if (data.type === "search_error") {
                searchData = {
                  stages: [...(searchData?.stages || []), "error"],
                  query: searchData?.query || "",
                  error: data.error,
                  urls: [],
                };
                updated[idx] = {
                  ...updated[idx],
                  content: streamedContent,
                  searchInfo: searchData,
                  isLoading: false,
                };
              } else if (data.type === "end") {
                if (searchData) {
                  updated[idx] = {
                    ...updated[idx],
                    searchInfo: {
                      ...searchData,
                      stages: [...searchData.stages, "writing"],
                    },
                    isLoading: false,
                  };
                }
                eventSource.close();
              }
            }

            return { ...prev, [activeThreadId]: updated };
          });
        } catch (error) {
          console.error("Error parsing event data:", error, event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        eventSource.close();
      };
    } catch (error) {
      console.error("Error setting up EventSource:", error);
    }
  };

  useEffect(() => {
    fetch("http://127.0.0.1:8000/conversations")
      .then((res) => res.json())
      .then((data) => {
        setConversations(data);
        if (data.length > 0) {
          setActiveThreadId(data[0].threadId);
          setMessagesByThread((prev) => ({
            ...prev,
            [data[0].threadId]: [
              {
                id: 1,
                content: "Hi there, how can I help you?",
                isUser: false,
                type: "message",
              },
            ],
          }));
        }
      })
      .catch((err) => console.error("Error fetching conversations:", err));
  }, []);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#F8F7FB] to-[#ECEAF5]">
      {/* Sidebar */}
      <div className="w-[20%] h-[90vh] rounded-r-2xl border-r my-6 border-gray-200 bg-white/70 shadow-md">
        <Sidebar
          conversations={conversations}
          activeThreadId={activeThreadId}
          onSelectThread={(threadId) => setActiveThreadId(threadId)}
          onNewConversation={(newConv) => {
            setConversations((prev) => [...prev, newConv]);
            setActiveThreadId(newConv.threadId);
            setMessagesByThread((prev) => ({
              ...prev,
              [newConv.threadId]: [
                {
                  id: 1,
                  content: "Hi there, how can I help you?",
                  isUser: false,
                  type: "message",
                },
              ],
            }));
          }}
        />
      </div>

      {/* Chat Window */}
      <div className="w-[80%] flex flex-col h-[90vh] m-6 rounded-2xl bg-white/80 backdrop-blur-md border border-gray-200/70 shadow-xl overflow-hidden">
        <Header />
        <MessageArea messages={currentMessages} />
        <InputBar
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
};

export default Home;
