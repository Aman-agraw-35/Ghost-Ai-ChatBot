"use client";

import React, { useState, useMemo } from "react";
import { MessageSquare, Clock, Menu, X, Plus, Search, XCircle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface Conversation {
  threadId: string;
  title: string;
  createdAt: string;
}

interface SidebarProps {
  conversations: Conversation[];
  onSelectThread: (threadId: string) => void;
  activeThreadId: string | null;
  onNewConversation: (newConv: Conversation) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  onSelectThread,
  activeThreadId,
  onNewConversation,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleNewConversation = async () => {
    const threadId = uuidv4();

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/conversations/${threadId}?title=Untitled%20Chat`,
        { method: "POST" }
      );
      const data: Conversation = await res.json();

      onNewConversation(data);
      onSelectThread(data.threadId);
      setIsOpen(false);
    } catch (err) {
      console.error("Error creating conversation:", err);
    }
  };

  // filter conversations by title
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    return conversations.filter((c) =>
      (c.title || "Untitled Chat").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, conversations]);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        aria-label="Toggle conversations sidebar"
        onClick={() => setIsOpen(!isOpen)}
        className="top-4 md:ml-[35%] ml-[25%] mt-2 z-50 p-2 bg-white/70 backdrop-blur-md shadow-md lg:hidden"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-gray-700" />
        ) : (
          <Menu className="w-5 h-5 text-gray-700" />
        )}
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

        {/* Search Box */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-9 py-2 rounded-md border placeholder:text-gray-400 text-gray-900 border-gray-200 bg-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto custom-scroll">
          {filteredConversations.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              No conversations found
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredConversations.map((conv) => (
                <li
                  key={conv.threadId}
                  onClick={() => {
                    onSelectThread(conv.threadId);
                    setIsOpen(false);
                  }}
                  className={`px-5 py-3 cursor-pointer flex flex-col rounded-md mx-2 my-1
                    transition duration-200
                    ${
                      activeThreadId === conv.threadId
                        ? "bg-indigo-100 border border-indigo-300 shadow-sm"
                        : "hover:bg-indigo-50"
                    }`}
                >
                  <span className="font-medium text-gray-800 truncate">
                    {conv.title || "Untitled Chat"}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    {new Date(conv.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden"
        />
      )}
    </>
  );
};

export default Sidebar;
