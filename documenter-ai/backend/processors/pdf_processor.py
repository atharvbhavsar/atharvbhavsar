import fitz  # PyMuPDF
import pdfplumber
import os
import re
import json
from pathlib import Path
from PIL import Image
import io


class PDFProcessor:
    def __init__(self, upload_dir: str):
        self.upload_dir = upload_dir

    def process(self, pdf_path: str, doc_id: str) -> dict:
        """
        Returns {
          "chunks": [...],  # text/table chunks for embedding
          "images": [...],  # image metadata
          "page_count": int,
          "figures": {...}  # figure_label -> image_path mapping
        }
        """
        images_dir = os.path.join(self.upload_dir, doc_id, "images")
        os.makedirs(images_dir, exist_ok=True)

        chunks = []
        images = []
        figures = {}  # label -> {path, page}

        # Extract text and images using PyMuPDF
        doc = fitz.open(pdf_path)
        page_count = len(doc)

        for page_num in range(page_count):
            page = doc[page_num]

            # Extract text
            text = page.get_text("text")
            if text.strip():
                chunks.append({
                    "doc_id": doc_id,
                    "page_number": page_num + 1,
                    "content_type": "text",
                    "content": text,
                    "metadata": {"page": page_num + 1}
                })

            # Extract images
            image_list = page.get_images(full=True)
            for img_idx, img_info in enumerate(image_list):
                xref = img_info[0]
                try:
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]

                    img_filename = f"page_{page_num+1}_img_{img_idx}.png"
                    img_path = os.path.join(images_dir, img_filename)

                    img = Image.open(io.BytesIO(image_bytes))
                    if img.mode in ("RGBA", "P"):
                        img = img.convert("RGB")
                    img.save(img_path, "PNG")

                    img_meta = {
                        "doc_id": doc_id,
                        "page_number": page_num + 1,
                        "image_path": img_path,
                        "image_filename": img_filename,
                        "content_type": "image",
                        "width": img.width,
                        "height": img.height,
                        "figure_label": None
                    }
                    images.append(img_meta)
                except Exception:
                    pass

        doc.close()

        # Extract tables using pdfplumber
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    tables = page.extract_tables()
                    for tbl_idx, table in enumerate(tables):
                        if table:
                            md_table = self._table_to_markdown(table)
                            chunks.append({
                                "doc_id": doc_id,
                                "page_number": page_num + 1,
                                "content_type": "table",
                                "content": md_table,
                                "metadata": {"page": page_num + 1, "table_index": tbl_idx}
                            })
        except Exception:
            pass

        # Detect figure/table labels in text chunks and associate with nearby images
        figure_pattern = re.compile(
            r'((?:Fig(?:ure)?\.?\s*\d+[a-z]?)|(?:Table\s*\d+[a-z]?))',
            re.IGNORECASE
        )

        page_images = {}
        for img in images:
            pg = img["page_number"]
            if pg not in page_images:
                page_images[pg] = []
            page_images[pg].append(img)

        for chunk in chunks:
            if chunk["content_type"] == "text":
                labels = figure_pattern.findall(chunk["content"])
                for label in labels:
                    norm_label = label.strip().lower()
                    norm_label = re.sub(r'\s+', ' ', norm_label)
                    pg = chunk["page_number"]
                    # Associate with first image on same or adjacent page
                    for offset in [0, 1, -1]:
                        pg_check = pg + offset
                        if pg_check in page_images and page_images[pg_check]:
                            img_entry = page_images[pg_check][0]
                            img_entry["figure_label"] = label
                            figures[norm_label] = {
                                "image_path": img_entry["image_path"],
                                "page_number": pg_check,
                                "label": label
                            }
                            break

        return {
            "chunks": chunks,
            "images": images,
            "page_count": page_count,
            "figures": figures
        }

    def _table_to_markdown(self, table: list) -> str:
        if not table:
            return ""
        rows = []
        for i, row in enumerate(table):
            cleaned = [str(cell).strip() if cell else "" for cell in row]
            rows.append("| " + " | ".join(cleaned) + " |")
            if i == 0:
                rows.append("| " + " | ".join(["---"] * len(row)) + " |")
        return "\n".join(rows)
