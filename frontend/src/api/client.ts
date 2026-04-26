export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export function getToken(): string | null {
    return localStorage.getItem("jwt");
}

export function requireToken(): string {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");
    return token;
}

export function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${requireToken()}` };
}
