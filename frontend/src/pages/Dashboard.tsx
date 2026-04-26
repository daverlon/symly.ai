import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Menu, Images, Camera, LogOut, Sparkles } from "lucide-react";

import { createUploadSessionKey, createSession, deleteAllSessions, deleteSession, listSessions } from "../api/sessionsApi";
import { moveDeskImage, deleteDeskImage, saveDeskImage } from "../api/deskImageApi";
import { type DeskImage } from "../api/imageApi";
import { isAuthError } from "../api/apiErrors";

import ImagePanel from "./ImagePanel";
import LoginModal from "../components/LoginModal";
import SignupModal from "../components/SignupModal";
import { DeskStrip } from "../components/desk/DeskStrip";
import { SessionSidebar } from "../components/session/SessionSidebar";
import { AiChatPanel } from "../components/chat/AiChatPanel";

import { useCanvas } from "../hooks/useCanvas";
import { useEventSource } from "../hooks/useEventSource";
import { useEscapeKeyHandler } from "../hooks/useEscapeKeyHandler";
import { useCheckToken } from "../hooks/useCheckToken";
import { useHydrateSessionImages } from "../hooks/useHydrateSessionImages";
import { useLoadSessionImages } from "../hooks/useLoadSessionImages";
import { useHandleSessionChange } from "../hooks/useHandleSessionChange";
import { useSessionList } from "../hooks/useSessionList";
import { useLoadSessionData } from "../hooks/useLoadSessionData";
import { useRef } from "react";

export default function Dashboard() {
    const navigate = useNavigate();
    const { sessionId } = useParams<{ sessionId: string }>();
    const activeSessionId = sessionId ?? null;

    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // UI state
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [imagePanelOpen, setImagePanelOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [qrOpen, setQrOpen] = useState(false);
    const [phoneToken, setPhoneToken] = useState<string | null>(null);
    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<"login" | "signup">("login");

    // Session / desk state
    const [deskImages, setDeskImages] = useState<DeskImage[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // Chat panel
    const [chatOpen, setChatOpen] = useState(false);
    const [chatMounted, setChatMounted] = useState(false); // trails chatOpen for exit animation
    const [chatImage, setChatImage] = useState<DeskImage | null>(null);
    const [deskLayoutRevision, setDeskLayoutRevision] = useState(0);
    const [highlightRegion, setHighlightRegion] = useState<import("../components/chat/AiChatPanel").HighlightRegion>(null);

    // Auth
    const { username, setUsername, isAuthenticated, setIsAuthenticated } = useCheckToken(setLoading);

    const openAuth = useCallback((mode: "login" | "signup" = "login") => {
        setAuthMode(mode);
        setAuthOpen(true);
    }, []);

    const handleAuthError = useCallback(() => openAuth("login"), [openAuth]);

    // Data hooks
    const { sessions, setSessions } = useSessionList(sidebarOpen, handleAuthError);
    const { sessionImages, setSessionImages } = useLoadSessionImages(activeSessionId);
    const { blobUrls, setBlobUrls } = useHydrateSessionImages(sessionImages);

    const clearSessionState = useCallback(() => {
        setImagePanelOpen(false);
        setQrOpen(false);
        setChatOpen(false);
        setChatMounted(false);
        setChatImage(null);
        setSessionImages([]);
        setDeskImages([]);
        setSelectedIndex(null);
        setPreviewImage(null);
        setBlobUrls((prev) => {
            Object.values(prev).forEach(URL.revokeObjectURL);
            return {};
        });
    }, [setSessionImages, setBlobUrls]);

    function handleOpenChat(img: DeskImage) {
        setChatImage(img);
        setChatMounted(true);
        setChatOpen(true);
        setImagePanelOpen(false);
        // After the slide-in transition completes, re-center the selected image
        setTimeout(() => setDeskLayoutRevision((r) => r + 1), 320);
    }

    function handleCloseChat() {
        setChatOpen(false);
        setHighlightRegion(null);
        // Keep content mounted until the slide-out transition finishes, then unmount
        setTimeout(() => setChatMounted(false), 320);
        // Re-center selected image once the desk expands back
        setTimeout(() => setDeskLayoutRevision((r) => r + 1), 320);
    }

    useEffect(() => {
        if (isAuthenticated === false) {
            clearSessionState();
            navigate("/dashboard");
        }
    }, [isAuthenticated]);

    useHandleSessionChange(navigate, activeSessionId, setLoading, clearSessionState);
    useLoadSessionData(activeSessionId, setDeskImages, setLoading);
    useEventSource(activeSessionId, setSessionImages);
    useCanvas(canvasRef, loading);

    // Persist selected index per session so it survives session switches and refreshes
    useEffect(() => {
        if (!activeSessionId || selectedIndex === null) return;
        sessionStorage.setItem(`desk-selected:${activeSessionId}`, String(selectedIndex));
    }, [selectedIndex, activeSessionId]);

    // Restore selected index once desk images are available
    useEffect(() => {
        if (!activeSessionId || deskImages.length === 0) return;
        const stored = sessionStorage.getItem(`desk-selected:${activeSessionId}`);
        if (stored === null) return;
        const index = parseInt(stored, 10);
        if (Number.isFinite(index) && index >= 0 && index < deskImages.length) {
            setSelectedIndex(index);
        }
    }, [activeSessionId, deskImages.length]);

    useEscapeKeyHandler(
        previewImage, setPreviewImage,
        imagePanelOpen, setImagePanelOpen,
        chatOpen, handleCloseChat,
        selectedIndex, setSelectedIndex,
    );

    // ── Desk actions ──────────────────────────────────────────────────────────

    async function addDeskImage(deskImage: DeskImage) {
        if (!sessionId) return;
        const tempUid = crypto.randomUUID();

        setDeskImages((prev) => [
            ...prev,
            { ...deskImage, uid: tempUid, position: prev.length },
        ]);

        try {
            const res = await saveDeskImage(sessionId, deskImage);
            setDeskImages((prev) =>
                prev.map((img) => (img.uid === tempUid ? { ...img, ...res } : img))
            );
        } catch (e) {
            console.error("Failed to add desk image:", e);
            setDeskImages((prev) => prev.filter((img) => img.uid !== tempUid));
        }
    }

    async function removeDeskImage(deskImage: DeskImage) {
        if (!sessionId) return;
        const removedIndex = deskImages.findIndex((img) => img.uid === deskImage.uid);
        const remainingCount = deskImages.length - 1;

        setDeskImages((prev) => prev.filter((img) => img.uid !== deskImage.uid));

        if (remainingCount === 0) {
            setSelectedIndex(null);
        } else {
            // scroll left, or right if the first image was removed
            setSelectedIndex(removedIndex > 0 ? removedIndex - 1 : 0);
        }

        try {
            await deleteDeskImage(sessionId, deskImage);
        } catch (e) {
            alert("Failed to delete desk image.");
        }
    }

    async function reorderDeskImage(uid: string, afterUid: string | null) {
        if (!sessionId) return;

        // Optimistic reorder
        setDeskImages((prev) => {
            const items = [...prev];
            const fromIndex = items.findIndex((img) => img.uid === uid);
            if (fromIndex === -1) return prev;
            const [moved] = items.splice(fromIndex, 1);
            const toIndex =
                afterUid === null
                    ? 0
                    : items.findIndex((img) => img.uid === afterUid) + 1;
            items.splice(toIndex, 0, moved);
            return items;
        });
        setSelectedIndex(null);

        try {
            await moveDeskImage(sessionId, uid, afterUid);
        } catch (e) {
            console.error("Failed to reorder desk image:", e);
            // Re-fetch to restore server state on failure
            const { getSessionData } = await import("../api/sessionsApi");
            const data = await getSessionData(sessionId);
            if (data) setDeskImages(data.deskImages ?? []);
        }
    }

    // ── Session actions ───────────────────────────────────────────────────────

    function requireAuth(action: () => Promise<void> | void) {
        if (!isAuthenticated) {
            openAuth("login");
            return;
        }
        void action();
    }

    async function handleSignOut() {
        localStorage.removeItem("jwt");
        setIsAuthenticated(false);
    }

    async function handleCreateSession() {
        requireAuth(async () => {
            try {
                const created = await createSession();
                const refreshed = await listSessions();
                setSessions(
                    refreshed.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime())
                );
                navigate(`/dashboard/s/${created.id}`);
            } catch (e) {
                if (isAuthError(e)) { openAuth("login"); return; }
                console.error(e);
            }
        });
    }

    async function handleConnectPhone() {
        requireAuth(async () => {
            if (!activeSessionId) return;
            try {
                const res = await createUploadSessionKey(activeSessionId);
                setPhoneToken(res.key);
                setQrOpen(true);
            } catch (e) {
                if (isAuthError(e)) { openAuth("login"); return; }
                console.error(e);
            }
        });
    }

    async function handleDeleteSession(id: string) {
        if (!window.confirm(`Delete session ${id}?`)) return;
        try {
            await deleteSession(id);
            setSessions(await listSessions());
            navigate("/dashboard");
        } catch (e) {
            if (isAuthError(e)) { openAuth("login"); return; }
            console.error(e);
        }
    }

    async function handleDeleteAllSessions() {
        if (!sessions.length) return;
        if (!window.confirm(`Delete all ${sessions.length} sessions?`)) return;
        try {
            await deleteAllSessions();
            navigate("/dashboard");
        } catch (e) {
            if (isAuthError(e)) { openAuth("login"); return; }
            console.error(e);
        }
    }

    const mobileUploadUrl = useMemo(
        () => (phoneToken ? `${window.location.origin}/u/${encodeURIComponent(phoneToken)}` : ""),
        [phoneToken]
    );

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">

            {/* Header */}
            <header className="h-14 flex items-center justify-between px-6 border-b border-slate-200 bg-white/70" onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a")) setImagePanelOpen(false); }}>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            if (!isAuthenticated) { openAuth("login"); return; }
                            setSidebarOpen((v) => !v);
                        }}
                        className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-200"
                        aria-label="Open sessions sidebar"
                    >
                        <Menu size={18} className="text-slate-700" />
                    </button>
                    <button
                        className="text-sm text-slate-600"
                        onClick={() => navigate("/dashboard")}
                    >
                        symly.ai
                    </button>
                    <button
                        onClick={() => setImagePanelOpen((v) => !v)}
                        disabled={activeSessionId == null}
                        className="relative w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Images size={18} className="text-slate-700" />
                        {!imagePanelOpen && (
                            <div className="absolute bottom-1 right-1 w-2 h-2 bg-slate-400 rounded-full" />
                        )}
                    </button>
                    <button
                        onClick={handleConnectPhone}
                        disabled={activeSessionId == null}
                        className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Connect phone"
                    >
                        <Camera size={18} className="text-slate-700" />
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        disabled={selectedIndex === null}
                        onClick={() => {
                            if (selectedIndex !== null) handleOpenChat(deskImages[selectedIndex]);
                        }}
                        className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Ask AI about selected image"
                        title={selectedIndex === null ? "Select an image to ask AI" : "Ask AI"}
                    >
                        <Sparkles size={18} className={selectedIndex !== null ? "text-blue-600" : "text-slate-400"} />
                    </button>
                    <div className="w-px h-5 bg-slate-200 mx-1" />
                    <button
                        onClick={() => isAuthenticated ? handleSignOut() : openAuth("login")}
                        className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-200"
                        aria-label={isAuthenticated ? "Sign out" : "Sign in"}
                    >
                        <LogOut size={18} className="text-slate-700" />
                    </button>
                </div>
            </header>

            {/* Sidebar */}
            <SessionSidebar
                isOpen={sidebarOpen}
                sessions={sessions}
                activeSessionId={activeSessionId}
                onClose={() => setSidebarOpen(false)}
                onSelectSession={(id) => {
                    navigate(`/dashboard/s/${id}`);
                    setSidebarOpen(false);
                }}
                onCreateSession={handleCreateSession}
                onDeleteSession={handleDeleteSession}
                onDeleteAll={handleDeleteAllSessions}
            />

            {/* Main area — horizontal split: desk | chat */}
            <main className="relative flex-1 overflow-hidden flex" onClick={() => setImagePanelOpen(false)}>

                {/* Desk area — shrinks to left half when chat is open */}
                <div
                    className={`relative transition-all duration-300 ease-out overflow-hidden ${
                        chatOpen ? "w-1/2" : "w-full"
                    }`}
                >
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

                    {!activeSessionId && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-8 text-center shadow-sm">
                                <div className="text-lg font-semibold text-slate-800">No session selected</div>
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
                        <DeskStrip
                            deskImages={deskImages}
                            blobUrls={blobUrls}
                            selectedIndex={selectedIndex}
                            layoutRevision={deskLayoutRevision}
                            highlightRegion={highlightRegion}
                            onSelect={setSelectedIndex}
                            onDeselect={() => setSelectedIndex(null)}
                            onRemove={removeDeskImage}
                            onReorder={reorderDeskImage}
                        />
                    )}
                </div>

                {/* AI chat panel — slides in from the right */}
                <div
                    className={`transition-all duration-300 ease-out overflow-hidden border-l border-slate-200 shrink-0 ${
                        chatOpen ? "w-1/2" : "w-0"
                    }`}
                >
                    {chatMounted && (
                        <AiChatPanel
                            image={chatImage}
                            imageUrl={chatImage ? blobUrls[chatImage.name] : undefined}
                            sessionId={activeSessionId}
                            onClose={handleCloseChat}
                            onHighlight={setHighlightRegion}
                        />
                    )}
                </div>

                {/* Image panel slide-down */}
                <div className="fixed top-14 left-0 right-0 z-20 overflow-hidden pointer-events-none">
                    <div
                        className={`bg-white border-b border-slate-200 transition-transform duration-300 ease-out pointer-events-auto ${
                            imagePanelOpen ? "translate-y-0" : "-translate-y-full"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ImagePanel
                            sessionId={activeSessionId}
                            images={sessionImages}
                            onSelect={(blobUrl) => {
                                if (!previewImage) setPreviewImage(blobUrl);
                            }}
                            onAddToDesk={addDeskImage}
                        />
                    </div>
                </div>
            </main>

            {/* QR modal */}
            {qrOpen && phoneToken && (
                <div
                    className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-6"
                    onClick={() => setQrOpen(false)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white/90 backdrop-blur p-5 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-1 text-sm font-semibold text-slate-900">Connect phone</div>
                        <div className="text-xs text-slate-600 mb-5">Scan to open the upload page</div>
                        <div className="flex items-center justify-center">
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

            {/* Full-size image preview */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-6"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-5xl w-full flex items-center justify-center">
                        <img
                            src={previewImage}
                            alt="Preview"
                            className="max-h-[90vh] max-w-full rounded-xl shadow-2xl object-contain"
                        />
                    </div>
                </div>
            )}

            {/* Auth modal */}
            {authOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
                    onClick={() => setAuthOpen(false)}
                >
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                        {authMode === "login" ? (
                            <LoginModal
                                onSuccess={() => {
                                    setIsAuthenticated(true);
                                    setAuthOpen(false);
                                }}
                                onSwitch={() => setAuthMode("signup")}
                            />
                        ) : (
                            <SignupModal
                                onSuccess={() => {
                                    setAuthMode("login");
                                    setAuthOpen(true);
                                }}
                                onSwitch={() => setAuthMode("login")}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
