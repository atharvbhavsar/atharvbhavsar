import axios from "axios";
import { Document, Source, RetrievedImage } from "./types";

const api = axios.create({
  baseURL: "/api/backend",
  timeout: 120000,
});

export async function listDocuments(): Promise<Document[]> {
  const res = await api.get("/documents");
  return res.data;
}

export async function uploadDocument(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ doc_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post("/documents/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
  return res.data;
}

export async function deleteDocument(docId: string): Promise<void> {
  await api.delete(`/documents/${docId}`);
}

export async function sendChatMessage(
  question: string,
  docIds: string[],
  chatHistory: Array<{ role: string; content: string }>
): Promise<{
  answer: string;
  sources: Source[];
  retrieved_images: RetrievedImage[];
  suggestions: string[];
}> {
  const res = await api.post("/chat", {
    question,
    doc_ids: docIds,
    chat_history: chatHistory,
  });
  return res.data;
}

export async function searchFigures(
  query: string,
  docIds: string[]
): Promise<{ figures: RetrievedImage[] }> {
  const res = await api.post("/figures/search", { query, doc_ids: docIds });
  return res.data;
}

export async function explainImage(
  imageUrl: string,
  context: string = ""
): Promise<{ explanation: string }> {
  const res = await api.post("/explain-image", { image_url: imageUrl, context });
  return res.data;
}

export async function getDocumentImages(docId: string): Promise<{ images: unknown[] }> {
  const res = await api.get(`/documents/${docId}/images`);
  return res.data;
}
