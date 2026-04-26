import { API_BASE } from "./client";

type UploadSessionDto = {
    publicId: string;
    expiry: string;
    username: string;
};

export async function getUploadSessionData(urlKey: string): Promise<UploadSessionDto> {
    const res = await fetch(`${API_BASE}/u/${urlKey}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
