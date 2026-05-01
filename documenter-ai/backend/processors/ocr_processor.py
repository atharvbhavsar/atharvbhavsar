import pytesseract
from PIL import Image
import fitz
import io
import os


class OCRProcessor:
    """OCR for scanned PDFs and images using pytesseract."""

    def __init__(self):
        pass

    def extract_text_from_image(self, image_path: str) -> str:
        try:
            img = Image.open(image_path)
            text = pytesseract.image_to_string(img)
            return text.strip()
        except Exception:
            return ""

    def is_scanned_pdf(self, pdf_path: str, text_threshold: int = 50) -> bool:
        """Returns True if PDF is mostly scanned (little extractable text)."""
        try:
            doc = fitz.open(pdf_path)
            total_text = 0
            pages_checked = min(5, len(doc))
            for i in range(pages_checked):
                text = doc[i].get_text("text")
                total_text += len(text.strip())
            doc.close()
            return total_text < text_threshold * pages_checked
        except Exception:
            return False

    def ocr_pdf_page(self, pdf_path: str, page_num: int, dpi: int = 200) -> str:
        """OCR a specific page of a PDF."""
        try:
            doc = fitz.open(pdf_path)
            page = doc[page_num]
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
            doc.close()
            img = Image.open(io.BytesIO(img_bytes))
            text = pytesseract.image_to_string(img)
            return text.strip()
        except Exception:
            return ""

    def ocr_full_pdf(self, pdf_path: str, doc_id: str) -> list:
        """OCR all pages, return list of {page_number, content} dicts."""
        results = []
        try:
            doc = fitz.open(pdf_path)
            page_count = len(doc)
            doc.close()
            for i in range(page_count):
                text = self.ocr_pdf_page(pdf_path, i)
                if text:
                    results.append({
                        "doc_id": doc_id,
                        "page_number": i + 1,
                        "content_type": "text",
                        "content": text,
                        "metadata": {"page": i + 1, "ocr": True}
                    })
        except Exception:
            pass
        return results
