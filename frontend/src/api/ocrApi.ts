import { API_BASE, authHeaders } from "./client";

export type OcrResult = {
    text: string | null;
    lineData: unknown | null;   // raw Mathpix line_data array — spatial bounding boxes per line
    wordData: unknown | null;   // raw Mathpix word_data array — word-level bounding boxes
    mathpixText: string | null;
    ppocrText: string | null;
    mathpixLineData: unknown | null;
    mathpixWordData: unknown | null;
    mergedRawOutput: unknown | null;
    expressionRawOutput: unknown | null;
};

export async function clearDeskImageOcr(sessionId: string, uid: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/desk-images/${uid}/ocr`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
}

export async function getDeskImageOcr(sessionId: string, uid: string): Promise<OcrResult> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/desk-images/${uid}/ocr`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return {
        text: data.text ?? null,
        // Support both legacy snake_case and current camelCase backend payloads
        lineData: data.line_data ?? data.lineData ?? null,
        wordData: data.word_data ?? data.wordData ?? null,
        mathpixText: data.mathpixText || null,
        ppocrText: data.ppocrText || null,
        mathpixLineData: data.mathpixLineData ?? null,
        mathpixWordData: data.mathpixWordData ?? null,
        mergedRawOutput: data.mergedRawOutput ?? null,
        expressionRawOutput: data.expressionRawOutput ?? null,
    };
}
