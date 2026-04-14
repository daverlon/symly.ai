import { useEffect, useState } from "react";
import { fetchSessionImages, type SessionImage } from "../api/imageApi";


export function useLoadSessionImages(
    activeSessionId: string | null,
) {
    const [sessionImages, setSessionImages] = useState<SessionImage[]>([]);

    useEffect(() => {
        const run = async () => {

            if (!activeSessionId) return;
            const token = localStorage.getItem("jwt");
            if (!token) return;

            try {
                const images = await fetchSessionImages(token, activeSessionId);
                setSessionImages(images);
                console.log(`Loaded ${images.length} images:`);
                for (let i = 0; i < images.length; i++) {
                    const image = images.at(i);
                    if (!image) {
                        console.log(`\t[${i}] unknown`);
                        continue;
                    };
                    console.log(`\t[${i}] ${image.name}`);
                    console.log(`\t[${i}] ${image.uploadDate}`);
                    console.log(`\t[${i}] ${image.url}`);
                }

            } catch (e) {
                const msg = e instanceof Error ? e.message : "Failed to load sessions.";
                alert(msg);
            }

        }
        run();

    }, [activeSessionId] );

    return {sessionImages, setSessionImages};
}