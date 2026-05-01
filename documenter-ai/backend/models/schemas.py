from pydantic import BaseModel
from typing import Optional, List, Any


class DocumentInfo(BaseModel):
    doc_id: str
    filename: str
    page_count: int
    status: str  # "processing" | "ready" | "error"
    created_at: str


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    question: str
    doc_ids: List[str]
    chat_history: Optional[List[ChatMessage]] = []


class SourceReference(BaseModel):
    doc_id: str
    filename: str
    page_number: int
    content_type: str  # "text" | "table" | "image" | "figure"
    content_preview: str
    confidence: float
    figure_id: Optional[str] = None
    image_path: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceReference]
    retrieved_images: Optional[List[dict]] = []
    suggestions: Optional[List[str]] = []


class FigureRetrievalRequest(BaseModel):
    query: str
    doc_ids: List[str]


class FigureRetrievalResponse(BaseModel):
    figures: List[dict]
