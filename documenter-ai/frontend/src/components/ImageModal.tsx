"use client";

import { useState } from "react";
import { X, Download, Sparkles } from "lucide-react";
import { RetrievedImage } from "@/lib/types";
import { explainImage } from "@/lib/api";

interface Props {
  image: RetrievedImage;
  onClose: () => void;
}

export default function ImageModal({ image, onClose }: Props) {
  const [explanation, setExplanation] = useState("");
  const [explaining, setExplaining] = useState(false);

  const handleExplain = async () => {
    setExplaining(true);
    try {
      const result = await explainImage(
        image.url,
        `From ${image.filename}, page ${image.page_number}`
      );
      setExplanation(result.explanation);
    } catch {
      setExplanation("Could not generate explanation.");
    } finally {
      setExplaining(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-2xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h3 className="font-semibold text-slate-200">{image.label}</h3>
            <p className="text-xs text-slate-400">
              {image.filename} · Page {image.page_number}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={image.url}
              download
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-all"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="flex-1 overflow-auto bg-slate-900 flex items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.label}
            className="max-w-full max-h-[50vh] object-contain rounded-lg"
          />
        </div>

        {/* Explain section */}
        <div className="px-5 py-4 border-t border-slate-700">
          {!explanation && (
            <button
              onClick={handleExplain}
              disabled={explaining}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-xl transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {explaining ? "Analyzing..." : "Explain this image/diagram"}
            </button>
          )}
          {explanation && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-400">
                <Sparkles className="w-4 h-4" />
                AI Explanation
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{explanation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
