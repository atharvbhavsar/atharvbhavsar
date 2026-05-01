"use client";

import { useState, useEffect, useCallback } from "react";
import DocumentSidebar from "@/components/DocumentSidebar";
import ChatInterface from "@/components/ChatInterface";
import { Document, Message } from "@/lib/types";
import { listDocuments } from "@/lib/api";

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      // Auto-select ready documents if none selected
      if (selectedDocIds.length === 0) {
        const ready = docs.filter((d) => d.status === "ready").map((d) => d.doc_id);
        if (ready.length > 0) setSelectedDocIds([ready[0]]);
      }
    } catch {
      // silently ignore fetch errors
    }
  }, [selectedDocIds.length]);

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 3000);
    return () => clearInterval(interval);
  }, [fetchDocuments]);

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <DocumentSidebar
        documents={documents}
        selectedDocIds={selectedDocIds}
        onSelectDoc={(id) => {
          setSelectedDocIds((prev) =>
            prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
          );
        }}
        onDocumentUploaded={fetchDocuments}
        onDocumentDeleted={(id) => {
          setDocuments((prev) => prev.filter((d) => d.doc_id !== id));
          setSelectedDocIds((prev) => prev.filter((d) => d !== id));
          fetchDocuments();
        }}
      />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">D</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">DocuMentor AI</h1>
              <p className="text-xs text-slate-400">
                {selectedDocIds.length === 0
                  ? "Select documents to start chatting"
                  : `Chatting with ${selectedDocIds.length} document${selectedDocIds.length > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
        </div>

        <ChatInterface
          selectedDocIds={selectedDocIds}
          messages={messages}
          setMessages={setMessages}
          loading={loading}
          setLoading={setLoading}
        />
      </main>
    </div>
  );
}
