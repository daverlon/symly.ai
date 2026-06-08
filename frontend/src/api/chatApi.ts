import { API_BASE, authHeaders } from "./client";

export type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

export async function getChatHistory(sessionId: string, uid: string): Promise<ChatMessage[]> {
    const res = await fetch(
        `${API_BASE}/sessions/${sessionId}/desk-images/${uid}/chat`,
        { headers: authHeaders() },
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<ChatMessage[]>;
}

export async function sendChatMessage(
    sessionId: string,
    uid: string,
    messages: ChatMessage[],
): Promise<string> {
    const res = await fetch(
        `${API_BASE}/sessions/${sessionId}/desk-images/${uid}/chat`,
        {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ messages }),
        },
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return (data.reply as string) ?? "";
}

export async function deleteChatHistory(sessionId: string, uid: string): Promise<void> {
    const res = await fetch(
        `${API_BASE}/sessions/${sessionId}/desk-images/${uid}/chat`,
        { method: "DELETE", headers: authHeaders() },
    );
    if (!res.ok) throw new Error(await res.text());
}
