import { useEffect, useState } from "react";
import type { SessionImage } from "../api/imageApi";

export function useHydrateSessionImages(sessionImages: SessionImage[]) {
    const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});

    useEffect(() => {
        let cancelled = false;

        const run = async (img: SessionImage) => {
            const token = localStorage.getItem("jwt");
            if (!token) return;

            setBlobUrls(prev => {
                if (prev[img.name]) return prev;
                return prev;
            });

            const res = await fetch(img.url, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok || cancelled) return;

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            setBlobUrls(prev => ({
                ...prev,
                [img.name]: url
            }));
        };

        sessionImages.forEach(run);

        return () => {
            cancelled = true;
        };
    }, [sessionImages]);

    return { blobUrls, setBlobUrls };
}