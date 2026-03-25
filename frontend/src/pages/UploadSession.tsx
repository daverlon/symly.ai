import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {  } from "../api/sessionsApi";
import { getUploadSessionData } from "../api/accountsApi";



export default function UploadSession() {

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionExpiry, setSessionExpiry] = useState<string | null>(null);
    const [sessionUsername, setSessionUsername] = useState<string | null>(null);

    const [invalidSession, setInvalidSession] = useState(false);

    const navigate = useNavigate();

    const { uploadKey } = useParams<{ uploadKey: string }>();

    useEffect(() => {
        async function fetchData() {
            if (!uploadKey) {
                setInvalidSession(true);
                return;
            }
            try {
                const sessionData = await getUploadSessionData(uploadKey);
                setSessionId(sessionData.publicId);
                setSessionExpiry(sessionData.expiry);
                setSessionUsername(sessionData.username);
                setLoading(false);
            } catch (e) {
                setInvalidSession(true);
                return;
            }
        }

        fetchData();
    }, [uploadKey]);

    if (loading && !invalidSession) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
                Connecting…
            </div>
        );
    }

    if (error || sessionId == null || invalidSession) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-700">
                <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white/70 p-6">
                    <div className="text-lg font-semibold mb-2">Couldn’t connect</div>
                    <div className="text-sm text-slate-600">{error ?? "Invalid URL"}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start p-6">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/70 p-6">
                <div className="text-xs tracking-wide text-slate-500 mb-1">Homework upload</div>
                <div className="text-2xl font-semibold text-blue-600 mt-2">{sessionId}</div>
                <div className="text-l font-semibold text-slate-500 mt-2">Expires: {sessionExpiry}</div>
                <div className="text-l font-semibold text-slate-500 mt-2">Owner: {sessionUsername}</div>

                <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
                    Mobile photo upload UI will be added next. For now, the session token validation is
                    working.
                </div>
            </div>
        </div>
    );
}

