const API_BASE = "http://localhost:8080";

type SignupResponse = {
    message: string
}

type LoginResponse = {
  token: string
}

type AuthVerificationResponse = {
    username: string
}

type UploadSessionDto = {
    publicId: string,
    expiry: string,
    username: string
}

type SessionDto = {
    message: string,
    creationDate: string
}

export async function signupAccount(username: string, password: string): Promise<SignupResponse> {
    const response = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({username, password})
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }
    return await response.json();
}

export async function loginAccount(username: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({username, password})
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }
    return await response.json();
}

export async function verifyToken(token: string): Promise<AuthVerificationResponse> {
    const response = await fetch(`${API_BASE}/auth/verify`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }
    return await response.json();
}

export async function getSessionData(token: string | null, publicSessionId: string): Promise<SessionDto> {

    if (!token) {
        throw new Error("No token in getSessionData");
    }

    const response = await fetch(`${API_BASE}/sessions/${publicSessionId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }

    return await response.json();
}

export async function getUploadSessionData(urlKey: string): Promise<UploadSessionDto> {
    
    const response = await fetch(`${API_BASE}/u/${urlKey}`, {
        method: 'GET',
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }
    return await response.json();
}

export function getSessionEventSource(publicSessionId: string | null): EventSource | null {
    const u = `${API_BASE}/stream/${publicSessionId}`;
    console.log("Setting sse for " + u)
    if (publicSessionId) { 
        return new EventSource(u);
    }
    else {
        return null;
    }
}