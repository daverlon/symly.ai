import { API_BASE, authHeaders } from "./client";

export type OcrResult = {
    text: string;
    lineData?: unknown;   // raw Mathpix line_data array — spatial bounding boxes per line
    wordData?: unknown;   // raw Mathpix word_data array — word-level bounding boxes
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
        text: (data.text as string) ?? "",
        lineData: data.lineData ? JSON.parse(data.lineData as string) : undefined,
        wordData: data.wordData ? JSON.parse(data.wordData as string) : undefined,
    };
}
