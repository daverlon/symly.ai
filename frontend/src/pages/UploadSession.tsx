import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { validateUploadToken } from "../api/sessionsApi";

const LOCAL_TOKEN_KEY = "mobileUploadSessionToken";
const LOCAL_SESSION_ID_KEY = "mobileUploadSessionSessionId";

export default function UploadSession() {
    const [searchParams] = useSearchParams();
    const token = useMemo(() => searchParams.get("key") ?? "", [searchParams]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);

    useEffect(() => {
        const cachedToken = localStorage.getItem(LOCAL_TOKEN_KEY);
        const cachedSessionId = localStorage.getItem(LOCAL_SESSION_ID_KEY);

        // MVP semantics: validate once, then trust cached state while token remains in browser storage.
        if (token && cachedToken && cachedSessionId && token === cachedToken) {
            setSessionId(Number(cachedSessionId));
            setLoading(false);
            return;
        }

        if (!token) {
            setError("Missing session token.");
            setLoading(false);
            return;
        }

        validateUploadToken(token)
            .then((res) => {
                setSessionId(res.sessionId);
                localStorage.setItem(LOCAL_TOKEN_KEY, res.token);
                localStorage.setItem(LOCAL_SESSION_ID_KEY, String(res.sessionId));
                setLoading(false);
            })
            .catch((e) => {
                const msg = e instanceof Error ? e.message : "Failed to connect session.";
                setError(msg);
                setLoading(false);
            });
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
                Connecting…
            </div>
        );
    }

    if (error || sessionId == null) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-700">
                <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white/70 p-6">
                    <div className="text-lg font-semibold mb-2">Couldn’t connect</div>
                    <div className="text-sm text-slate-600">{error ?? "Invalid token."}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start p-6">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/70 p-6">
                <div className="text-xs tracking-wide text-slate-500 mb-1">Homework upload</div>
                <div className="text-xl font-semibold text-slate-900">Connected to session</div>
                <div className="text-2xl font-semibold text-blue-600 mt-2">Session {sessionId}</div>

                <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
                    Mobile photo upload UI will be added next. For now, the session token validation is
                    working.
                </div>
            </div>
        </div>
    );
}

