import { API_BASE, requireJwt } from "./accountsApi";
import type { DeskImage } from "./imageApi";

type DeskImageResponseDto = {
    position: number
} 

export async function saveDeskImage(sessionId: string, img: DeskImage): Promise<DeskImageResponseDto> {
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

    return response.json();
}

export async function deleteDeskImage(sessionId: string, img: DeskImage): Promise<string> {
    const jwt = requireJwt();

    const response = await fetch(`${API_BASE}/sessions/${sessionId}/desk-images/${img.uid}`, {
        method: `DELETE`,
        headers: {
            'Authorization': `Bearer ${jwt}`,
        }
    });

    if (!response.ok) { 
        throw new Error(await response.text());
    }

    return response.text();
}