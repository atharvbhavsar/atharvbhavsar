export interface Document {
  doc_id: string;
  filename: string;
  page_count: number;
  status: "processing" | "ready" | "error";
  created_at: string;
}

export interface Source {
  doc_id: string;
  filename: string;
  page_number: number;
  content_type: string;
  content_preview: string;
  confidence: number;
  figure_id?: string;
  image_path?: string;
}

export interface RetrievedImage {
  label: string;
  page_number: number;
  url: string;
  doc_id: string;
  filename: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  retrieved_images?: RetrievedImage[];
  suggestions?: string[];
  timestamp: Date;
}
