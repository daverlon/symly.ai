"""
Minimal PP-OCRv5 HTTP service.

Returns per-visual-line bounding boxes in the same format the Spring Boot
backend already consumes from Mathpix (text + line_data + word_data), so the
backend needs no format changes — only the routing URL.

POST /ocr
  body: {"src": "data:image/jpeg;base64,..."}
  returns: {"text": "...", "line_data": [...], "word_data": [...]}

GET /health
  returns: {"status": "ok"}
"""

import base64
import io
import logging

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="PP-OCRv5 service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── PaddleOCR singleton (models downloaded on first init) ─────────────────────

_ocr = None


def get_ocr():
    global _ocr
    if _ocr is None:
        from paddleocr import PaddleOCR

        log.info("Initialising PaddleOCR — models will be downloaded if not cached…")
        # PaddleOCR 3.x removed use_gpu / use_angle_cls
        _ocr = PaddleOCR(lang="en")
        log.info("PaddleOCR ready.")
    return _ocr


# ── Helpers ───────────────────────────────────────────────────────────────────


def decode_image(src: str) -> np.ndarray:
    """Decode a data-URI image string into a numpy RGB array."""
    if "," not in src:
        raise ValueError("src must be a data-URI")
    _, b64 = src.split(",", 1)
    raw = base64.b64decode(b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(img)


def box_to_cnt(box) -> list[list[int]]:
    """Convert PaddleOCR box ([[x,y]×4]) to integer cnt list (TL, TR, BR, BL)."""
    return [[int(pt[0]), int(pt[1])] for pt in box]


def _as_dict(x) -> dict | None:
    if x is None:
        return None
    if isinstance(x, dict):
        return x
    to_dict = getattr(x, "to_dict", None) or getattr(x, "json", None)
    if callable(to_dict):
        try:
            d = to_dict()
            return d if isinstance(d, dict) else None
        except Exception:
            return None
    return None


def _rec_box_to_poly(box) -> list[list[int]]:
    """[x1,y1,x2,y2] → quadrilateral in TL,TR,BR,BL order."""
    b = _to_python(box)
    x1, y1, x2, y2 = (int(x) for x in b[:4])
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]


def _to_python(x):
    """numpy arrays → nested lists. Never use `arr or dflt` on ndarray — bool is undefined."""
    if x is None:
        return None
    if hasattr(x, "tolist"):
        return x.tolist()
    return x


def _entries_from_pr_dict(pr: dict) -> list[tuple] | None:
    """Build (box, text, score) from a PP-OCRv5 prunedResult dict."""
    texts = _to_python(pr.get("rec_texts"))
    if not texts:
        return None
    sr = pr.get("rec_scores")
    scores: list = _to_python(sr) if sr is not None else []
    if not isinstance(scores, list):
        scores = list(scores)
    while len(scores) < len(texts):
        scores.append(0.0)
    p = pr.get("rec_polys")
    if p is None:
        p = pr.get("dt_polys")
    polys = _to_python(p)
    if polys is None:
        polys = []
    b = pr.get("rec_boxes")
    boxes = _to_python(b)
    if boxes is None:
        boxes = []
    out: list[tuple] = []
    for i, text in enumerate(texts):
        score = float(scores[i] if i < len(scores) else 0.0)
        raw_poly = polys[i] if i < len(polys) else None
        poly = _to_python(raw_poly) if raw_poly is not None else None
        if (not poly) and i < len(boxes) and boxes[i] is not None:
            bx = _to_python(boxes[i])
            if bx:
                poly = _rec_box_to_poly(bx)
        if not poly:
            poly = []
        out.append((poly, text, score))
    return out


def extract_entries_from_first(first) -> list[tuple]:
    """
    Normalise whatever PaddleOCR.predict() / PP-OCRv5 returns into
    list of (box, text, confidence).

    Documented PP-OCRv5 JSON shape (cloud / 3.x pipeline)::

        { "ocrResults": [ { "prunedResult": { rec_texts, rec_scores, rec_polys } } ], ... }
    """
    d = _as_dict(first)
    if d is not None:
        # Top-level ocrResults (full PP-OCRv5 / pipeline JSON)
        ocr_results = d.get("ocrResults")
        if ocr_results and isinstance(ocr_results, list) and ocr_results:
            inner = ocr_results[0]
            inner_d = inner if isinstance(inner, dict) else _as_dict(inner)
            if isinstance(inner_d, dict):
                if "prunedResult" in inner_d:
                    pr = _as_dict(inner_d["prunedResult"]) or inner_d["prunedResult"]
                    if isinstance(pr, dict):
                        e = _entries_from_pr_dict(pr)
                        if e:
                            return e
                if "rec_texts" in inner_d:
                    e = _entries_from_pr_dict(inner_d)
                    if e:
                        return e

        if "prunedResult" in d:
            pr = _as_dict(d["prunedResult"]) or d["prunedResult"]
            if isinstance(pr, dict):
                e = _entries_from_pr_dict(pr)
                if e:
                    return e

        if "rec_texts" in d:
            e = _entries_from_pr_dict(d)
            if e:
                return e

    # 3.x pipeline object: rec_polys (aligned with rec_texts) > det_polys
    if hasattr(first, "rec_texts") and first.rec_texts is not None:
        d_obj = _as_dict(first)
        if d_obj and d_obj.get("rec_texts"):
            e = _entries_from_pr_dict(d_obj)
            if e:
                return e
        texts  = first.rec_texts
        scores = getattr(first, "rec_scores", None) or [0.0] * len(texts)
        polys  = getattr(first, "rec_polys", None) or getattr(first, "det_polys", None) or [[]] * len(texts)
        return [
            (polys[i] if i < len(polys) else [], texts[i], float(scores[i] if i < len(scores) else 0.0))
            for i in range(len(texts))
        ]

    return []


# ── Endpoints ─────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def run_ocr(request: Request):
    # Read raw body directly — avoids Pydantic model-binding issues with large payloads
    try:
        body = await request.json()
        src = body["src"]
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse request body: {exc}") from exc

    # Decode image
    try:
        img_array = decode_image(src)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    ocr = get_ocr()

    try:
        # PaddleOCR 3.x uses predict() which returns a generator; 2.x uses ocr()
        if hasattr(ocr, "predict"):
            raw = list(ocr.predict(img_array))  # materialise generator
        else:
            raw = ocr.ocr(img_array, cls=True)
    except Exception as exc:
        log.exception("OCR inference failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not raw:
        return {"text": "", "line_data": [], "word_data": []}

    if not isinstance(raw, (list, tuple)):
        raw = [raw]

    log.info("OCR raw type=%s len=%s", type(raw).__name__, len(raw))
    for i, chunk in enumerate(raw):
        d = _as_dict(chunk) if not isinstance(chunk, (list, tuple)) else None
        key_preview = list(d.keys())[:8] if d else str(type(chunk).__name__)
        log.info("OCR raw[%d] keys/preview: %s", i, key_preview)

    # PP-OCRv5: ocrResults[0].prunedResult, or flat prunedResult, or object attrs
    entries: list[tuple] = []
    for chunk in raw:
        entries.extend(extract_entries_from_first(chunk))

    if not entries and raw and isinstance(raw[0], list):
        # PaddleOCR 2.x: first element is a page of [[box, (text, conf)], …]
        for item in raw[0]:
            try:
                box, (text, confidence) = item
                entries.append((box, text, float(confidence)))
            except Exception:
                continue

    if not entries:
        return {"text": "", "line_data": [], "word_data": []}

    text_lines: list[str] = []
    line_data: list[dict] = []

    for box, text, confidence in entries:
        if not box or len(box) < 2:
            continue
        cnt = box_to_cnt(box)
        text_lines.append(text)
        line_data.append(
            {
                "type": "text",
                "text": text,
                "cnt": cnt,
                "is_handwritten": True,
                "is_printed": False,
                "confidence": round(confidence, 4),
            }
        )

    # word_data mirrors line_data — PP-OCRv5 already gives per-visual-line boxes
    # so line == word granularity here; the frontend clustering logic is a no-op.
    return {
        "text": "\n".join(text_lines),
        "line_data": line_data,
        "word_data": line_data,
    }
