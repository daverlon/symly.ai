import { API_BASE, authHeaders } from "./client";

export type SessionImage = {
    name: string;
    uploadDate: string;
    url: string;
};

export type DeskImage = {
    name: string;
    position: number;
    uid: string;
};

export async function uploadImageFile(uploadKey: string, file: File): Promise<{ responseText: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/u/${uploadKey}`, { method: "POST", body: formData });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function fetchSessionImages(token: string, publicSessionId: string): Promise<SessionImage[]> {
    const res = await fetch(`${API_BASE}/sessions/${publicSessionId}/images`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) return [];
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
