import { API_BASE, authHeaders } from "./client";
import type { DeskImage } from "./imageApi";

type DeskImageResponseDto = {
    position: number;
    uid: string;
};

export async function saveDeskImage(sessionId: string, img: Pick<DeskImage, "name">): Promise<DeskImageResponseDto> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/desk-images`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(img),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function moveDeskImage(sessionId: string, uid: string, afterUid: string | null): Promise<void> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/desk-images/${uid}/position`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ afterUid }),
    });
    if (!res.ok) throw new Error(await res.text());
}

export async function deleteDeskImage(sessionId: string, img: Pick<DeskImage, "uid">): Promise<void> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/desk-images/${img.uid}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
}
