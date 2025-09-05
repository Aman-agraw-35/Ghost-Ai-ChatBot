"use client";

import React from "react";
import { Search } from "lucide-react";

interface SearchInfo {
  stages: string[];
  query?: string;
  urls?: Array<string | { link?: string }>;
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

const PremiumTypingAnimation: React.FC = () => {
  return (
    <div className="flex items-center space-x-1.5">
      <div className="w-2 h-2 bg-gray-400/60 rounded-full animate-pulse" />
      <div className="w-2 h-2 bg-gray-400/60 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
      <div className="w-2 h-2 bg-gray-400/60 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
    </div>
  );
};

const SkeletonMessage: React.FC<{ isUser?: boolean; widths?: string[] }> = ({ isUser, widths = ["w-40", "w-32"] }) => {
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-5`}>
      <div className="flex flex-col max-w-lg space-y-2 animate-pulse">
        {widths.map((w, i) => (
          <div key={i} className={`${w} h-4 rounded-lg ${isUser ? "bg-green-200" : "bg-gray-200"}`} />
        ))}
      </div>
    </div>
  );
};

const SearchStages: React.FC<{ searchInfo?: SearchInfo }> = ({ searchInfo }) => {
  if (!searchInfo?.stages?.length) return null;
  return (
    <div className="mb-3 mt-1 relative pl-5">
      <div className="flex flex-col space-y-4 text-sm text-gray-700">
        {searchInfo.stages.includes("searching") && (
          <div className="relative">
            <div className="absolute -left-4 top-1 w-2.5 h-2.5 bg-teal-400 rounded-full shadow-sm animate-pulse" />
            {searchInfo.stages.includes("reading") && (
              <div className="absolute -left-[10px] top-3 w-0.5 h-[calc(100%+1rem)] bg-gradient-to-b from-teal-300 to-teal-200" />
            )}
            <div className="flex flex-col">
              <span className="font-medium mb-2 ml-1 text-gray-800">Searching the web</span>
              <div className="flex flex-wrap gap-2 pl-1 mt-1">
                <div className="bg-gray-50 text-xs px-3 py-1.5 rounded-md border border-gray-200 inline-flex items-center shadow-sm">
                  <Search className="w-3 h-3 mr-1.5 text-gray-500" />
                  {searchInfo.query || "Loading..."}
                </div>
              </div>
            </div>
          </div>
        )}

        {searchInfo.stages.includes("reading") && (
          <div className="relative">
            <div className="absolute -left-4 top-1 w-2.5 h-2.5 bg-teal-400 rounded-full shadow-sm animate-pulse" />
            <div className="flex flex-col">
              <span className="font-medium mb-2 ml-1 text-gray-800">Reading sources</span>
              {Array.isArray(searchInfo.urls) && searchInfo.urls.length > 0 && (
                <div className="pl-1 space-y-1">
                  <div className="flex flex-wrap gap-2">
                    {searchInfo.urls.map((url, i) => (
                      <div key={i} title={typeof url === "string" ? url : (url && "link" in url ? url.link : "")} className="bg-gray-50 text-xs px-3 py-1.5 rounded-md border border-gray-200 truncate max-w-[200px] transition-all duration-200 hover:bg-gray-100 shadow-sm">
                        {typeof url === "string" ? url : url?.link || JSON.stringify(url).slice(0, 30)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {searchInfo.stages.includes("writing") && (
          <div className="relative">
            <div className="absolute -left-4 top-1 w-2.5 h-2.5 bg-teal-400 rounded-full shadow-sm animate-pulse" />
            <span className="font-medium pl-1 text-gray-800">Writing response</span>
          </div>
        )}

        {searchInfo.stages.includes("error") && (
          <div className="relative">
            <div className="absolute -left-4 top-1 w-2.5 h-2.5 bg-red-400 rounded-full shadow-sm" />
            <span className="font-medium text-red-600">Search error</span>
            <div className="pl-4 text-xs text-red-500 mt-1">{searchInfo.error || "An error occurred during search."}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const MessageArea: React.FC<{ messages?: Message[]; isLoading?: boolean; onCreateConversation?: () => void }> = ({ messages = [], isLoading = false, onCreateConversation }) => {
  if (isLoading) {
    return (
      <div className="flex-grow overflow-y-auto bg-[#FAFAF7] border-b border-gray-200" style={{ minHeight: 0 }}>
        <div className="w-full p-6">
          <SkeletonMessage widths={["w-36", "w-48"]} />
          <SkeletonMessage isUser widths={["w-44"]} />
          <SkeletonMessage widths={["w-40", "w-28"]} />
          <SkeletonMessage isUser widths={["w-32", "w-20"]} />
        </div>
      </div>
    );
  }

  if (!messages || messages.length <= 1) {
    return (
      <div className="flex-grow flex items-center justify-center bg-[#FAFAF7] border-b border-gray-200">
        <div className="text-center p-6">
          <div className="text-gray-600 mb-4">No conversation yet</div>
          <button
            onClick={() => onCreateConversation && onCreateConversation()}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Start a conversation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow overflow-y-auto bg-[#FAFAF7] border-b border-gray-200" style={{ minHeight: 0 }}>
      <div className="w-full p-6">
        {messages.slice(1).map((message) => (
          <div key={message.id} className={`flex ${message.isUser ? "justify-end" : "justify-start"} mb-5`}>
            <div className="flex flex-col max-w-lg">
              {!message.isUser && message.searchInfo && <SearchStages searchInfo={message.searchInfo} />}
              <div className={`rounded-2xl py-3 px-5 shadow-md transition-all duration-300 ${message.isUser ? "bg-green-500 text-white rounded-br-none" : "bg-white/80 backdrop-blur-sm border border-gray-200 text-gray-800 rounded-bl-none"}`}>
                {message.isLoading ? <PremiumTypingAnimation /> : message.content ? <div className="whitespace-pre-wrap break-words">{message.content}</div> : <span className="text-gray-400 text-xs italic">Waiting for response...</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MessageArea;
