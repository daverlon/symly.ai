const API_BASE = "http://localhost:8080/api";

export async function signupAccount(username: string, password: string): Promise<string> {
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
    return await response.text();
}

export async function loginAccount(username: string, password: string): Promise<string> {
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
    return await response.text();
}