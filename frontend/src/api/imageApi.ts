const API_BASE = "http://localhost:8080";

type ImageUploadResponseDto = {
    responseText: string
}

export async function uploadImageFile(uploadKey: string, file: File): Promise<ImageUploadResponseDto> {


    // public session id


    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/u/${uploadKey}`, {
        method: 'POST',
        headers: {
            // 'Content-Type': ''
        },
        body: formData
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }
    return await response.json();
}