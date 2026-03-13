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