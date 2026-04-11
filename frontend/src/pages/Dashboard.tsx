import { act, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { getSessionData, getSessionEventSource, verifyToken } from "../api/accountsApi"
import { createUploadSessionKey, createSession, deleteAllSessions, deleteSession, listSessions, type SessionId } from "../api/sessionsApi"
import { QRCodeSVG } from "qrcode.react"
import { Menu, Plus, X } from "lucide-react"
import { fetchSessionImages, type SessionImage } from "../api/imageApi"
import ImagePanel from "./ImagePanel"
import { Images, EyeOff, Camera, LogOut } from "lucide-react";


export default function Dashboard() {

    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const deskImageRefs = useRef<Record<string, HTMLImageElement | null>>({});

    const deskScrollRef = useRef<HTMLDivElement | null>(null);

    const [username, setUsername] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState<SessionId[]>([]);
    const [qrOpen, setQrOpen] = useState(false);
    const [phoneToken, setPhoneToken] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const { sessionId } = useParams<{ sessionId: string }>();

    const [sse, setsse] = useState<EventSource | null>();

    const activeSessionId = sessionId ?? null;

    const lastRequestedSession = useRef<string | null>(null);

    const [sessionImages, setSessionImages] = useState<SessionImage[]>([]);

    const [previewImage, setPreviewImage] = useState<string | null>(null); // uses the blobUrl

    const [deskImages, setDeskImages] = useState<SessionImage[]>([]);

    const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});

    const [imagePanelOpen, setImagePanelOpen] = useState<boolean>(false);

    async function changeSession(sessionId: string | null) {
        lastRequestedSession.current = sessionId;
        setLoading(true);

        if (!sessionId) {
            navigate("/dashboard");
            setLoading(false);
            return;
        }

        try {
            const token = localStorage.getItem("jwt");
            const sessionData = await getSessionData(token, sessionId);

            if (lastRequestedSession.current !== sessionId) return; // Ignore outdated request

            setLoading(false);
            navigate(`/dashboard/s/${sessionId}`);
        } catch (e) {
            if (lastRequestedSession.current !== sessionId) return;
            // alert("Failed to fetch session.");
            setLoading(false);
            navigate("/dashboard");
        }
    }

    async function checkToken() {
        const token = localStorage.getItem("jwt");

        if (!token) {
            navigate("/login");
            return;
        }

        try {
            const result = await verifyToken(token);
            setUsername(result.username);
        } catch (err) {
            console.error("Token verification failed.");
            localStorage.removeItem("jwt");
            navigate("/login");
        } finally {
            setLoading(false);
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
                changeSession(refreshedSessions[0].id); // optionally select the newest
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

            changeSession(null);
            setQrOpen(false);
            setPhoneToken(null);

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
            setSessions([]);
            changeSession(null);
            setQrOpen(false);
            setPhoneToken(null);
            navigate("/dashboard");
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to delete sessions.";
            alert(msg);
        }
    }

    async function loadAllSessionImages(sessionId: string | null) {
        // get images for the session when loaded


        const token = localStorage.getItem("jwt");

        // if no session just cleanup and return
        if (!sessionId || !token) {
            setSessionImages([]);
            return;
        }

        // find images
        try {
            const images = await fetchSessionImages(token, sessionId);
            setSessionImages(images);
            console.log(`Loaded ${images.length} images:`);
            for (let i = 0; i < images.length; i++) {
                const image = images.at(i);
                if (!image) {
                    console.log(`\t[${i}] unknown`);
                    continue;
                };
                console.log(`\t[${i}] ${image.name}`);
                console.log(`\t[${i}] ${image.uploadDate}`);
                console.log(`\t[${i}] ${image.url}`);
            }

        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to load sessions.";
            alert(msg);
        }
    }

    async function hydrateImage(img: SessionImage) {
        if (blobUrls[img.name]) return; // already loaded

        const token = localStorage.getItem("jwt");
        if (!token) return;

        const res = await fetch(img.url, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        setBlobUrls(prev => ({
            ...prev,
            [img.name]: url
        }));
    }

    useEffect(() => {
        checkToken();
    }, []);

    useEffect(() => {
        changeSession(sessionId ?? null);
    }, [sessionId])

    useEffect(() => {
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
    }, []);

    useEffect(() => {
        loadAllSessionImages(activeSessionId);
    }, [activeSessionId]);


    useEffect(() => {
        if (!activeSessionId) {
            setsse(null);
            return;
        }

        // close previous sse
        if (sse) {
            sse.close();
        }

        const newSse = getSessionEventSource(activeSessionId)!;
        setsse(newSse);

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
            if (newSse.readyState === EventSource.CLOSED) {
                console.log("SSE connection closed");
            } else {
                alert("SSE connection error");
            }
        };

        newSse.addEventListener("open", handleOpen);
        newSse.addEventListener("message", handleMessage);
        newSse.addEventListener("error", handleError);
        return () => {
            newSse.removeEventListener("open", handleOpen);
            newSse.removeEventListener("message", handleMessage);
            newSse.removeEventListener("error", handleError);
            newSse.close();
        }
    }, [activeSessionId]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = Math.max(1, window.devicePixelRatio || 1);

        const draw = () => {
            const rect = canvas.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));

            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);

            // Draw grid
            const spacing = 40;
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
            for (let x = 0; x <= width; x += spacing) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y <= height; y += spacing) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            // Subtle center glow
            const gradient = ctx.createRadialGradient(
                width * 0.55,
                height * 0.35,
                0,
                width * 0.55,
                height * 0.35,
                Math.max(width, height)
            );
            gradient.addColorStop(0, "rgba(59, 130, 246, 0.06)");
            gradient.addColorStop(1, "rgba(59, 130, 246, 0.00)");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // **Draw loading spinner if loading**
            if (loading) {
                const spinnerRadius = 20;
                const now = Date.now() / 500; // speed
                ctx.save();
                ctx.translate(width / 2, height / 2);
                ctx.rotate(now % (2 * Math.PI));
                ctx.lineWidth = 4;
                ctx.strokeStyle = "#3B82F6"; // blue
                ctx.beginPath();
                ctx.arc(0, 0, spinnerRadius, 0, Math.PI * 1.5);
                ctx.stroke();
                ctx.restore();

                // Text
                ctx.font = "16px sans-serif";
                ctx.fillStyle = "#1E293B"; // slate-800
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("Loading session", width / 2, height / 2 - 45);
            }
        };

        draw();
        let raf = 0;
        const onResize = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(draw);
        };

        window.addEventListener("resize", onResize);
        const interval = setInterval(() => requestAnimationFrame(draw), 16); // ~60fps for spinner
        return () => {
            clearInterval(interval);
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
        };
    }, [loading]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (previewImage)
                    setPreviewImage(null);
                else
                    setImagePanelOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [previewImage]);

    useEffect(() => {
        sessionImages.forEach(hydrateImage);
    }, [sessionImages]);

    useEffect(() => {
        return () => {
            Object.values(blobUrls).forEach(URL.revokeObjectURL);
        };
    }, []);

    useEffect(() => {
        const el = deskScrollRef.current;
        if (!el) return;

        let isMiddleDragging = false;
        let startX = 0;
        let scrollLeft = 0;

        const onMouseDown = (e: MouseEvent) => {
            if (e.button !== 1) return;
            e.preventDefault();
            isMiddleDragging = true;
            startX = e.pageX;
            scrollLeft = el.scrollLeft;
            el.style.cursor = "grabbing";
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isMiddleDragging) return;
            const dx = e.pageX - startX;
            el.scrollLeft = scrollLeft - dx;
        };

        const onMouseUp = (e: MouseEvent) => {
            if (e.button !== 1) return;
            isMiddleDragging = false;
            el.style.cursor = "";
        };

        el.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        return () => {
            el.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [deskImages]);

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
                    <div className="text-sm text-slate-600 cursor-pointer" onClick={() => changeSession(null)}>symly.ai</div>
                    <button
                        onClick={() => setImagePanelOpen(v => !v)}
                        className="relative w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-200"
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
                                        changeSession(s.id);
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
                    <div ref={deskScrollRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden">
                        <div className="flex h-full items-center gap-6 w-max">
                            <div className="shrink-0 w-[40vw]" />

                            {deskImages.map((img) => {
                                const src = blobUrls[img.name];
                                return (
                                    <div
                                        key={img.name}
                                        className="relative group flex-shrink-0"  // ← Key wrapper
                                    >
                                        <img
                                            ref={(el) => { deskImageRefs.current[img.name] = el; }}
                                            src={src || ""}
                                            className="h-[80vh] w-auto object-contain border-5 border-transparent hover:border-blue-500 transition-colors"
                                            onClick={(e) => {
                                                e.currentTarget.scrollIntoView({
                                                    behavior: "smooth",
                                                    block: "nearest",
                                                    inline: "center",
                                                });
                                            }}
                                        />

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent triggering image scroll
                                                if (window.confirm(`Remove "${img.name}" from desk?`)) {
                                                    setDeskImages(prev => prev.filter(x => x.name !== img.name));
                                                }
                                            }}
                                            className="absolute top-4 right-4 
                                       opacity-0 group-hover:opacity-100 
                                       transition-all duration-200
                                       w-9 h-9 rounded-full 
                                       bg-white/90 hover:bg-red-500 
                                       text-slate-700 hover:text-white 
                                       flex items-center justify-center
                                       shadow-md hover:shadow-lg
                                       border border-slate-200 hover:border-red-400"
                                            aria-label={`Remove ${img.name} from desk`}
                                        >
                                            <X size={18} strokeWidth={3} />
                                        </button>
                                    </div>
                                );
                            })}

                            <div className="shrink-0 w-[40vw]" />
                        </div>
                    </div>
                )}

                {imagePanelOpen && (
                    <div className="fixed top-14 left-0 right-0 z-20" onClick={(e) => e.stopPropagation()}>

                        <ImagePanel
                            images={sessionImages}
                            onSelect={(blobUrl) => {
                                if (!previewImage)
                                    setPreviewImage(blobUrl);
                            }}
                            onAddToDesk={(img) => {
                                setDeskImages((prev) => {
                                    if (prev.find((x) => x.name === img.name)) return prev;
                                    return [...prev, img];
                                });
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
                )}
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