import { useEffect, useRef } from "react";
import { getSessionEventSource } from "../api/accountsApi";
import type { SessionImage } from "../api/imageApi";

export function useEventSource(
    activeSessionId: string | null, 
    setSessionImages: React.Dispatch<React.SetStateAction<SessionImage[]>>
) {

    const sseRef = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!activeSessionId) {
            sseRef.current?.close();
            sseRef.current = null;
            return;
        }

        sseRef.current?.close();
        const sse = getSessionEventSource(activeSessionId);
        sseRef.current = sse;

        const handleOpen = () => {
            console.log("SSE connected successfully");
        };

        const handleMessage = (event: MessageEvent) => {
            const data = JSON.parse(event.data)
            console.log(data);
            if (data.type == "image_uploaded") {
                const x = data.payload as SessionImage;
                // console.log("paylaod: " + x);
                setSessionImages(prev => [...prev, x]);
            }
            console.log("SSE message received:", event.data);
        };

        const handleError = (event: Event) => {
            console.error("SSE error:", event);
        };

        if (!sse) return;

        sse.addEventListener("message", handleMessage);
        sse.addEventListener("error", handleError);

        return () => {
            sse.removeEventListener("message", handleMessage);
            sse.removeEventListener("error", handleError);
            sse.close();
        };
    }, [activeSessionId, setSessionImages]);
}