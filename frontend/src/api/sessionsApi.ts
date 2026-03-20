const API_BASE = "http://localhost:8080";

export type SessionId = {
    id: number;
};

export type PhoneTokenResponse = {
    token: string;
    uploadUrl: string;
};

export type UploadSessionValidateResponse = {
    sessionId: number;
};

function requireJwt() {
    const token = localStorage.getItem("jwt");
    if (!token) {
        throw new Error("Not authenticated");
    }
    return token;
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

export async function createPhoneToken(sessionId: number): Promise<PhoneTokenResponse> {
    const jwt = requireJwt();

    const response = await fetch(`${API_BASE}/sessions/${sessionId}/phoneToken`, {
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

export async function validateUploadToken(token: string): Promise<UploadSessionValidateResponse> {
    const response = await fetch(`${API_BASE}/uploadSession/validate?id=${encodeURIComponent(token)}`, {
        method: "GET",
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
}

export async function deleteSession(sessionId: number): Promise<void> {
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

