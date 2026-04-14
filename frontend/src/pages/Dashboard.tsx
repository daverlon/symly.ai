import { act, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { getSessionEventSource, verifyToken } from "../api/accountsApi"
import { createUploadSessionKey, createSession, deleteAllSessions, deleteSession, listSessions, type SessionId, getSessionData } from "../api/sessionsApi"
import { QRCodeSVG } from "qrcode.react"
import { Menu, Plus, X } from "lucide-react"
import { fetchSessionImages, type DeskImage, type SessionImage } from "../api/imageApi"
import ImagePanel from "./ImagePanel"
import { Images, Sparkles, Camera, LogOut } from "lucide-react";
import { saveDeskImage } from "../api/deskImageApi"
import { useCanvas } from "../hooks/useCanvas"
import { useEventSource } from "../hooks/useEventSource"
import { useEscapeKeyHandler } from "../hooks/useEscapeKeyHandler"
import { useCheckToken } from "../hooks/useCheckToken"
import { useMouseDrag } from "../hooks/useMouseDrag"
import { useResetLoadedDeskImageCount } from "../hooks/useResetLoadedDeskImageCount"
import { useHydrateSessionImages } from "../hooks/useHydrateSessionImages"
import { useLoadSessionImages } from "../hooks/useLoadSessionImages"
import { useHandleSessionChange } from "../hooks/useHandleSessionChange"
import { useSessionList } from "../hooks/useSessionList"
import { useLoadSessionData } from "../hooks/useLoadSessionData"


export default function Dashboard() {

    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const deskImageRefs = useRef<Record<string, HTMLImageElement | null>>({});

    const deskScrollRef = useRef<HTMLDivElement | null>(null);

    const deskImagesLoadedCount = useRef(0);



    const [loading, setLoading] = useState(true);
    const [qrOpen, setQrOpen] = useState(false);
    const [phoneToken, setPhoneToken] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);


    const {sessions, setSessions} = useSessionList(sidebarOpen);

    const { sessionId } = useParams<{ sessionId: string }>();

    const activeSessionId = sessionId ?? null;

    const [previewImage, setPreviewImage] = useState<string | null>(null); // uses the blobUrl

    const [deskImages, setDeskImages] = useState<DeskImage[]>([]);

    const [imagePanelOpen, setImagePanelOpen] = useState<boolean>(false);

    const [selectedDeskImage, setSelectedDeskImage] = useState<string | null>(null);


    // const {username, setUsername} = useCheckToken(navigate, setLoading);
    useCheckToken(navigate, setLoading);

    const clearSessionState = useCallback(() => {
        setImagePanelOpen(false);
        setQrOpen(false);
        setSessionImages([]);
        setDeskImages([]);
        setSelectedDeskImage(null);
        setPreviewImage(null);
        setBlobUrls(prev => {
            Object.values(prev).forEach(URL.revokeObjectURL);
            return {};
        });
    }, []);
    useHandleSessionChange(
        navigate,
        activeSessionId,
        setLoading,
        clearSessionState,
    );

    const { sessionImages, setSessionImages } = useLoadSessionImages(activeSessionId);
    useEventSource(activeSessionId, setSessionImages);

    const { blobUrls, setBlobUrls } = useHydrateSessionImages(sessionImages);
    useLoadSessionData(activeSessionId, setDeskImages, setLoading);
    useResetLoadedDeskImageCount(deskImagesLoadedCount, deskImages);

    useCanvas(canvasRef, loading);

    useEscapeKeyHandler(
        previewImage, 
        setPreviewImage, 
        imagePanelOpen, 
        setImagePanelOpen,
        selectedDeskImage,
        setSelectedDeskImage
    );
    useMouseDrag(deskScrollRef, deskImages);

    async function addDeskImage(deskImage: DeskImage) {
        // assuming desk image data passed into this function is valid

        if (!sessionId) return;

        setDeskImages((prev) => {
            return [...prev, deskImage]
        });
        if (deskImages.length > 0) {
            const firstImg = deskImages.at(0);
            deskImageRefs.current[firstImg!.name]?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center",
            });
        }
        //

        try {
            const res = saveDeskImage(sessionId, deskImage);

        } catch (e) {
            alert("Failed to save desk image to session.");
        }
    }

    async function handleSignOut() {
        localStorage.removeItem("jwt");
        navigate("/login");
    }

    const mobileUploadUrl = useMemo(() => {
        if (!phoneToken) return "";
        return `${window.location.origin}/u/${encodeURIComponent(phoneToken)}`;
    }, [phoneToken]);

    async function handleCreateSession() {
        try {
            await createSession(); // create it on the server
            const refreshedSessions = await listSessions(); // fetch the full, updated list
            setSessions(
                refreshedSessions.sort(
                    (a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()
                )
            );
            if (refreshedSessions.length > 0) {
                // changeSession(refreshedSessions[0].id); // optionally select the newest
                navigate("/dashboard")
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to create session.";
            alert(msg);
        }
    }

    async function handleConnectPhone() {
        if (activeSessionId == null) return;

        try {
            const res = await createUploadSessionKey(activeSessionId);
            setPhoneToken(res.key);
            setQrOpen(true);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to connect phone.";
            alert(msg);
        }
    }

    async function handleDeleteSession(sessionId: string) {
        const ok = window.confirm(`Delete session ${sessionId}?`);
        if (!ok) return;

        try {
            await deleteSession(sessionId);

            const updatedSessions = await listSessions();
            setSessions(updatedSessions);

            navigate("/dashboard");

        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete session.";
            alert(msg);
        }
    }

    async function handleDeleteAllSessions() {
        if (!sessions.length) return;

        const ok = window.confirm(`Delete all ${sessions.length} sessions?`);
        if (!ok) return;

        try {
            await deleteAllSessions();
            navigate("/dashboard");
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete sessions.";
            alert(msg);
        }
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
            <header className="h-14 flex items-center justify-between px-6 border-b border-slate-200 bg-white/70">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setSidebarOpen((v) => !v)}
                        className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-200"
                        aria-label="Open sessions sidebar"
                    >
                        <Menu size={18} className="text-slate-700" />
                    </button>
                    <div className="text-sm text-slate-600 cursor-pointer" onClick={() => navigate("/dashboard")}>symly.ai</div>
                    <button
                        onClick={() => setImagePanelOpen(v => !v)}
                        disabled={activeSessionId == null}
                        className="relative w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Images size={18} className="text-slate-700" />

                        {!imagePanelOpen && (
                            <div className="absolute bottom-1 right-1 w-2 h-2 bg-slate-400 rounded-full" />
                        )}
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleConnectPhone}
                        disabled={activeSessionId == null}
                        className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Camera"
                    >
                        <Camera size={18} className="text-slate-700" />
                    </button>
                    <button
                        onClick={handleSignOut}
                        className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-200"
                        aria-label="Sign out"
                    >
                        <LogOut size={18} className="text-slate-700" />
                    </button>
                </div>
            </header>

            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-slate-900/20"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside
                className={`fixed left-0 top-14 z-40 w-72 h-[calc(100vh-3.5rem)] bg-white/95 backdrop-blur border-r border-slate-200 transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
                aria-label="Sessions sidebar"
            >
                <div className="h-full flex flex-col">
                    <div className="p-4 border-b border-slate-200">
                        <button
                            onClick={handleCreateSession}
                            className="w-full rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-500 flex items-center gap-2 justify-center"
                        >
                            <Plus size={16} />
                            New session
                        </button>
                    </div>

                    <div className="p-2 flex-1 overflow-y-auto">
                        {sessions.map((s) => (
                            <div
                                key={s.id}
                                className={`group flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer ${activeSessionId === s.id
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-slate-700 hover:bg-slate-50"
                                    }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigate("/dashboard/s/"+s.id);
                                        setSidebarOpen(false);
                                    }}
                                    className="flex-1 text-left"
                                >
                                    {`${s.id} (${new Date(s.creationDate).toLocaleString()})`}                                </button>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteSession(s.id);
                                    }}
                                    className="ml-2 px-2 py-1 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-700"
                                    aria-label={`Delete session ${s.id}`}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="p-2 border-t border-slate-200">
                        <button
                            onClick={handleDeleteAllSessions}
                            disabled={!sessions.length}
                            className="w-full rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Delete all sessions
                        </button>
                    </div>
                </div>
            </aside>

            <main className="relative flex-1 overflow-hidden" onClick={() => setImagePanelOpen(false)}>

                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                />
                {!activeSessionId && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-8 text-center shadow-sm">
                            <div className="text-lg font-semibold text-slate-800">
                                No session selected
                            </div>
                            <div className="text-sm text-slate-600 mt-2">
                                Select a session from the sidebar or create a new one to get started.
                            </div>

                            <button
                                onClick={handleCreateSession}
                                className="mt-5 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-500"
                            >
                                Create new session
                            </button>
                        </div>
                    </div>
                )}

                {deskImages.length > 0 && (
                    <div
                        ref={deskScrollRef}
                        className="absolute inset-0 overflow-x-auto overflow-y-hidden"
                        onClick={() => setSelectedDeskImage(null)}
                    >
                        <div className="flex h-full items-center gap-10 w-max">
                            <div className="shrink-0 w-[40vw]" />

                            {deskImages.map((img) => {
                                const src = blobUrls[img.name];
                                const isSelected = selectedDeskImage === img.name;

                                return (
                                    <div
                                        key={img.name}
                                        className="relative group flex-shrink-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setImagePanelOpen(false);
                                            if (isSelected) return;
                                            setSelectedDeskImage(img.name);
                                            deskImageRefs.current[img.name]?.scrollIntoView({
                                                behavior: "smooth",
                                                block: "nearest",
                                                inline: "center",
                                            });
                                        }}
                                    >
                                        <div className={`relative transition-all duration-200 rounded-lg overflow-hidden
                            ${isSelected
                                                ? 'outline outline-2 outline-blue-400 shadow-xl'
                                                : 'outline outline-1 outline-transparent hover:outline-slate-300 hover:shadow-md'
                                            }`}
                                        >
                                            <img
                                                ref={(el) => { deskImageRefs.current[img.name] = el; }}
                                                src={src || ""}
                                                className="h-[80vh] w-auto object-contain block"
                                                alt={img.name}
                                                onLoad={() => {
                                                    deskImagesLoadedCount.current += 1;
                                                    if (deskImagesLoadedCount.current >= deskImages.length) {
                                                        const container = deskScrollRef.current;
                                                        if (!container) return;
                                                        container.scrollTo({
                                                            left: (container.scrollWidth - container.clientWidth) / 2,
                                                            behavior: "smooth",
                                                        });
                                                    }
                                                }}
                                            />
                                        </div>

                                        {isSelected && (
                                            <div
                                                className="absolute -top-12 left-1/2 -translate-x-1/2 
        bg-white rounded-xl shadow-xl border border-slate-200 
        flex items-center gap-0.5 p-1 z-20"

                                            >
                                                <button
                                                    className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-all active:scale-95"
                                                    title="Chat with AI"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Sparkles size={16} />
                                                </button>

                                                <div className="w-px h-5 bg-slate-200 mx-0.5" />

                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeskImages(prev => prev.filter(x => x.name !== img.name));
                                                        setSelectedDeskImage(null);
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white 
            text-slate-700 rounded-lg transition-all active:scale-95"
                                                    title="Remove from desk"
                                                >
                                                    <X size={16} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <div className="shrink-0 w-[40vw]" />
                        </div>
                    </div>
                )}

                <div
                    className="fixed top-14 left-0 right-0 z-20 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className={`
            bg-white border-b border-slate-200 
            transition-transform duration-300 ease-out
            ${imagePanelOpen ? 'translate-y-0' : '-translate-y-full'}
        `}
                    >
                        <ImagePanel
                            images={sessionImages}
                            onSelect={(blobUrl) => {
                                if (!previewImage) setPreviewImage(blobUrl);
                            }}
                            onAddToDesk={(img) => {
                                addDeskImage(img);
                                // scroll to it after render
                                setTimeout(() => {
                                    deskImageRefs.current[img.name]?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "nearest",
                                        inline: "center",
                                    });
                                }, 0);
                            }}
                        />
                    </div>
                </div>
            </main>

            {qrOpen && phoneToken && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-6"
                    onClick={() => setQrOpen(false)}
                >
                    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white/90 backdrop-blur p-5 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">Connect phone</div>
                                <div className="text-xs text-slate-600">Scan to open the upload page</div>
                            </div>
                        </div>

                        <div className="mt-5 flex items-center justify-center">
                            <QRCodeSVG value={mobileUploadUrl} size={190} />
                        </div>

                        <a
                            href={mobileUploadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 block text-center text-sm text-blue-700 underline break-all"
                        >
                            {mobileUploadUrl}
                        </a>
                    </div>
                </div>
            )}

            {previewImage && (
                <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-6"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-5xl w-full flex items-center justify-center"
                    >
                        {/* Image */}
                        <img
                            src={previewImage}
                            alt="Preview"
                            className="max-h-[90vh] max-w-full rounded-xl shadow-2xl object-contain"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}