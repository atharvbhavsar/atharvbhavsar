import chromadb
from chromadb.config import Settings
import os
from typing import List, Dict, Any


class VectorStore:
    def __init__(self, persist_dir: str):
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(
            name="documenter_chunks",
            metadata={"hnsw:space": "cosine"}
        )

    def add_chunks(self, chunks: List[Dict], embeddings: List[List[float]]):
        if not chunks:
            return
        ids = []
        documents = []
        metadatas = []
        for i, chunk in enumerate(chunks):
            chunk_id = f"{chunk['doc_id']}_p{chunk['page_number']}_{chunk['content_type']}_{i}"
            ids.append(chunk_id)
            documents.append(chunk["content"][:2000])
            metadatas.append({
                "doc_id": chunk["doc_id"],
                "page_number": chunk["page_number"],
                "content_type": chunk["content_type"],
                "filename": chunk.get("metadata", {}).get("filename", "")
            })

        # Add in batches
        batch_size = 100
        for start in range(0, len(ids), batch_size):
            end = start + batch_size
            self.collection.add(
                ids=ids[start:end],
                documents=documents[start:end],
                embeddings=embeddings[start:end],
                metadatas=metadatas[start:end]
            )

    def query(self, query_embedding: List[float], doc_ids: List[str], n_results: int = 10) -> List[Dict]:
        where_clause = {"doc_id": {"$in": doc_ids}} if len(doc_ids) > 1 else {"doc_id": doc_ids[0]}
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where_clause
            )
            chunks = []
            if results["documents"] and results["documents"][0]:
                for i, doc in enumerate(results["documents"][0]):
                    meta = results["metadatas"][0][i]
                    distance = results["distances"][0][i] if results.get("distances") else 0.5
                    confidence = max(0.0, 1.0 - distance)
                    chunks.append({
                        "content": doc,
                        "metadata": meta,
                        "confidence": round(confidence, 3)
                    })
            return chunks
        except Exception:
            return []

    def delete_document(self, doc_id: str):
        try:
            self.collection.delete(where={"doc_id": doc_id})
        except Exception:
            pass
