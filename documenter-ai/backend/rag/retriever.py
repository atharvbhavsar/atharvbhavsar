from openai import OpenAI
from typing import List, Dict, Optional
import base64
import os
import re
import json


class RAGRetriever:
    def __init__(self, openai_api_key: str):
        self.client = OpenAI(api_key=openai_api_key)

    def generate_answer(
        self,
        question: str,
        chunks: List[Dict],
        images: Optional[List[Dict]] = None,
        chat_history: Optional[List[Dict]] = None
    ) -> dict:
        context_parts = []
        for i, chunk in enumerate(chunks[:8]):
            meta = chunk.get("metadata", {})
            page = meta.get("page_number", "?")
            ctype = meta.get("content_type", "text")
            doc_id = meta.get("doc_id", "")
            content = chunk.get("content", "")[:1500]
            context_parts.append(
                f"[Source {i+1} | Page {page} | Type: {ctype} | Doc: {doc_id}]\n{content}"
            )

        context_text = "\n\n---\n\n".join(context_parts)

        messages = []

        # System prompt
        messages.append({
            "role": "system",
            "content": (
                "You are DocuMentor AI, an expert document intelligence assistant. "
                "You analyze documents including text, tables, figures, and diagrams. "
                "Always cite your sources with page numbers. "
                "When asked about figures or tables, describe them accurately. "
                "Provide confidence-backed answers. "
                "If you don't know, say so clearly."
            )
        })

        # Chat history
        if chat_history:
            for msg in chat_history[-6:]:
                messages.append({"role": msg["role"], "content": msg["content"]})

        # Build user message
        user_content = []

        user_content.append({
            "type": "text",
            "text": f"Context from documents:\n\n{context_text}\n\nQuestion: {question}"
        })

        # Add relevant images if any (vision)
        if images:
            for img_data in images[:3]:
                img_path = img_data.get("image_path", "")
                if img_path and os.path.exists(img_path):
                    try:
                        with open(img_path, "rb") as f:
                            b64 = base64.b64encode(f.read()).decode()
                        user_content.append({
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"}
                        })
                    except Exception:
                        pass

        messages.append({"role": "user", "content": user_content})

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=2048,
                temperature=0.3
            )
            answer = response.choices[0].message.content
        except Exception as e:
            # Fallback to non-vision model
            try:
                text_messages = list(messages)
                # Simplify user message to text only
                text_messages[-1] = {
                    "role": "user",
                    "content": f"Context from documents:\n\n{context_text}\n\nQuestion: {question}"
                }
                response = self.client.chat.completions.create(
                    model="gpt-3.5-turbo-16k",
                    messages=text_messages,
                    max_tokens=2048,
                    temperature=0.3
                )
                answer = response.choices[0].message.content
            except Exception as e2:
                answer = f"I found relevant content but encountered an error generating the response: {str(e2)}"

        # Generate smart suggestions
        suggestions = self._generate_suggestions(question, answer)

        return {
            "answer": answer,
            "suggestions": suggestions
        }

    def explain_image(self, image_path: str, context: str = "") -> str:
        if not os.path.exists(image_path):
            return "Image not found."
        try:
            with open(image_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()

            messages = [
                {
                    "role": "system",
                    "content": "You are an expert at analyzing technical diagrams, figures, and charts. Provide detailed, accurate explanations."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Please analyze and explain this image/diagram in detail.{' Context: ' + context if context else ''}"
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"}
                        }
                    ]
                }
            ]

            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=1024
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Could not analyze image: {str(e)}"

    def _generate_suggestions(self, question: str, answer: str) -> List[str]:
        question_lower = question.lower()
        suggestions = []

        if any(w in question_lower for w in ["figure", "fig", "diagram", "image"]):
            suggestions.append("Explain this diagram in detail")
            suggestions.append("Show related figures")
        elif any(w in question_lower for w in ["table", "data", "values"]):
            suggestions.append("Summarize the key findings from this table")
            suggestions.append("Compare with other tables in the document")
        elif any(w in question_lower for w in ["method", "approach", "algorithm"]):
            suggestions.append("Show the system flow diagram")
            suggestions.append("Explain the methodology step by step")
        else:
            suggestions.append("Show related figures or diagrams")
            suggestions.append("What are the key findings?")

        suggestions.append("Summarize the main points")
        return suggestions[:3]
