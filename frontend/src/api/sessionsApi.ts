import { API_BASE, authHeaders } from "./client";
import type { DeskImage } from "./imageApi";

export type SessionId = {
    id: string;
    creationDate: string;
};

export type UploadSessionKeyResponse = {
    key: string;
    uploadUrl: string;
};

export type SessionDto = {
    creationDate: string;
    deskImages: DeskImage[];
};

export async function listSessions(): Promise<SessionId[]> {
    const res = await fetch(`${API_BASE}/sessions`, { headers: authHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function createSession(): Promise<SessionId> {
    const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function createUploadSessionKey(sessionId: string): Promise<UploadSessionKeyResponse> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/uploadKey`, {
        method: "POST",
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
}

export async function deleteAllSessions(): Promise<void> {
    const res = await fetch(`${API_BASE}/sessions`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
}

export async function getSessionData(sessionId: string): Promise<SessionDto | null> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`, { headers: authHeaders() });
    if (!res.ok) return null;
    return res.json();
}
