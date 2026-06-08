import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, ChevronDown, ChevronUp, Loader2, RefreshCw, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { DeskImage } from "../../api/imageApi";
import { getDeskImageOcr, clearDeskImageOcr, type OcrResult } from "../../api/ocrApi";
import { sendChatMessage, getChatHistory, deleteChatHistory, type ChatMessage } from "../../api/chatApi";

type MathpixLine = {
    type?: string;
    text?: string;
    latex?: string;
    cnt?: [number, number][];
    region?: SpatialEntry["region"];
    is_handwritten?: boolean;
    is_printed?: boolean;
    confidence?: number;
};

type MathpixWord = {
    type?: string;
    cnt?: [number, number][];
    text?: string;
    latex?: string;
    confidence?: number;
};

type MergedRawBox = {
    boxId?: string;
    cnt?: [number, number][];
    text?: string;
};

type ExpressionGroup = {
    boxIds?: string[];
    text?: string;
};

/**
 * Splits Mathpix math text into individual row steps by splitting on LaTeX `\\`.
 * In the parsed JS string, LaTeX `\\` (line break) appears as two backslash chars.
 */
function splitMathLines(mathText: string): string[] {
    // Extract the body of any \begin{...}...\end{...} environment
    const envMatch = mathText.match(/\\begin\{[^}]+\}(?:\{[^}]*\})?([\s\S]*?)\\end\{[^}]+\}/);
    const content = envMatch ? envMatch[1] : mathText;
    // Split on \\ — two consecutive backslashes
    const parts = content.split(/\\\\/);
    return parts.map((s) => s.trim()).filter(Boolean);
}

function normalizeLineData(lineData: unknown): MathpixLine[] {
    if (!lineData) return [];
    if (Array.isArray(lineData)) return lineData as MathpixLine[];
    if (typeof lineData === "string") {
        try {
            const parsed = JSON.parse(lineData);
            return Array.isArray(parsed) ? (parsed as MathpixLine[]) : [];
        } catch {
            return [];
        }
    }
    return [];
}

function parseJsonArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? (parsed as T[]) : [];
        } catch {
            return [];
        }
    }
    return [];
}

type SpatialEntry = {
    cnt?: [number, number][];
    region?: {
        top_left_x: number;
        top_left_y: number;
        width: number;
        height: number;
    };
    type?: string;
    text?: string;
    latex?: string;
    confidence?: number;
    is_handwritten?: boolean;
};

function extractCnt(entry: SpatialEntry): [number, number][] | null {
    if (entry.cnt && entry.cnt.length >= 3) return entry.cnt;
    const r = entry.region;
    if (r && r.width > 0 && r.height > 0) {
        const { top_left_x: x, top_left_y: y, width: w, height: h } = r;
        return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    }
    return null;
}

function truncateDebugText(s: string, max = 72): string {
    const t = s.replace(/\s+/g, " ").trim();
    return t.length > max ? `${t.slice(0, max)}…` : t;
}

function resolveGroupCnts(group: ExpressionGroup, boxes: MergedRawBox[]): [number, number][][] {
    const ids = new Set(group.boxIds ?? []);
    return boxes
        .filter((b) => b.boxId && ids.has(b.boxId) && Array.isArray(b.cnt) && b.cnt.length >= 3)
        .map((b) => b.cnt as [number, number][]);
}

/**
 * Find the expression group (from Gemini) that contains the PP-OCR box for the given
 * line index. PP-OCR box IDs are assigned sequentially: lineIndex 0 → "b1", 1 → "b2", etc.
 * We search by boxId rather than positional index because Gemini may reorder groups.
 */
function findGroupForBoxId(boxId: string, groups: ExpressionGroup[], boxes: MergedRawBox[]): { boxIds: string[]; cnts: [number, number][][] } {
    const group = groups.find((g) => (g.boxIds ?? []).includes(boxId));
    if (!group) return { boxIds: [], cnts: [] };
    return {
        boxIds: group.boxIds ?? [],
        cnts: resolveGroupCnts(group, boxes),
    };
}

interface OcrTextDebugSectionProps {
    title: string;
    text: string | null;
    isDark: boolean;
}

function OcrTextDebugSection({ title, text, isDark }: OcrTextDebugSectionProps) {
    return (
        <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {title}
            </p>
            <pre className={`text-[11px] whitespace-pre-wrap font-mono leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                {text?.trim() ? text : "No data"}
            </pre>
        </div>
    );
}

interface MergedBoxesDebugSectionProps {
    boxes: MergedRawBox[];
    isDark: boolean;
    imageUid: string | undefined;
    onHighlight: (region: HighlightRegion) => void;
    onClearHighlight: () => void;
}

function MergedBoxesDebugSection({
    boxes,
    isDark,
    imageUid,
    onHighlight,
    onClearHighlight,
}: MergedBoxesDebugSectionProps) {
    const rowClass = isDark
        ? "hover:bg-amber-500/10 hover:border-amber-500/40 border-transparent"
        : "hover:bg-amber-50 hover:border-amber-300/60 border-transparent";

    function highlightBox(box: MergedRawBox) {
        const cnt = extractCnt(box);
        if (!imageUid || !cnt) return;
        onHighlight({ uid: imageUid, cnts: [cnt] });
    }

    if (!boxes.length) {
        return (
            <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    Merged PP-OCR boxes
                </p>
                <p className={`text-[11px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>No boxes</p>
            </div>
        );
    }

    return (
        <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Merged PP-OCR boxes ({boxes.length}) — hover to highlight
            </p>
            <ul className="space-y-0.5">
                {boxes.map((box, i) => {
                    const cnt = extractCnt(box);
                    const display = truncateDebugText(box.text ?? "");
                    return (
                        <li
                            key={box.boxId ?? `box-${i}`}
                            className={`text-[11px] font-mono px-2 py-1 rounded border transition-colors ${cnt ? `cursor-crosshair ${rowClass}` : "opacity-40 cursor-default"}`}
                            onMouseEnter={() => highlightBox(box)}
                            onMouseLeave={onClearHighlight}
                        >
                            <span className="font-semibold text-violet-500">{box.boxId ?? `[${i}]`}</span>
                            {display ? <span className={`ml-1.5 ${isDark ? "text-slate-300" : "text-slate-600"}`}>{display}</span> : null}
                            {!cnt ? <span className="ml-1.5 text-red-400">no bbox</span> : null}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

interface ExpressionStepsDebugSectionProps {
    groups: ExpressionGroup[];
    boxes: MergedRawBox[];
    isDark: boolean;
    imageUid: string | undefined;
    onHighlight: (region: HighlightRegion) => void;
    onClearHighlight: () => void;
}

function ExpressionStepsDebugSection({
    groups,
    boxes,
    isDark,
    imageUid,
    onHighlight,
    onClearHighlight,
}: ExpressionStepsDebugSectionProps) {
    const rowClass = isDark
        ? "hover:bg-amber-500/10 hover:border-amber-500/40 border-transparent"
        : "hover:bg-amber-50 hover:border-amber-300/60 border-transparent";

    function highlightGroup(group: ExpressionGroup) {
        const cnts = resolveGroupCnts(group, boxes);
        if (!imageUid || cnts.length === 0) return;
        onHighlight({ uid: imageUid, cnts });
    }

    if (!groups.length) {
        return (
            <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    Gemini expression steps
                </p>
                <p className={`text-[11px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>No steps</p>
            </div>
        );
    }

    return (
        <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Gemini expression steps ({groups.length}) — hover to highlight
            </p>
            <ul className="space-y-0.5">
                {groups.map((group, i) => {
                    const cnts = resolveGroupCnts(group, boxes);
                    const boxLabel = (group.boxIds ?? []).join(", ") || "—";
                    const display = truncateDebugText(group.text ?? "");
                    return (
                        <li
                            key={`step-${i}`}
                            className={`text-[11px] font-mono px-2 py-1 rounded border transition-colors flex items-center gap-1 ${cnts.length ? `cursor-crosshair ${rowClass}` : "opacity-40 cursor-default"}`}
                            onMouseEnter={() => highlightGroup(group)}
                            onMouseLeave={onClearHighlight}
                        >
                            <span className="font-semibold text-amber-600 shrink-0">step {i + 1}</span>
                            <span className={`shrink-0 ${isDark ? "text-slate-500" : "text-slate-400"}`}>[{boxLabel}]</span>
                            {cnts.length > 1 ? (
                                <span className="shrink-0 inline-flex items-center gap-0.5 bg-amber-200 text-amber-800 text-[10px] font-bold px-1 rounded">
                                    ⬛×{cnts.length}
                                </span>
                            ) : null}
                            {display ? <span className={`min-w-0 truncate ${isDark ? "text-slate-300" : "text-slate-600"}`}>{display}</span> : null}
                            {cnts.length === 0 ? <span className="shrink-0 text-red-400">no bbox</span> : null}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

interface OcrSpatialDebugSectionProps {
    title: string;
    indexClass: string;
    text: string | null;
    lineData: unknown;
    wordData: unknown;
    isDark: boolean;
    imageUid: string | undefined;
    onHighlight: (region: HighlightRegion) => void;
    onClearHighlight: () => void;
}

function OcrSpatialDebugSection({
    title,
    indexClass,
    text,
    lineData,
    wordData,
    isDark,
    imageUid,
    onHighlight,
    onClearHighlight,
}: OcrSpatialDebugSectionProps) {
    const lines = normalizeLineData(lineData);
    const words = parseJsonArray<MathpixWord>(wordData);

    const rowClass = isDark
        ? "hover:bg-amber-500/10 hover:border-amber-500/40 border-transparent"
        : "hover:bg-amber-50 hover:border-amber-300/60 border-transparent";

    function highlightCnt(cnt: [number, number][] | null) {
        if (!imageUid || !cnt) return;
        onHighlight({ uid: imageUid, cnts: [cnt] });
    }

    return (
        <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {title}
            </p>
            {text ? (
                <p className={`text-[10px] font-mono mb-2 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    <span className="opacity-60">text: </span>
                    {truncateDebugText(text, 140)}
                </p>
            ) : null}
            {lines.length > 0 ? (
                <div className="mb-2">
                    <p className={`text-[9px] font-semibold uppercase tracking-wide mb-1 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                        line_data ({lines.length}) — hover to highlight
                    </p>
                    <ul className="space-y-0.5">
                        {lines.map((line, i) => {
                            const cnt = extractCnt(line);
                            const display = truncateDebugText(line.text ?? line.latex ?? "");
                            return (
                                <li
                                    key={`line-${i}`}
                                    className={`text-[11px] font-mono px-2 py-1 rounded border transition-colors ${cnt ? `cursor-crosshair ${rowClass}` : "opacity-40 cursor-default"}`}
                                    onMouseEnter={() => highlightCnt(cnt)}
                                    onMouseLeave={onClearHighlight}
                                >
                                    <span className={`font-semibold ${indexClass}`}>[{i}]</span>
                                    {line.type ? <span className={`ml-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{line.type}</span> : null}
                                    {display ? <span className={`ml-1.5 ${isDark ? "text-slate-300" : "text-slate-600"}`}>{display}</span> : null}
                                    {line.confidence != null ? (
                                        <span className={`ml-1.5 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                                            {(line.confidence * 100).toFixed(0)}%
                                        </span>
                                    ) : null}
                                    {!cnt ? <span className="ml-1.5 text-red-400">no bbox</span> : null}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : null}
            {words.length > 0 ? (
                <div>
                    <p className={`text-[9px] font-semibold uppercase tracking-wide mb-1 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                        word_data ({words.length}) — hover to highlight
                    </p>
                    <ul className="space-y-0.5">
                        {words.map((word, i) => {
                            const cnt = extractCnt(word);
                            const display = truncateDebugText(word.text ?? word.latex ?? "");
                            return (
                                <li
                                    key={`word-${i}`}
                                    className={`text-[11px] font-mono px-2 py-1 rounded border transition-colors ${cnt ? `cursor-crosshair ${rowClass}` : "opacity-40 cursor-default"}`}
                                    onMouseEnter={() => highlightCnt(cnt)}
                                    onMouseLeave={onClearHighlight}
                                >
                                    <span className={`font-semibold ${indexClass}`}>[{i}]</span>
                                    {word.type ? <span className={`ml-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{word.type}</span> : null}
                                    {display ? <span className={`ml-1.5 ${isDark ? "text-slate-300" : "text-slate-600"}`}>{display}</span> : null}
                                    {word.confidence != null ? (
                                        <span className={`ml-1.5 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                                            {(word.confidence * 100).toFixed(0)}%
                                        </span>
                                    ) : null}
                                    {!cnt ? <span className="ml-1.5 text-red-400">no bbox</span> : null}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : null}
            {lines.length === 0 && words.length === 0 && !text ? (
                <p className={`text-[11px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>No data</p>
            ) : null}
        </div>
    );
}

function parseMergedRawBoxes(value: unknown): MergedRawBox[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as MergedRawBox[];
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed as MergedRawBox[];
            if (parsed && typeof parsed === "object" && Array.isArray((parsed as { ppocrLineData?: unknown[] }).ppocrLineData)) {
                return (parsed as { ppocrLineData: MergedRawBox[] }).ppocrLineData;
            }
            return [];
        } catch {
            return [];
        }
    }
    if (typeof value === "object" && Array.isArray((value as { ppocrLineData?: unknown[] }).ppocrLineData)) {
        return (value as { ppocrLineData: MergedRawBox[] }).ppocrLineData;
    }
    return [];
}

/**
 * Proportional fallback: divides the line's y-range into equal strips.
 */
function computeStepCntProportional(
    line: MathpixLine,
    stepIndex: number,
    totalSteps: number,
): [number, number][] {
    const cnt = line.cnt!;
    const xs = cnt.map(([x]) => x);
    const ys = cnt.map(([, y]) => y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const stepH = (yMax - yMin) / totalSteps;
    const y1 = yMin + stepIndex * stepH;
    const y2 = yMin + (stepIndex + 1) * stepH;
    return [[xMin, y1], [xMax, y1], [xMax, y2], [xMin, y2]];
}

/**
 * Uses word_data entries to compute accurate per-step bounding boxes.
 * Words whose y-centre falls inside the math block are clustered into rows by
 * proximity; each cluster maps to one step. Falls back to proportional split
 * when word data is unavailable or clustering produces fewer rows than expected.
 */
function computeStepCnt(
    line: MathpixLine,
    stepIndex: number,
    totalSteps: number,
    wordData?: MathpixWord[],
): [number, number][] {
    if (!line.cnt) return [];

    const xs = line.cnt.map(([x]) => x);
    const ys = line.cnt.map(([, y]) => y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);

    if (wordData?.length) {
        // Collect word centroids that fall within this math block's y-range
        type WordBox = { yCenter: number; yMin: number; yMax: number };
        const relevant: WordBox[] = wordData
            .filter((w) => w.cnt?.length)
            .map((w) => {
                const wys = w.cnt!.map(([, y]) => y);
                return {
                    yCenter: (Math.min(...wys) + Math.max(...wys)) / 2,
                    yMin: Math.min(...wys),
                    yMax: Math.max(...wys),
                };
            })
            .filter((w) => w.yCenter >= yMin && w.yCenter <= yMax)
            .sort((a, b) => a.yCenter - b.yCenter);

        if (relevant.length) {
            // Cluster consecutive words whose centres are within one estimated row-height
            const rowH = (yMax - yMin) / totalSteps;
            const clusters: WordBox[][] = [];
            for (const w of relevant) {
                const last = clusters[clusters.length - 1];
                if (!last || w.yCenter - last[0].yCenter > rowH * 0.75) {
                    clusters.push([w]);
                } else {
                    last.push(w);
                }
            }

            if (clusters.length >= totalSteps && clusters[stepIndex]) {
                const row = clusters[stepIndex];
                const ry1 = Math.min(...row.map((w) => w.yMin));
                const ry2 = Math.max(...row.map((w) => w.yMax));
                // Small vertical padding so the highlight isn't flush with the text
                const pad = Math.max((ry2 - ry1) * 0.12, 2);
                return [
                    [xMin, ry1 - pad],
                    [xMax, ry1 - pad],
                    [xMax, ry2 + pad],
                    [xMin, ry2 + pad],
                ];
            }
        }
    }

    return computeStepCntProportional(line, stepIndex, totalSteps);
}

export type HighlightRegion = {
    uid: string;
    cnts: [number, number][][];
} | null;

interface AiChatPanelProps {
    isDark?: boolean;
    image: DeskImage | null;
    imageUrl?: string;
    sessionId: string | null;
    onClose: () => void;
    onHighlight: (region: HighlightRegion) => void;
}

type Message = {
    id: string;
    role: "assistant" | "user";
    content: string;
};

type OcrStatus = "idle" | "loading" | "done" | "error";

const WELCOME_MESSAGE: Message = {
    id: "welcome",
    role: "assistant",
    content: "I can see your homework. Ask me anything — about the problem, your approach, or where you might have gone wrong.",
};

export function AiChatPanel({ isDark = false, image, imageUrl, sessionId, onClose, onHighlight }: AiChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
    const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "done">("idle");
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
    const [ocr, setOcr] = useState<OcrResult | null>(null);
    const [ocrExpanded, setOcrExpanded] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const parsedLineData = normalizeLineData(ocr?.lineData);
    const mergedRawBoxes = parseMergedRawBoxes(ocr?.mergedRawOutput);
    const expressionGroups = parseJsonArray<ExpressionGroup>(ocr?.expressionRawOutput);

    const handleHighlight = (region: HighlightRegion | null) => {
        if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
            highlightTimeoutRef.current = null;
        }
        if (region) {
            onHighlight(region);
        } else {
            // Delay clearing highlight to allow smooth transition between adjacent elements
            highlightTimeoutRef.current = setTimeout(() => {
                onHighlight(null);
            }, 50);
        }
    };

    const handleDebugClearHighlight = () => handleHighlight(null);

    const handleTermClick = (term: string) => {
        setInput(`tell me about ${term}`);
    };

    const processMessageContent = (content: string) => {
        if (!content) return content;
        // Convert [[term]] to markdown links that will be handled by the custom 'a' component
        return content.replace(/\[\[([^\]]+)\]\]/g, (_, term) => {
            return `[${term}](#term-${term})`;
        });
    };

    function resolveGroupForLine(lineIndex: number): { boxIds: string[]; cnts: [number, number][][] } {
        // PP-OCR boxes are assigned sequential IDs: lineIndex 0 → "b1", 1 → "b2", etc.
        const boxId = `b${lineIndex + 1}`;
        return findGroupForBoxId(boxId, expressionGroups, mergedRawBoxes);
    }

    function fetchOcr(sid: string, uid: string) {
        setOcrStatus("loading");
        setOcr(null);
        getDeskImageOcr(sid, uid)
            .then((result) => {
                setOcr(result);
                setOcrStatus("done");
            })
            .catch(() => setOcrStatus("error"));
    }

    function fetchHistory(sid: string, uid: string) {
        setHistoryStatus("loading");
        getChatHistory(sid, uid)
            .then((history) => {
                if (history.length === 0) {
                    setMessages([WELCOME_MESSAGE]);
                } else {
                    setMessages([
                        WELCOME_MESSAGE,
                        ...history.map((m) => ({
                            id: crypto.randomUUID(),
                            role: m.role,
                            content: m.content,
                        })),
                    ]);
                }
                setHistoryStatus("done");
            })
            .catch(() => {
                setMessages([WELCOME_MESSAGE]);
                setHistoryStatus("done");
            });
    }

    // Reset + reload when image changes
    useEffect(() => {
        setMessages([WELCOME_MESSAGE]);
        setHistoryStatus("idle");
        setInput("");
        setOcr(null);
        setOcrExpanded(false);
        setOcrStatus("idle");
        onHighlight(null);
    }, [image?.uid, sessionId, onHighlight]);

    // Clear image highlight when debug panel collapses
    useEffect(() => {
        if (!ocrExpanded) onHighlight(null);
    }, [ocrExpanded, onHighlight]);

    // Load OCR + chat history when image opens
    useEffect(() => {
        if (image && sessionId) {
            fetchOcr(sessionId, image.uid);
            fetchHistory(sessionId, image.uid);
        }
    }, [image?.uid, sessionId]);

    async function handleDeleteHistory() {
        if (!image || !sessionId || isTyping) return;
        await deleteChatHistory(sessionId, image.uid).catch(() => {});
        setMessages([WELCOME_MESSAGE]);
    }

    async function handleRegenerate() {
        if (!image || !sessionId || ocrStatus === "loading") return;
        await clearDeskImageOcr(sessionId, image.uid).catch(() => {});
        fetchOcr(sessionId, image.uid);
    }

    // Scroll to latest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function handleSend() {
        const text = input.trim();
        if (!text || isTyping || !image || !sessionId) return;

        const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
        const updatedMessages = [...messages, userMsg];

        setMessages(updatedMessages);
        setInput("");
        setIsTyping(true);

        // Build history to send — exclude the static welcome message
        const history: ChatMessage[] = updatedMessages
            .filter((m) => m.id !== "welcome")
            .map((m) => ({ role: m.role, content: m.content }));

        try {
            const reply = await sendChatMessage(sessionId, image.uid, history);
            setMessages((prev) => [
                ...prev,
                { id: crypto.randomUUID(), role: "assistant", content: reply },
            ]);
            // Fetch OCR for the panel after the first message — it's cached server-side by now
            if (ocrStatus === "idle") {
                fetchOcr(sessionId, image.uid);
            }
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: "Sorry, I couldn't get a response right now. Please try again.",
                },
            ]);
        } finally {
            setIsTyping(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    return (
        <div className={`h-full min-h-0 flex flex-col transition-colors ${isDark ? "bg-slate-900" : "bg-white"}`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 gap-3 ${
                isDark ? "border-slate-800" : "border-slate-200"
            }`}>
                {/* Image thumbnail */}
                {imageUrl && (
                    <div className={`shrink-0 w-10 h-10 rounded-md overflow-hidden border ${
                        isDark ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"
                    }`}>
                        <img
                            src={imageUrl}
                            alt="Context image"
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}

                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Sparkles size={14} className="text-blue-500 shrink-0" />
                    <span className={`text-sm font-semibold truncate ${isDark ? "text-slate-100" : "text-slate-800"}`}>AI Tutor</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={handleDeleteHistory}
                        disabled={isTyping || messages.length <= 1}
                        className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            isDark ? "text-slate-500 hover:text-red-400 hover:bg-slate-800" : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                        }`}
                        aria-label="Delete chat history"
                        title="Delete chat history"
                    >
                        <Trash2 size={14} />
                    </button>
                    <button
                        onClick={onClose}
                        className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                            isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        }`}
                        aria-label="Close chat"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {/* OCR context bar */}
            <div className={`shrink-0 border-b ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                {ocrStatus === "loading" && (
                    <div className={`flex items-center gap-2 px-4 py-2 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        <Loader2 size={12} className="animate-spin" />
                        Extracting text from image…
                    </div>
                )}

                {ocrStatus === "error" && (
                    <div className="flex items-center justify-between px-4 py-2">
                        <span className="text-xs text-red-500">Could not extract text from image.</span>
                        <button
                            type="button"
                            onClick={handleRegenerate}
                            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                            title="Retry extraction"
                        >
                            <RefreshCw size={11} />
                            Retry
                        </button>
                    </div>
                )}

                {(ocrStatus === "done" || ocrStatus === "idle") && (
                    <div className="flex items-center">
                        {ocr?.text ? (
                            <button
                                type="button"
                                onClick={() => setOcrExpanded((v) => !v)}
                                className={`flex-1 flex items-center justify-between px-4 py-2 text-xs transition-colors ${
                                    isDark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-50"
                                }`}
                            >
                                <span className={`font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                                    Extracted text
                                    {ocr.lineData ? <span className="ml-1.5 text-blue-500 font-normal">+ spatial layout</span> : null}
                                </span>
                                {ocrExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                        ) : (
                            <div className="flex-1 flex items-center gap-2">
                                <span className="px-4 py-2 text-xs text-amber-600 font-medium">
                                    {ocrStatus === "done" ? "⚠ No text extracted — AI responses may be unreliable" : ""}
                                </span>
                                {ocrStatus === "done" && (
                                    <button
                                        type="button"
                                        onClick={() => setOcrExpanded((v) => !v)}
                                        className={`px-2 py-1 text-[11px] transition-colors ${
                                            isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600"
                                        }`}
                                    >
                                        {ocrExpanded ? "Hide payload" : "Show payload"}
                                    </button>
                                )}
                            </div>
                        )}
                        {image && sessionId && (
                            <button
                                type="button"
                                onClick={handleRegenerate}
                                className={`shrink-0 flex items-center gap-1 px-3 py-2 text-[11px] transition-colors ${
                                    isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-600"
                                }`}
                                title="Re-run OCR (debug)"
                            >
                                <RefreshCw size={11} />
                                Regen
                            </button>
                        )}
                    </div>
                )}

                {ocrStatus === "done" && ocrExpanded && (
                    <div className="px-4 pb-3 max-h-80 overflow-y-auto space-y-4">
                        <OcrTextDebugSection
                            title="Mathpix (text only)"
                            text={ocr?.mathpixText ?? null}
                            isDark={isDark}
                        />
                        <OcrSpatialDebugSection
                            title="PP-OCRv5 spatial"
                            indexClass="text-emerald-500"
                            text={ocr?.ppocrText ?? null}
                            lineData={ocr?.lineData}
                            wordData={ocr?.wordData}
                            isDark={isDark}
                            imageUid={image?.uid}
                            onHighlight={handleHighlight}
                            onClearHighlight={handleDebugClearHighlight}
                        />
                        <MergedBoxesDebugSection
                            boxes={mergedRawBoxes}
                            isDark={isDark}
                            imageUid={image?.uid}
                            onHighlight={handleHighlight}
                            onClearHighlight={handleDebugClearHighlight}
                        />
                        <ExpressionStepsDebugSection
                            groups={expressionGroups}
                            boxes={mergedRawBoxes}
                            isDark={isDark}
                            imageUid={image?.uid}
                            onHighlight={handleHighlight}
                            onClearHighlight={handleDebugClearHighlight}
                        />
                    </div>
                )}

            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                msg.role === "user"
                                    ? "bg-blue-600 text-white rounded-br-sm"
                                    : (isDark ? "bg-slate-800 text-slate-100 rounded-bl-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm")
                            }`}
                        >
                            <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                    p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                                    ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                                    li: ({ children }) => <li>{children}</li>,
                                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                    code: ({ children }) => (
                                        <code className="bg-black/10 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
                                    ),
                                    pre: ({ children }) => (
                                        <pre className="bg-black/10 rounded p-2 text-xs font-mono overflow-x-auto my-1">{children}</pre>
                                    ),
                                    a: ({ href, children }) => {
                                        const termMatch = href?.match(/^#term-(.+)$/);
                                        if (termMatch) {
                                            const term = termMatch[1];
                                            return (
                                                <span
                                                    className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 border border-blue-300 rounded px-1 py-0.5 cursor-pointer font-medium text-[0.9em] hover:bg-blue-200 transition-colors"
                                                    onClick={() => handleTermClick(term)}
                                                >
                                                    {children}
                                                </span>
                                            );
                                        }
                                        const stepMatch = href?.match(/^#line-(\d+)-step-(\d+)$/);
                                        const lineMatch = !stepMatch ? href?.match(/^#line-(\d+)$/) : null;
                                        const activeMatch = stepMatch ?? lineMatch;
                                        if (activeMatch && image) {
                                            const lineIndex = parseInt(activeMatch[1]) - 1;
                                            const lines = parsedLineData;
                                            const line = lines?.[lineIndex];
                                            if (line?.cnt) {
                                                let cnt: [number, number][];
                                                if (stepMatch) {
                                                    const stepIndex = parseInt(stepMatch[2]) - 1;
                                                    const steps = splitMathLines(line.text ?? "");
                                                    const words = ocr?.wordData as MathpixWord[] | undefined;
                                                    cnt = steps.length > 1
                                                        ? computeStepCnt(line, stepIndex, steps.length, words)
                                                        : line.cnt;
                                                } else {
                                                    cnt = line.cnt;
                                                }
                                                const grouped = resolveGroupForLine(lineIndex);
                                                const cnts = grouped.cnts.length > 0 ? grouped.cnts : [cnt];
                                                const debugBoxIds = grouped.boxIds;
                                                return (
                                                    <span
                                                        className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded px-1 py-0.5 cursor-default font-medium text-[0.8em] hover:bg-amber-200 transition-colors"
                                                        onMouseEnter={() => handleHighlight({ uid: image.uid, cnts })}
                                                        onMouseLeave={() => handleHighlight(null)}
                                                        onClick={() => {
                                                            console.log("[symbiol] chat reference highlight", {
                                                                lineIndex: lineIndex + 1,
                                                                boxIds: debugBoxIds,
                                                                polygonCount: cnts.length,
                                                                cnts,
                                                            });
                                                        }}
                                                    >
                                                        {children}
                                                    </span>
                                                );
                                            }
                                        }
                                        return <a href={href} target="_blank" rel="noopener noreferrer" className="underline">{children}</a>;
                                    },
                                }}
                            >
                                {processMessageContent(msg.content)}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center`}>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className={`px-3 py-3 border-t shrink-0 flex gap-2 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about this problem…"
                    className={`flex-1 text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all ${
                        isDark ? "bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-400" : "border-slate-200"
                    }`}
                    disabled={isTyping}
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    className="w-9 h-9 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
                    aria-label="Send"
                >
                    <Send size={15} />
                </button>
            </div>
        </div>
    );
}
