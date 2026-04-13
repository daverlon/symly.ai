import { requireJwt } from "./accountsApi";
import type { DeskImage } from "./imageApi";

const API_BASE = "http://localhost:8080";

export type SessionId = {
    id: string;
    creationDate: string;
};

export type UploadSessionKeyResponse = {
    key: string;
    uploadUrl: string;
};

// for key -> jwt exchange
// see UploadSessionJwtDto
export type UploadSessionValidateResponse = {
    uploadSessionJwt: string;
    sessionId: number;
};

export type SessionDto = {
    creationDate: string;
    deskImages: DeskImage[];
}

export async function listSessions(): Promise<SessionId[]> {
    const jwt = requireJwt();

    const response = await fetch(`${API_BASE}/sessions`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${jwt}`,
        },
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
}

export async function createSession(): Promise<SessionId> {
    const jwt = requireJwt();

    const response = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${jwt}`,
        },
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
}

export async function createUploadSessionKey(sessionId: string): Promise<UploadSessionKeyResponse> {
    const jwt = requireJwt();

    const response = await fetch(`${API_BASE}/sessions/${sessionId}/uploadKey`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${jwt}`,
        },
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
    const jwt = requireJwt();

    const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${jwt}`,
        },
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }
}

export async function deleteAllSessions(): Promise<void> {
    const jwt = requireJwt();

    const response = await fetch(`${API_BASE}/sessions`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${jwt}`,
        },
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }
}

export async function getSessionData(sessionId: string): Promise<SessionDto> {
    const jwt = requireJwt();
    const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${jwt}`,
        },
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
}