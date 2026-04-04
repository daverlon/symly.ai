const API_BASE = "http://localhost:8080";

type ImageUploadResponseDto = {
    responseText: string
}

export type SessionImage = {
    name: string,
    image: File,
    uploadDate: string,

    // todo: image size?
    // tags?
};

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

export async function fetchSessionImages(token: string, publicSessionId: string): Promise<SessionImage[]> {

    const response = await fetch(`${API_BASE}/sessions/${publicSessionId}/images`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }

    if (response.status == 204) {
        // no images
        console.log("No images found for session.");
        return []; 
    }

    return await response.json();
}

// for received events
export async function fetchSingleSessionImage(token: string, publicSessionId: string, imageName: string): Promise<SessionImage> {

      const u = `${API_BASE}/sessions/${publicSessionId}/images/${imageName}`;
      console.log(`Fetching single image from ${u}`);
      const response = await fetch(u, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }

    return await response.json();
}