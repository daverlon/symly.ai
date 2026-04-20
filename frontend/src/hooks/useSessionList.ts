import { useEffect, useState } from "react";
import { listSessions, type SessionId } from "../api/sessionsApi";
import { isAuthError } from "../api/apiErrors";

export function useSessionList(
    isSidebarOpen: boolean,
    openAuth: (mode: "login" | "signup") => void
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
                // const msg = e instanceof Error ? e.message : "Failed to load sessions.";
                // alert(msg);
                  if (isAuthError(e)) {
                    openAuth("login");
                    setSessions([]);
                    return;
                }
                console.error(e);
            });
    }, [isSidebarOpen, openAuth]);

    return {sessions, setSessions};
}