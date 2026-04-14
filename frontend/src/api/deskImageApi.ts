import { API_BASE, requireJwt } from "./accountsApi";
import type { DeskImage } from "./imageApi";


export async function saveDeskImage(sessionId: string, img: DeskImage): Promise<string> {
    const jwt = requireJwt();

    const response = await fetch(`${API_BASE}/sessions/${sessionId}/desk-images`, {
        method: `POST`,
        headers: {
            'Authorization': `Bearer ${jwt}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(img)
    });

    if (!response.ok) { 
        throw new Error(await response.text());
    }

    return response.text();
}