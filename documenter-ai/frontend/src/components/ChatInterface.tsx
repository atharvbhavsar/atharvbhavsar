"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, BookOpen } from "lucide-react";
import { Message } from "@/lib/types";
import { sendChatMessage } from "@/lib/api";
import MessageBubble from "./MessageBubble";
import clsx from "clsx";

interface Props {
  selectedDocIds: string[];
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

const QUICK_ACTIONS = [
  { icon: "📋", label: "Summarize", query: "Give me a comprehensive summary of the document" },
  { icon: "🔍", label: "Key Findings", query: "What are the key findings and conclusions?" },
  { icon: "📊", label: "Tables", query: "Show me all tables and their data" },
  { icon: "🖼️", label: "Figures", query: "Show all figures and diagrams" },
  { icon: "⚙️", label: "Methodology", query: "Explain the methodology" },
  { icon: "📍", label: "System Flow", query: "Show system flow diagram" },
];

export default function ChatInterface({
  selectedDocIds,
  messages,
  setMessages,
  loading,
  setLoading,
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    async (question?: string) => {
      const q = (question || input).trim();
      if (!q || loading) return;
      if (selectedDocIds.length === 0) return;

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: q,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const history = messages
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));
        const result = await sendChatMessage(q, selectedDocIds, history);

        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.answer,
          sources: result.sources,
          retrieved_images: result.retrieved_images,
          suggestions: result.suggestions,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, selectedDocIds, messages, setMessages, setLoading]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = selectedDocIds.length === 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-200 mb-2">DocuMentor AI</h2>
              <p className="text-slate-400 text-sm max-w-md">
                {isDisabled
                  ? "Upload and select documents from the sidebar to start chatting."
                  : "Ask me anything about your documents — text, tables, figures, or diagrams."}
              </p>
            </div>
            {!isDisabled && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-xl">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleSubmit(action.query)}
                    className="flex items-center gap-2 p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-blue-500/50 text-sm text-slate-300 hover:text-white transition-all text-left"
                  >
                    <span>{action.icon}</span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onSuggestionClick={handleSubmit} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div className="bg-slate-800 rounded-2xl px-4 py-3 flex gap-1.5 items-center">
              <span
                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-700">
        {isDisabled && (
          <p className="text-center text-xs text-slate-500 mb-2">
            Select at least one document to chat
          </p>
        )}
        <div
          className={clsx(
            "flex gap-3 items-end bg-slate-800 border rounded-2xl px-4 py-3 transition-all",
            isDisabled
              ? "border-slate-700 opacity-50"
              : "border-slate-600 focus-within:border-blue-500"
          )}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDisabled || loading}
            placeholder={
              isDisabled
                ? "Select documents first..."
                : "Ask about the documents... (Shift+Enter for new line)"
            }
            rows={1}
            className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 resize-none outline-none text-sm max-h-32 overflow-y-auto"
            style={{ minHeight: "24px" }}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || loading || isDisabled}
            className={clsx(
              "p-2 rounded-xl transition-all flex-shrink-0",
              input.trim() && !loading && !isDisabled
                ? "bg-blue-600 hover:bg-blue-500 text-white"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
