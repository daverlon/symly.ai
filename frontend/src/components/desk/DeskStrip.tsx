import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { DeskImage } from "../../api/imageApi";
import type { HighlightRegion } from "../chat/AiChatPanel";
import { useMouseDrag } from "../../hooks/useMouseDrag";
import { useResetLoadedDeskImageCount } from "../../hooks/useResetLoadedDeskImageCount";

interface DeskStripProps {
    deskImages: DeskImage[];
    blobUrls: Record<string, string>;
    selectedIndex: number | null;
    layoutRevision?: number;
    highlightRegion?: HighlightRegion;
    onSelect: (index: number) => void;
    onDeselect: () => void;
    onRemove: (img: DeskImage) => void;
    onReorder: (uid: string, afterUid: string | null) => void;
}

interface DropTarget {
    uid: string;
    side: "before" | "after";
}

export function DeskStrip({
    deskImages,
    blobUrls,
    selectedIndex,
    layoutRevision,
    highlightRegion,
    onSelect,
    onDeselect,
    onRemove,
    onReorder,
}: DeskStripProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const imageRefs = useRef<Record<number, HTMLImageElement | null>>({});
    const loadedCount = useRef(0);

    const [draggedUid, setDraggedUid] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

    useMouseDrag(scrollRef, deskImages);
    useResetLoadedDeskImageCount(loadedCount, deskImages);

    // ── Scroll to selection ───────────────────────────────────────────────────

    useEffect(() => {
        if (selectedIndex === null) return;
        const id = requestAnimationFrame(() => {
            imageRefs.current[selectedIndex]?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center",
            });
        });
        return () => cancelAnimationFrame(id);
    }, [selectedIndex]);

    // Re-center after an external layout change (e.g. chat panel open/close)
    useEffect(() => {
        if (layoutRevision === undefined || layoutRevision === 0) return;
        if (selectedIndex === null) return;
        imageRefs.current[selectedIndex]?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
        });
    }, [layoutRevision]);

    // ── Drag-and-drop ─────────────────────────────────────────────────────────

    function handleDragStart(e: React.DragEvent, uid: string) {
        setDraggedUid(uid);
        e.dataTransfer.effectAllowed = "move";
    }

    function handleDragOver(e: React.DragEvent, uid: string) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const side: "before" | "after" = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
        setDropTarget({ uid, side });
    }

    function handleDragLeave(e: React.DragEvent) {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDropTarget(null);
        }
    }

    function handleDrop(e: React.DragEvent, targetUid: string) {
        e.preventDefault();
        if (!draggedUid || draggedUid === targetUid) { cleanup(); return; }

        const side = dropTarget?.side ?? "after";
        let afterUid: string | null;
        if (side === "after") {
            afterUid = targetUid;
        } else {
            const targetIndex = deskImages.findIndex((img) => img.uid === targetUid);
            afterUid = targetIndex > 0 ? (deskImages[targetIndex - 1].uid ?? null) : null;
        }

        onReorder(draggedUid, afterUid);
        cleanup();
    }

    function cleanup() {
        setDraggedUid(null);
        setDropTarget(null);
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div
            ref={scrollRef}
            className="absolute inset-0 overflow-x-auto overflow-y-hidden"
            onClick={(e) => {
                if (!(e.target as HTMLElement).closest("[data-image-card]")) onDeselect();
            }}
            onDragOver={(e) => e.preventDefault()}
        >
            <div className="flex h-full items-center gap-10 w-max">
                <div className="shrink-0 w-[40vw]" />

                {deskImages.map((img, index) => {
                    const isSelected = selectedIndex === index;
                    const isDragging = draggedUid === img.uid;
                    const isDropBefore = dropTarget?.uid === img.uid && dropTarget.side === "before";
                    const isDropAfter = dropTarget?.uid === img.uid && dropTarget.side === "after";

                    return (
                        <div
                            key={img.uid}
                            draggable
                            onDragStart={(e) => handleDragStart(e, img.uid)}
                            onDragOver={(e) => handleDragOver(e, img.uid)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, img.uid)}
                            onDragEnd={cleanup}
                            data-image-card
                            className={`relative group flex-shrink-0 transition-all duration-200 ease-out ${
                                    isDragging ? "opacity-40" : "opacity-100"
                                } ${isSelected ? "scale-[1.05]" : "scale-100"}`}
                                onClick={() => onSelect(index)}
                        >
                            {/* Drop indicator — left edge */}
                            {isDropBefore && (
                                <div className="absolute -left-5 top-0 bottom-0 w-1 bg-blue-500 rounded-full z-10 pointer-events-none" />
                            )}

                            <div
                                className={`relative transition-all duration-200 rounded-lg overflow-hidden ${
                                    isSelected
                                        ? "outline outline-2 outline-blue-400 shadow-xl"
                                        : "outline outline-1 outline-transparent hover:outline-slate-300 hover:shadow-md"
                                }`}
                            >
                                <img
                                    ref={(el) => { imageRefs.current[index] = el; }}
                                    src={blobUrls[img.name]}
                                    className="h-[80vh] w-auto object-contain block"
                                    alt={img.name}
                                    draggable={false}
                                    onLoad={() => {
                                        loadedCount.current += 1;
                                        if (loadedCount.current >= deskImages.length) {
                                            const target = selectedIndex ?? deskImages.length - 1;
                                            imageRefs.current[target]?.scrollIntoView({
                                                behavior: "smooth",
                                                block: "nearest",
                                                inline: "center",
                                            });
                                        }
                                    }}
                                />

                                {/* Highlight: exact Paddle/ocr polygon in image pixel space (angled quads), not a manual AABB */}
                                {highlightRegion?.uid === img.uid && (() => {
                                    const el = imageRefs.current[index];
                                    if (!el?.naturalWidth) return null;
                                    const { cnt } = highlightRegion;
                                    if (cnt.length < 3) return null;
                                    const pw = el.naturalWidth;
                                    const ph = el.naturalHeight;
                                    const points = cnt.map(([x, y]) => `${x},${y}`).join(" ");
                                    const sw = Math.max(2, Math.round(pw * 0.0015));
                                    return (
                                        <svg
                                            className="absolute inset-0 w-full h-full pointer-events-none z-[5] overflow-visible"
                                            viewBox={`0 0 ${pw} ${ph}`}
                                            preserveAspectRatio="xMidYMid meet"
                                            aria-hidden
                                        >
                                            <polygon
                                                points={points}
                                                fill="rgba(251, 191, 36, 0.22)"
                                                stroke="rgb(245, 158, 11)"
                                                strokeWidth={sw}
                                                strokeLinejoin="round"
                                                style={{ filter: "drop-shadow(0 0 2px rgba(245, 158, 11, 0.45))" }}
                                            />
                                        </svg>
                                    );
                                })()}

                                {/* Remove button — top-right, visible on hover */}
                                <button
                                    type="button"
                                    className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/80 backdrop-blur border border-slate-200/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm text-slate-500 hover:bg-red-500 hover:text-white hover:border-red-500 active:scale-90"
                                    title="Remove from desk"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm("Remove this image from the desk?")) {
                                            onRemove(img);
                                        }
                                    }}
                                >
                                    <X size={13} strokeWidth={2.5} />
                                </button>
                            </div>

                            {/* Drop indicator — right edge */}
                            {isDropAfter && (
                                <div className="absolute -right-5 top-0 bottom-0 w-1 bg-blue-500 rounded-full z-10 pointer-events-none" />
                            )}
                        </div>
                    );
                })}

                <div className="shrink-0 w-[40vw]" />
            </div>
        </div>
    );
}
