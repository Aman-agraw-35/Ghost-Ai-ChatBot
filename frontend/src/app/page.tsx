"use client";

import Header from "@/components/Header";
import InputBar from "@/components/InputBar";
import MessageArea from "@/components/MessageArea";
import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

interface SearchInfo {
  stages: string[];
  query?: string;
  urls?: string[];
  error?: string;
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

const API_BASE = "http://127.0.0.1:8000";

const Home = () => {
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messagesByThread, setMessagesByThread] = useState<Record<string, Message[]>>({});
  const [currentMessage, setCurrentMessage] = useState("");

  const currentMessages = activeThreadId ? messagesByThread[activeThreadId] || [] : [];

  // fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  }, []);

  // fetch messages for a thread
  const fetchMessagesForThread = useCallback(async (threadId: string) => {
    try {
      const res = await fetch(`${API_BASE}/messages/${encodeURIComponent(threadId)}`);
      if (!res.ok) throw new Error("Failed to fetch messages for thread");
      const data = await res.json();
      const mapped: Message[] = data.map((m: any) => ({
        id: m.id,
        content: m.content ?? "",
        isUser: !!m.isUser,
        type: "message",
      }));
      setMessagesByThread(prev => ({ ...prev, [threadId]: mapped }));
    } catch (err) {
      console.error("Error fetching messages for thread:", err);
      setMessagesByThread(prev => ({
        ...prev,
        [threadId]: prev[threadId] ?? [
          { id: 1, content: "Hi there, how can I help you?", isUser: false, type: "message" },
        ],
      }));
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchConversations();
    })();
  }, [fetchConversations]);

  useEffect(() => {
    if (!activeThreadId && conversations.length > 0) {
      const first = conversations[0].threadId;
      setActiveThreadId(first);
      setCheckpointId(first);
      fetchMessagesForThread(first);
    }
  }, [conversations, activeThreadId, fetchMessagesForThread]);

  const handleSelectThread = async (threadId: string) => {
    setActiveThreadId(threadId);
    setCheckpointId(threadId);
    await fetchMessagesForThread(threadId);
  };

  // helper to update assistant placeholder (content/searchInfo) for a given thread and ai id
  function updateAssistantMessage(threadId: string, aiId: number, patch: Partial<Message>) {
    setMessagesByThread(prev => {
      const updated = [...(prev[threadId] || [])];
      const idx = updated.findIndex(m => m.id === aiId && !m.isUser);
      if (idx !== -1) {
        updated[idx] = { ...updated[idx], ...patch };
      } else {
        // append as fallback
        updated.push({ id: aiId, content: patch.content ?? "", isUser: false, type: "message", ...patch });
      }
      return { ...prev, [threadId]: updated };
    });
  }

  // Create new conversation via SSE so backend emits checkpoint immediately
  const createNewConversation = async (initialMessage = "New conversation") => {
    const url = `${API_BASE}/chat_stream/${encodeURIComponent(initialMessage)}`;
    const es = new EventSource(url);

    let threadId: string | null = null;
    const aiResponseId = 2; // local IDs for UI placeholders
    let searchData: SearchInfo | null = null;
    let streamedContent = "";

    es.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "checkpoint") {
          threadId = data.checkpoint_id;
          setCheckpointId(threadId);
          setActiveThreadId(threadId);

          // refresh conversations so new row appears
          await fetchConversations();

          // initialize messages: user + assistant placeholder
          const initialUserMsg: Message = { id: 1, content: initialMessage, isUser: true, type: "message" };
          const assistantPlaceholder: Message = { id: aiResponseId, content: "", isUser: false, type: "message", isLoading: true };
          setMessagesByThread(prev => ({ ...prev, [threadId!]: [initialUserMsg, assistantPlaceholder] }));
        } else if (data.type === "content") {
          if (!threadId) return; // wait for checkpoint
          const chunk = data.content;
          streamedContent += chunk;
          updateAssistantMessage(threadId, aiResponseId, { content: streamedContent, isLoading: false, searchInfo: searchData || undefined });
        } else if (data.type === "search_start") {
          // Mark searching stage
          searchData = { stages: ["searching"], query: data.query, urls: [] };
          if (threadId) updateAssistantMessage(threadId, aiResponseId, { searchInfo: searchData, isLoading: false });
        } else if (data.type === "search_results") {
          // data.urls expected as array
          const urls: string[] = Array.isArray(data.urls) ? data.urls : (typeof data.urls === "string" ? JSON.parse(data.urls) : []);
          searchData = { stages: [...(searchData?.stages || []), "reading"], query: searchData?.query || "", urls };
          if (threadId) updateAssistantMessage(threadId, aiResponseId, { searchInfo: searchData, isLoading: false });
        } else if (data.type === "search_error") {
          searchData = { stages: [...(searchData?.stages || []), "error"], query: searchData?.query || "", error: data.error, urls: [] };
          if (threadId) updateAssistantMessage(threadId, aiResponseId, { searchInfo: searchData, isLoading: false });
        } else if (data.type === "end") {
          if (threadId && searchData) {
            searchData = { ...searchData, stages: [...(searchData.stages || []), "writing"] };
            updateAssistantMessage(threadId, aiResponseId, { searchInfo: searchData, isLoading: false });
          }
          es.close();
          // optional: resync persisted assistant content
          if (threadId) await fetchMessagesForThread(threadId);
        }
      } catch (err) {
        console.error("Error parsing SSE message (create):", err, event.data);
      }
    };

    es.onerror = (err) => {
      console.error("EventSource (create conv) error:", err);
      es.close();
    };
  };

  // Submit message in existing active conversation (SSE)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || !activeThreadId) return;
    const threadId = activeThreadId;

    const threadMessages = messagesByThread[threadId] || [];
    const newMessageId = threadMessages.length > 0 ? Math.max(...threadMessages.map(m => m.id)) + 1 : 1;

    const userMsg: Message = { id: newMessageId, content: currentMessage, isUser: true, type: "message" };
    setMessagesByThread(prev => ({ ...prev, [threadId]: [...(prev[threadId] || []), userMsg] }));

    const aiResponseId = newMessageId + 1;
    setMessagesByThread(prev => ({ ...prev, [threadId]: [...(prev[threadId] || []), { id: aiResponseId, content: "", isUser: false, type: "message", isLoading: true }] }));

    const userInput = currentMessage;
    setCurrentMessage("");

    try {
      let url = `${API_BASE}/chat_stream/${encodeURIComponent(userInput)}`;
      // ensure we include checkpoint id so backend uses correct thread
      const cp = checkpointId || threadId;
      url += `?checkpoint_id=${encodeURIComponent(cp)}`;

      const eventSource = new EventSource(url);
      let streamedContent = "";
      let searchData: SearchInfo | null = null;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "checkpoint") {
            setCheckpointId(data.checkpoint_id);
          } else if (data.type === "content") {
            streamedContent += data.content;
            updateAssistantMessage(threadId, aiResponseId, { content: streamedContent, isLoading: false, searchInfo: searchData || undefined });
          } else if (data.type === "search_start") {
            searchData = { stages: ["searching"], query: data.query, urls: [] };
            updateAssistantMessage(threadId, aiResponseId, { searchInfo: searchData, isLoading: false });
          } else if (data.type === "search_results") {
            const urls: string[] = Array.isArray(data.urls) ? data.urls : (typeof data.urls === "string" ? JSON.parse(data.urls) : []);
            searchData = { stages: [...(searchData?.stages || []), "reading"], query: searchData?.query || "", urls };
            updateAssistantMessage(threadId, aiResponseId, { searchInfo: searchData, isLoading: false });
          } else if (data.type === "search_error") {
            searchData = { stages: [...(searchData?.stages || []), "error"], query: searchData?.query || "", error: data.error, urls: [] };
            updateAssistantMessage(threadId, aiResponseId, { searchInfo: searchData, isLoading: false });
          } else if (data.type === "end") {
            if (searchData) {
              const final: SearchInfo = { ...searchData, stages: [...(searchData.stages || []), "writing"] };
              updateAssistantMessage(threadId, aiResponseId, { searchInfo: final, isLoading: false });
            }
            eventSource.close();
            fetchMessagesForThread(threadId); // sync persisted messages
          }
        } catch (err) {
          console.error("Error handling SSE event (submit):", err, event.data);
        }
      };

      eventSource.onerror = (err) => {
        console.error("EventSource error (submit):", err);
        eventSource.close();
      };
    } catch (err) {
      console.error("Error setting up EventSource:", err);
    }
  };

  // Sidebar new conversation: either provided conv object or create via SSE
  const handleSidebarNewConversation = async (maybeConv?: Conversation) => {
    if (maybeConv && maybeConv.threadId) {
      setConversations(prev => [maybeConv, ...prev]);
      setActiveThreadId(maybeConv.threadId);
      setCheckpointId(maybeConv.threadId);
      await fetchMessagesForThread(maybeConv.threadId);
      return;
    }
    await createNewConversation("Hello");
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#F8F7FB] to-[#ECEAF5]">
      {/* Sidebar */}
      <div className="xl:w-[20%] lg:w-[25%] w-[15%] h-[90vh] rounded-r-2xl border-r my-6 border-gray-200 bg-white/70 shadow-md">
        <Sidebar
          conversations={conversations}
          activeThreadId={activeThreadId}
          onSelectThread={(threadId) => handleSelectThread(threadId)}
          onNewConversation={(conv?: Conversation) => handleSidebarNewConversation(conv)}
        />
      </div>

      {/* Chat Window */}
      <div className="xl:w-[80%] lg:w-[75%] w-[90%]  flex flex-col h-[90vh] m-6 rounded-2xl bg-white/80 backdrop-blur-md border border-gray-200/70 shadow-xl overflow-hidden">
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
