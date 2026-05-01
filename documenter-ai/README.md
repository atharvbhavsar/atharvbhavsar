# DocuMentor AI

**Multimodal Document Intelligence System** — chat with your PDFs using AI that understands text, tables, figures, and diagrams.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     DocuMentor AI                       │
├─────────────────────┬───────────────────────────────────┤
│   Frontend (3000)   │        Backend (8000)             │
│   Next.js 14        │        FastAPI (Python)           │
│   Tailwind CSS      │                                   │
│   React 18          │  ┌──────────────────────────┐    │
│                     │  │   PDF Processor          │    │
│  ┌───────────────┐  │  │   (PyMuPDF + pdfplumber) │    │
│  │ DocumentSide  │  │  ├──────────────────────────┤    │
│  │ ChatInterface │◄─┼──│   OCR Processor          │    │
│  │ MessageBubble │  │  │   (pytesseract)          │    │
│  │ SourceCard    │  │  ├──────────────────────────┤    │
│  │ ImageModal    │  │  │   Embeddings             │    │
│  └───────────────┘  │  │   (sentence-transformers)│    │
│                     │  ├──────────────────────────┤    │
│                     │  │   Vector Store           │    │
│                     │  │   (ChromaDB)             │    │
│                     │  ├──────────────────────────┤    │
│                     │  │   RAG Retriever          │    │
│                     │  │   (OpenAI GPT-4o)        │    │
│                     │  └──────────────────────────┘    │
└─────────────────────┴───────────────────────────────────┘
```

---

## Features

1. **PDF Upload & Processing** — drag-and-drop PDF upload with background processing pipeline
2. **Text Extraction** — full-text extraction per page using PyMuPDF with page number tracking
3. **Table Extraction** — automatic table detection and Markdown rendering via pdfplumber
4. **Figure/Image Extraction** — extracts all embedded images and associates them with figure labels (e.g. "Fig. 7", "Table 3")
5. **OCR Support** — automatic detection of scanned PDFs and OCR via pytesseract
6. **Semantic Search** — sentence-transformer embeddings stored in ChromaDB for cosine similarity retrieval
7. **Multimodal RAG** — GPT-4o powered answers with vision support for figures/diagrams
8. **Multi-document Chat** — query across multiple PDFs simultaneously with source attribution

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS, TypeScript |
| Backend | FastAPI, Python 3.11, Uvicorn |
| PDF Processing | PyMuPDF (fitz), pdfplumber |
| OCR | pytesseract, EasyOCR |
| Embeddings | sentence-transformers (`all-MiniLM-L6-v2`) |
| Vector DB | ChromaDB (persistent) |
| LLM | OpenAI GPT-4o (vision) / GPT-3.5-turbo-16k (fallback) |
| Containerization | Docker, Docker Compose |

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- OpenAI API key

### 1. Clone and configure

```bash
git clone <repo-url>
cd documenter-ai
cp backend/.env.example backend/.env
# Edit backend/.env and set your OPENAI_API_KEY
```

### 2. Start with Docker Compose

```bash
OPENAI_API_KEY=your_key_here docker-compose up --build
```

Or with a `.env` file at the root:

```bash
echo "OPENAI_API_KEY=your_key_here" > .env
docker-compose up --build
```

### 3. Open the app

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/documents` | List all uploaded documents |
| `POST` | `/api/documents/upload` | Upload a PDF file |
| `GET` | `/api/documents/{doc_id}` | Get document details |
| `DELETE` | `/api/documents/{doc_id}` | Delete a document |
| `POST` | `/api/chat` | Send a chat message |
| `POST` | `/api/figures/search` | Search figures by label/query |
| `POST` | `/api/explain-image` | Get AI explanation for an image |
| `GET` | `/api/documents/{doc_id}/images` | List all images in a document |

---

## Environment Variables

### Backend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | *(required)* | OpenAI API key for GPT-4o |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded PDFs and extracted images |
| `CHROMA_DIR` | `./chroma_db` | Directory for ChromaDB persistence |
| `MAX_FILE_SIZE_MB` | `100` | Maximum PDF upload size in MB |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API base URL |

---

## How It Works

1. **Upload** — User uploads a PDF via drag-and-drop. The file is saved and a background task begins processing.

2. **Extraction** — PyMuPDF extracts text per page and all embedded images. pdfplumber extracts tables and converts them to Markdown. If the PDF is scanned (low text density), pytesseract OCR is run on each page.

3. **Figure Detection** — Regex patterns match figure/table labels (e.g. "Fig. 7", "Table 3") in text and associate them with nearby extracted images.

4. **Embedding** — All text and table chunks are embedded with `all-MiniLM-L6-v2` and stored in ChromaDB with metadata (doc_id, page_number, content_type).

5. **Query** — When a user asks a question, it is embedded and cosine-similarity search retrieves the top-k relevant chunks from ChromaDB.

6. **Answer Generation** — Retrieved chunks are passed as context to GPT-4o. If the question involves figures/diagrams, relevant images are included as vision inputs. The model returns a cited, grounded answer.

7. **Display** — The frontend renders the answer as Markdown, shows retrieved images as thumbnails (click to zoom), displays source cards with confidence scores, and offers smart follow-up suggestions.

---

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Set OPENAI_API_KEY
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```
