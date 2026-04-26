import { API_BASE, getToken, requireToken } from "./client";

export { API_BASE, requireToken as requireJwt };

type SignupResponse = { message: string };
type LoginResponse = { token: string };
type AuthVerificationResponse = { username: string };

export async function signupAccount(username: string, password: string): Promise<SignupResponse> {
    const res = await fetch(`${API_BASE}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function loginAccount(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function verifyToken(token: string): Promise<AuthVerificationResponse> {
    const res = await fetch(`${API_BASE}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export function getSessionEventSource(publicSessionId: string | null): EventSource | null {
    if (!publicSessionId) return null;
    return new EventSource(`${API_BASE}/stream/${publicSessionId}`);
}
