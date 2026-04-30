import base64
import io
import logging
from typing import Any, List, Dict, Tuple
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from paddleocr import PaddleOCR

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="PP-OCRv5 service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OCR
log.info("Initialising PP-OCRv5…")
_ocr = PaddleOCR(
    text_detection_model_name="PP-OCRv5_server_det",
    text_recognition_model_name="PP-OCRv5_server_rec",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)
log.info("PP-OCRv5 ready.")


def decode_image(src: str) -> np.ndarray:
    """Decode base64 image to numpy array."""
    _, b64 = src.split(",", 1)
    img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    return np.array(img)


def parse_ppocr_result(results: List) -> Tuple[str, List[Dict[str, Any]]]:
    """Parse PP-OCRv5 results correctly."""
    line_data = []
    all_texts = []
    
    for result in results:
        # In PaddleOCR 3.x, each result is a dict with 'res' key
        if hasattr(result, 'res'):
            data = result.res
        else:
            data = result
            
        if not isinstance(data, dict):
            log.warning(f"Unexpected result type: {type(data)}")
            continue
        
        # Get detection boxes and recognition results
        # The keys are 'dt_polys', 'rec_texts', 'rec_scores'
        boxes = data.get('dt_polys', [])
        texts = data.get('rec_texts', [])
        scores = data.get('rec_scores', [])
        
        log.info(f"Found {len(boxes)} boxes, {len(texts)} texts")
        
        # Convert numpy arrays if needed
        if isinstance(boxes, np.ndarray):
            boxes = boxes.tolist()
        
        for i, box in enumerate(boxes):
            if i >= len(texts):
                break
                
            text = texts[i]
            score = scores[i] if i < len(scores) else 0.0
            
            # Convert box to 4-point polygon
            if isinstance(box, np.ndarray):
                box = box.tolist()
            
            # Box is already list of 4 points
            polygon = []
            for point in box[:4]:  # Take first 4 points
                if isinstance(point, (list, tuple)) and len(point) >= 2:
                    polygon.append([int(point[0]), int(point[1])])
                else:
                    polygon.append([0, 0])
            
            if text and text.strip():
                all_texts.append(text.strip())
            
            line_data.append({
                "type": "text",
                "cnt": polygon,
                "text": text,
                "confidence": float(score),
                "is_handwritten": True,
                "is_printed": False,
            })
    
    log.info(f"Parsed {len(line_data)} total entries")
    return "\n".join(all_texts), line_data


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr")
async def run_ocr(request: Request):
    try:
        body = await request.json()
        img_array = decode_image(body["src"])
        log.info(f"Image shape: {img_array.shape}")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    
    try:
        # Run inference
        results = list(_ocr.predict(img_array))
        log.info(f"Inference returned {len(results)} results")
        
        # Parse results
        text, line_data = parse_ppocr_result(results)
        
        return {
            "text": text,
            "line_data": line_data,
            "word_data": None,
        }
    except Exception as exc:
        log.exception("OCR failed")
        raise HTTPException(status_code=500, detail=str(exc))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)