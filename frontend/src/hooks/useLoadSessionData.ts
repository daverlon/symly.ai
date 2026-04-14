import { useEffect } from "react";
import { getSessionData } from "../api/sessionsApi";
import type { DeskImage } from "../api/imageApi";

export function useLoadSessionData(
    activeSessionId: string | null,
    setDeskImages: React.Dispatch<React.SetStateAction<DeskImage[]>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
) {
    useEffect(() => {
        if (!activeSessionId) return;

        let cancelled = false;

        setLoading(true);

        const run = async () => {
            try {
                const sessionData = await getSessionData(activeSessionId);

                if (!cancelled && sessionData) {
                    setDeskImages(sessionData.deskImages ?? []);
                }
            } catch (e) {
                console.log("Failed to load session data:", e);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        run();

        return () => {
            cancelled = true; // prevents stale async updates
        };
    }, [activeSessionId]);
}