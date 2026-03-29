import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {  } from "../api/sessionsApi";
import { getUploadSessionData } from "../api/accountsApi";
import { uploadImageFile } from "../api/imageApi";



export default function UploadSession() {

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionExpiry, setSessionExpiry] = useState<string | null>(null);
    const [sessionUsername, setSessionUsername] = useState<string | null>(null);

    const [invalidSession, setInvalidSession] = useState(false);

    const navigate = useNavigate();

    const { uploadKey } = useParams<{ uploadKey: string }>();

    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            setFile(selected);
            console.log("Selected file:", selected);
        }
    };

    async function onFileUpload() {
        setLoading(true);
        if (!uploadKey) {
            console.error("Cannot upload file without upload key");
            return;
        }
        if (!file) {
            console.error("Canont upload file without file");
            return;
        }
        const res = uploadImageFile(uploadKey, file);
        alert((await res).responseText);

        setLoading(false);
    }

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
                    <div className="text-sm text-slate-600">{error ?? "Invalid session"}</div>
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
                <br></br>

                <div className="p-4">
                    <label
                        htmlFor="fileInput"
                        className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700"
                    >
                        Add file or take photo
                    </label>
                    <input
                        id="fileInput"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFileChange}
                    />

                    {file && (
                        <div className="mt-2">
                            <p className="text-gray-700">Selected file: {file.name}</p>
                            <button className="mt-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            onClick={onFileUpload}
                            >
                                Upload
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

