import { useEffect, useState } from "react";
import { listSessions, type SessionId } from "../api/sessionsApi";
import { isAuthError } from "../api/apiErrors";

export function useSessionList(
    isSidebarOpen: boolean,
    onAuthError: () => void,
) {
    const [sessions, setSessions] = useState<SessionId[]>([]);

    useEffect(() => {
        if (!isSidebarOpen) return;
        listSessions()
            .then((fetched) => {
                const sorted = fetched
                    .slice()
                    .sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
                setSessions(sorted);
            })
            .catch((e) => {
                if (isAuthError(e)) {
                    setSessions([]);
                    onAuthError();
                    return;
                }
                console.error(e);
            });
    }, [isSidebarOpen]); // onAuthError intentionally excluded — stable via useCallback at call site

    return { sessions, setSessions };
}
