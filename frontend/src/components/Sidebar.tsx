"use client";

import React, { useState, useMemo } from "react";
import {
  MessageSquare,
  Clock,
  Menu,
  Trash,
  Plus,
  Search,
  XCircle,
  X
} from "lucide-react";

interface Conversation {
  threadId: string;
  title: string;
  createdAt: string;
}

interface SidebarProps {
  conversations: Conversation[];
  onSelectThread: (threadId: string) => void;
  activeThreadId: string | null;
  /**
   * Parent handler to create a new conversation.
   * If called with a Conversation argument, the parent should add it to state.
   * If called with no args, the parent should create the conversation itself (e.g. via SSE).
   */
  onNewConversation: (newConv?: Conversation) => void;
  /**
   * Setter from parent to update conversations immediately on delete/create.
   * Pass `setConversations` from Home so Sidebar can update UI without refresh.
   */
  setConversations?: React.Dispatch<React.SetStateAction<Conversation[]>>;
}

const API_BASE = "https://ghost-ai-chatbot.onrender.com";

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  onSelectThread,
  activeThreadId,
  onNewConversation,
  setConversations,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  /**
   * Create new conversation:
   * - Prefer delegating creation to parent by calling onNewConversation() with no args.
   * - If you prefer to call backend POST directly from Sidebar, you can implement here,
   *   but we delegate to avoid the "Failed to create conversation" when POST is missing.
   */
  const handleNewConversation = async () => {
    // Delegate to parent (Home) so it can create via SSE and return the created conv.
    onNewConversation();
    setIsOpen(false);
  };

  /**
   * Delete conversation
   * - Optimistic removal: remove from UI immediately using setConversations (if provided)
   * - Call backend DELETE /conversations/{threadId}
   * - Revert if delete fails
   */
  const handleDeleteConversation = async (
    e: React.MouseEvent,
    threadId: string
  ) => {
    e.stopPropagation();

    // Guard: if no setter passed, fallback to delegating to parent to refresh data.
    if (!setConversations) {
      // best-effort: call backend and then ask parent to reload by calling onNewConversation(undefined)
      // (Parent should implement a refresh when onNewConversation called with no args OR you can modify parent).
      try {
        const res = await fetch(
          `${API_BASE}/conversations/${encodeURIComponent(threadId)}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Delete failed");
        // ask parent to re-fetch (we use onNewConversation() as a signal; adapt if your Home has a dedicated refresh)
        onNewConversation();
      } catch (err) {
        console.error("Delete failed and no setter provided:", err);
      }
      return;
    }

    // Optimistic update using setter
    const prev = conversations;
    setConversations(prevList => prevList.filter(c => c.threadId !== threadId));

    // If deleted conversation was active -> clear selection
    if (activeThreadId === threadId) {
      onSelectThread("");
    }

    try {
      const res = await fetch(
        `${API_BASE}/conversations/${encodeURIComponent(threadId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw new Error(`Delete failed: ${res.status}`);
      }
      // success, UI already updated
    } catch (err) {
      // revert to previous state
      console.error("Error deleting conversation:", err);
      setConversations(prev);
    }
  };

  // filter conversations by title
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    return conversations.filter(c =>
      (c.title || "Untitled Chat")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, conversations]);

  return (
    <>
      {/* Mobile Toggle */}
      <button
        aria-label="Toggle conversations sidebar"
        onClick={() => setIsOpen(!isOpen)}
        className="top-4 md:ml-[35%] ml-[25%] mt-2 cursor-pointer z-50 p-2 bg-white/70 backdrop-blur-md shadow-md lg:hidden"
      >
        {isOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
      </button>

      {/* Sidebar */}
      <div
        className={`
          fixed left-0 h-[90vh] rounded-r-2xl
          transform transition-transform duration-300 ease-in-out
          bg-white/70 backdrop-blur-xl border border-gray-200 shadow-xl
          flex flex-col z-40
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          w-72 xl:w-[20%] lg:w-[25%] top-6
        `}
      >
        {/* Header */}
        <div className="px-5 py-5 flex justify-between rounded-tr-2xl items-center border-b border-gray-200 bg-gradient-to-r from-green-400 to-green-300">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            Conversations
          </h2>

          <button
            onClick={handleNewConversation}
            className="p-2 ml-1 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white shadow-md"
            aria-label="Start new conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-9 py-2 rounded-md border text-gray-600 placeholder:text-gray-400 border-gray-200 bg-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto custom-scroll">
          {filteredConversations.length === 0 ? (
            <div className="text-center text-gray-500 py-10">No conversations found</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredConversations.map(conv => (
                <li
                  key={conv.threadId}
                  className={`px-3 py-2 flex items-center justify-between rounded-md mx-2 my-1 transition duration-200
                    ${activeThreadId === conv.threadId ? "bg-indigo-100 border border-indigo-300 shadow-sm" : "hover:bg-indigo-50"}`}
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      onSelectThread(conv.threadId);
                      setIsOpen(false);
                    }}
                  >
                    <span className="font-medium text-gray-800 truncate block">{conv.title || "Untitled Chat"}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {new Date(conv.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleDeleteConversation(e, conv.threadId)}
                    title="Delete conversation"
                    className="ml-3 p-1 text-red-500 hover:text-red-700"
                    aria-label={`Delete conversation ${conv.title}`}
                  >
                    <Trash className="w-3 h-4 cursor-pointer" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden" />}
    </>
  );
};

export default Sidebar;
