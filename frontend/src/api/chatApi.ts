import { API_BASE, authHeaders } from "./client";

export type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

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
