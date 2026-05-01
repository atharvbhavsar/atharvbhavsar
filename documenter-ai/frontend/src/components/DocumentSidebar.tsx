"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Trash2,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Upload,
  ChevronRight,
} from "lucide-react";
import { Document } from "@/lib/types";
import { uploadDocument, deleteDocument } from "@/lib/api";
import clsx from "clsx";

interface Props {
  documents: Document[];
  selectedDocIds: string[];
  onSelectDoc: (id: string) => void;
  onDocumentUploaded: () => void;
  onDocumentDeleted: (id: string) => void;
}

export default function DocumentSidebar({
  documents,
  selectedDocIds,
  onSelectDoc,
  onDocumentUploaded,
  onDocumentDeleted,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      setError("");
      setUploadProgress(0);
      try {
        await uploadDocument(file, setUploadProgress);
        onDocumentUploaded();
      } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: string } } };
        setError(err?.response?.data?.detail || "Upload failed");
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [onDocumentUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading,
  });

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDocument(docId);
      onDocumentDeleted(docId);
    } catch {
      // silently ignore
    }
  };

  const statusIcon = (status: string) => {
    if (status === "ready") return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (status === "processing") return <Clock className="w-4 h-4 text-yellow-400 animate-spin" />;
    return <AlertCircle className="w-4 h-4 text-red-400" />;
  };

  return (
    <aside className="w-72 flex flex-col border-r border-slate-700 bg-slate-800 overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Documents
        </h2>
      </div>

      {/* Drop Zone */}
      <div className="p-3">
        <div
          {...getRootProps()}
          className={clsx(
            "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all",
            isDragActive ? "border-blue-500 bg-blue-500/10" : "border-slate-600 hover:border-slate-500",
            uploading && "opacity-50 cursor-not-allowed"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
          {uploading ? (
            <div>
              <p className="text-xs text-slate-400 mb-1">Uploading... {uploadProgress}%</p>
              <div className="w-full bg-slate-700 rounded-full h-1">
                <div
                  className="bg-blue-500 h-1 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              {isDragActive ? "Drop PDF here" : "Drag & drop PDF\nor click to upload"}
            </p>
          )}
        </div>
        {error && <p className="text-xs text-red-400 mt-2 text-center">{error}</p>}
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3 space-y-2">
        {documents.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            No documents yet.
            <br />
            Upload a PDF to get started.
          </div>
        )}
        {documents.map((doc) => (
          <div
            key={doc.doc_id}
            onClick={() => doc.status === "ready" && onSelectDoc(doc.doc_id)}
            className={clsx(
              "relative rounded-lg p-3 cursor-pointer transition-all group",
              selectedDocIds.includes(doc.doc_id)
                ? "bg-blue-600/20 border border-blue-500/50"
                : "bg-slate-700/50 border border-transparent hover:border-slate-600",
              doc.status !== "ready" && "opacity-70 cursor-default"
            )}
          >
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{doc.filename}</p>
                <div className="flex items-center gap-2 mt-1">
                  {statusIcon(doc.status)}
                  <span className="text-xs text-slate-400">
                    {doc.status === "ready" ? `${doc.page_count} pages` : doc.status}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(doc.doc_id, e)}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {selectedDocIds.includes(doc.doc_id) && (
              <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400" />
            )}
          </div>
        ))}
      </div>

      {/* Multi-doc info */}
      {selectedDocIds.length > 1 && (
        <div className="p-3 border-t border-slate-700 bg-blue-900/20">
          <p className="text-xs text-blue-300 text-center">
            Multi-document mode: {selectedDocIds.length} docs selected
          </p>
        </div>
      )}
    </aside>
  );
}
