"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronUp, ExternalLink, Sparkles, ZoomIn } from "lucide-react";
import { Message, RetrievedImage } from "@/lib/types";
import ImageModal from "./ImageModal";
import SourceCard from "./SourceCard";

interface Props {
  message: Message;
  onSuggestionClick: (q: string) => void;
}

export default function MessageBubble({ message, onSuggestionClick }: Props) {
  const [showSources, setShowSources] = useState(false);
  const [selectedImage, setSelectedImage] = useState<RetrievedImage | null>(null);

  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-xl bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 max-w-4xl">
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
        <span className="text-white text-xs font-bold">AI</span>
      </div>
      <div className="flex-1 space-y-3">
        {/* Answer */}
        <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-5 py-4">
          <div className="prose prose-sm prose-invert max-w-none text-slate-200">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="text-sm border-collapse w-full">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-slate-600 px-3 py-2 bg-slate-700 text-slate-200 text-left font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-slate-600 px-3 py-2 text-slate-300">{children}</td>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.includes("language-");
                  if (isBlock)
                    return (
                      <pre className="bg-slate-900 rounded-lg p-3 overflow-x-auto text-xs">
                        <code>{children}</code>
                      </pre>
                    );
                  return (
                    <code className="bg-slate-700 px-1.5 py-0.5 rounded text-xs">{children}</code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Retrieved Images */}
        {message.retrieved_images && message.retrieved_images.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-medium">Retrieved Figures/Images:</p>
            <div className="flex flex-wrap gap-3">
              {message.retrieved_images.map((img, i) => (
                <div
                  key={i}
                  className="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500 transition-all"
                  onClick={() => setSelectedImage(img)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.label}
                    className="w-40 h-28 object-cover bg-slate-900"
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                    <p className="text-xs text-white truncate">{img.label}</p>
                    <p className="text-xs text-slate-300">p.{img.page_number}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowSources((s) => !s)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {message.sources.length} source{message.sources.length > 1 ? "s" : ""}
              {showSources ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {showSources && (
              <div className="grid gap-2">
                {message.sources.map((src, i) => (
                  <SourceCard key={i} source={src} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400 mt-1" />
            {message.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick(s)}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-full transition-all border border-slate-600 hover:border-slate-500"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedImage && (
        <ImageModal image={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
}
