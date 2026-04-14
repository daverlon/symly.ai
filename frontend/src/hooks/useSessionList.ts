import { useEffect, useState } from "react";
import { listSessions, type SessionId } from "../api/sessionsApi";


export function useSessionList(
    isSidebarOpen: boolean
) {

    const [sessions, setSessions] = useState<SessionId[]>([]);

    useEffect(() => {
        if (!isSidebarOpen) return;
        listSessions()
            .then((fetchedSessions) => {
                // Convert to Date objects and sort newest first
                const sorted = fetchedSessions
                    .slice()
                    .sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
                setSessions(sorted);
            })
            .catch((e) => {
                const msg = e instanceof Error ? e.message : "Failed to load sessions.";
                alert(msg);
            });
    });

    return {sessions, setSessions};
}