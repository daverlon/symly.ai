import { API_BASE } from "./accountsApi";

type UploadSessionDto = {
    publicId: string,
    expiry: string,
    username: string
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