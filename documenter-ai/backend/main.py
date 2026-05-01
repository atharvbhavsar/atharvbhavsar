import os
import re
import json
import uuid
import asyncio
from datetime import datetime
from pathlib import Path
from typing import List, Optional
import shutil

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic_settings import BaseSettings
import aiofiles

from models.schemas import (
    DocumentInfo, ChatRequest, ChatResponse, SourceReference,
    FigureRetrievalRequest, FigureRetrievalResponse
)
from processors.pdf_processor import PDFProcessor
from processors.ocr_processor import OCRProcessor
from rag.embeddings import EmbeddingModel
from rag.vector_store import VectorStore
from rag.retriever import RAGRetriever


class Settings(BaseSettings):
    openai_api_key: str = ""
    upload_dir: str = "./uploads"
    chroma_dir: str = "./chroma_db"
    max_file_size_mb: int = 100

    class Config:
        env_file = ".env"


settings = Settings()

app = FastAPI(title="DocuMentor AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(settings.chroma_dir, exist_ok=True)

# Initialize services
pdf_processor = PDFProcessor(settings.upload_dir)
ocr_processor = OCRProcessor()
embedding_model = EmbeddingModel()
vector_store = VectorStore(settings.chroma_dir)
retriever = RAGRetriever(settings.openai_api_key)

# In-memory document registry
documents: dict = {}
doc_registry_path = os.path.join(settings.upload_dir, "registry.json")


def load_registry():
    global documents
    if os.path.exists(doc_registry_path):
        try:
            with open(doc_registry_path, "r") as f:
                documents = json.load(f)
        except Exception:
            documents = {}


def save_registry():
    with open(doc_registry_path, "w") as f:
        json.dump(documents, f, indent=2)


load_registry()

# Serve uploaded images
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/")
async def root():
    return {"message": "DocuMentor AI API", "version": "1.0.0"}


@app.get("/api/documents", response_model=List[DocumentInfo])
async def list_documents():
    return [DocumentInfo(**doc) for doc in documents.values()]


@app.post("/api/documents/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    doc_id = str(uuid.uuid4())[:8]
    doc_dir = os.path.join(settings.upload_dir, doc_id)
    os.makedirs(doc_dir, exist_ok=True)

    file_path = os.path.join(doc_dir, file.filename)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        if len(content) > settings.max_file_size_mb * 1024 * 1024:
            raise HTTPException(400, f"File too large. Max {settings.max_file_size_mb}MB")
        await f.write(content)

    doc_info = {
        "doc_id": doc_id,
        "filename": file.filename,
        "page_count": 0,
        "status": "processing",
        "created_at": datetime.utcnow().isoformat(),
        "file_path": file_path,
        "figures": {},
        "images": []
    }
    documents[doc_id] = doc_info
    save_registry()

    background_tasks.add_task(process_document, doc_id, file_path)

    return {"doc_id": doc_id, "status": "processing", "message": "Document uploaded and processing started"}


def process_document(doc_id: str, file_path: str):
    try:
        # Check if scanned PDF
        is_scanned = ocr_processor.is_scanned_pdf(file_path)

        # Process PDF
        result = pdf_processor.process(file_path, doc_id)
        chunks = result["chunks"]
        images = result["images"]
        page_count = result["page_count"]
        figures = result["figures"]

        # If scanned, run OCR and augment chunks
        if is_scanned:
            ocr_chunks = ocr_processor.ocr_full_pdf(file_path, doc_id)
            chunks.extend(ocr_chunks)

        # Add filename to chunk metadata
        filename = documents[doc_id]["filename"]
        for chunk in chunks:
            chunk.setdefault("metadata", {})["filename"] = filename
            chunk.setdefault("metadata", {})["doc_id"] = doc_id

        # Generate embeddings
        texts = [c["content"][:1000] for c in chunks]
        if texts:
            embeddings = embedding_model.embed_texts(texts)
            vector_store.add_chunks(chunks, embeddings)

        # Update document info
        documents[doc_id].update({
            "page_count": page_count,
            "status": "ready",
            "figures": figures,
            "images": [
                {
                    "image_path": img["image_path"],
                    "page_number": img["page_number"],
                    "figure_label": img.get("figure_label"),
                    "image_filename": img["image_filename"]
                }
                for img in images
            ]
        })
        save_registry()

    except Exception as e:
        documents[doc_id]["status"] = "error"
        documents[doc_id]["error"] = str(e)
        save_registry()


@app.get("/api/documents/{doc_id}")
async def get_document(doc_id: str):
    if doc_id not in documents:
        raise HTTPException(404, "Document not found")
    return documents[doc_id]


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    if doc_id not in documents:
        raise HTTPException(404, "Document not found")

    # Delete from vector store
    vector_store.delete_document(doc_id)

    # Delete files
    doc_dir = os.path.join(settings.upload_dir, doc_id)
    if os.path.exists(doc_dir):
        shutil.rmtree(doc_dir)

    del documents[doc_id]
    save_registry()
    return {"message": "Document deleted"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not request.doc_ids:
        raise HTTPException(400, "At least one document must be selected")

    # Validate documents exist and are ready
    for doc_id in request.doc_ids:
        if doc_id not in documents:
            raise HTTPException(404, f"Document {doc_id} not found")
        if documents[doc_id]["status"] != "ready":
            raise HTTPException(400, f"Document {doc_id} is not ready yet")

    # Check if this is a figure/table retrieval request
    fig_pattern = r'(?:show|get|find|display).*?(?:fig(?:ure)?\.?\s*(\d+[a-z]?)|table\s*(\d+[a-z]?))'
    fig_match = re.search(fig_pattern, request.question, re.IGNORECASE)

    retrieved_images = []

    if fig_match:
        # Try to find exact figure
        query_lower = request.question.lower()
        for doc_id in request.doc_ids:
            doc = documents[doc_id]
            figures = doc.get("figures", {})
            for label, fig_info in figures.items():
                if any(part in query_lower for part in label.lower().split()):
                    img_path = fig_info.get("image_path", "")
                    if os.path.exists(img_path):
                        rel_path = os.path.relpath(img_path, settings.upload_dir)
                        retrieved_images.append({
                            "label": fig_info.get("label", label),
                            "page_number": fig_info.get("page_number", 0),
                            "url": f"/uploads/{rel_path}",
                            "doc_id": doc_id,
                            "filename": doc["filename"]
                        })

    # Embed query and retrieve chunks
    query_embedding = embedding_model.embed_query(request.question)
    chunks = vector_store.query(query_embedding, request.doc_ids, n_results=10)

    if not chunks:
        return ChatResponse(
            answer="I couldn't find relevant information in the selected documents. Please try rephrasing your question.",
            sources=[],
            retrieved_images=retrieved_images,
            suggestions=["Try a different search term", "Select different documents", "Ask about the document summary"]
        )

    # Get relevant images for context (if asking about diagrams/figures)
    context_images = []
    question_lower = request.question.lower()
    if any(w in question_lower for w in ["diagram", "figure", "fig", "image", "show", "chart", "graph"]):
        for doc_id in request.doc_ids:
            doc = documents[doc_id]
            for img_info in doc.get("images", [])[:3]:
                context_images.append(img_info)

    # Generate answer
    result = retriever.generate_answer(
        question=request.question,
        chunks=chunks,
        images=context_images if context_images else None,
        chat_history=[msg.dict() for msg in (request.chat_history or [])]
    )

    # Build source references
    sources = []
    seen = set()
    for chunk in chunks[:5]:
        meta = chunk.get("metadata", {})
        doc_id = meta.get("doc_id", "")
        page = meta.get("page_number", 0)
        key = f"{doc_id}_{page}"
        if key not in seen and doc_id in documents:
            seen.add(key)
            sources.append(SourceReference(
                doc_id=doc_id,
                filename=documents[doc_id]["filename"],
                page_number=page,
                content_type=meta.get("content_type", "text"),
                content_preview=chunk["content"][:200],
                confidence=chunk.get("confidence", 0.5)
            ))

    # If figure retrieval and no retrieved_images yet, add from image store
    if not retrieved_images and any(w in question_lower for w in ["figure", "fig", "table"]):
        for doc_id in request.doc_ids:
            doc = documents[doc_id]
            for img in doc.get("images", [])[:2]:
                rel_path = os.path.relpath(img["image_path"], settings.upload_dir)
                retrieved_images.append({
                    "label": img.get("figure_label") or f"Image p.{img['page_number']}",
                    "page_number": img["page_number"],
                    "url": f"/uploads/{rel_path}",
                    "doc_id": doc_id,
                    "filename": doc["filename"]
                })

    return ChatResponse(
        answer=result["answer"],
        sources=sources,
        retrieved_images=retrieved_images,
        suggestions=result["suggestions"]
    )


@app.post("/api/figures/search")
async def search_figures(request: FigureRetrievalRequest):
    results = []
    query_lower = request.query.lower()

    for doc_id in request.doc_ids:
        if doc_id not in documents:
            continue
        doc = documents[doc_id]

        # Search in named figures
        for label, fig_info in doc.get("figures", {}).items():
            if any(q in label.lower() for q in query_lower.split()):
                img_path = fig_info.get("image_path", "")
                if os.path.exists(img_path):
                    rel_path = os.path.relpath(img_path, settings.upload_dir)
                    results.append({
                        "label": fig_info.get("label", label),
                        "page_number": fig_info.get("page_number", 0),
                        "url": f"/uploads/{rel_path}",
                        "doc_id": doc_id,
                        "filename": doc["filename"]
                    })

        # Also return all images if no specific match
        if not results:
            for img in doc.get("images", [])[:5]:
                rel_path = os.path.relpath(img["image_path"], settings.upload_dir)
                results.append({
                    "label": img.get("figure_label") or f"Image p.{img['page_number']}",
                    "page_number": img["page_number"],
                    "url": f"/uploads/{rel_path}",
                    "doc_id": doc_id,
                    "filename": doc["filename"]
                })

    return {"figures": results}


@app.post("/api/explain-image")
async def explain_image_endpoint(data: dict):
    image_url = data.get("image_url", "")
    context = data.get("context", "")

    # Convert URL to local path
    if image_url.startswith("/uploads/"):
        local_path = os.path.join(settings.upload_dir, image_url[len("/uploads/"):])
    else:
        raise HTTPException(400, "Invalid image URL")

    explanation = retriever.explain_image(local_path, context)
    return {"explanation": explanation}


@app.get("/api/documents/{doc_id}/images")
async def get_document_images(doc_id: str):
    if doc_id not in documents:
        raise HTTPException(404, "Document not found")

    doc = documents[doc_id]
    images_with_urls = []
    for img in doc.get("images", []):
        rel_path = os.path.relpath(img["image_path"], settings.upload_dir)
        images_with_urls.append({
            **img,
            "url": f"/uploads/{rel_path}"
        })
    return {"images": images_with_urls}
