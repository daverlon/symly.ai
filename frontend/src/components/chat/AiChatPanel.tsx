import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { DeskImage } from "../../api/imageApi";
import { getDeskImageOcr, clearDeskImageOcr, type OcrResult } from "../../api/ocrApi";
import { sendChatMessage, type ChatMessage } from "../../api/chatApi";

type MathpixLine = {
    type?: string;
    text?: string;
    cnt?: [number, number][];
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
    cnt: [number, number][];
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
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
    const [ocr, setOcr] = useState<OcrResult | null>(null);
    const [ocrExpanded, setOcrExpanded] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const parsedLineData = normalizeLineData(ocr?.lineData);

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

    // Reset state when image changes
    useEffect(() => {
        setMessages([WELCOME_MESSAGE]);
        setInput("");
        setOcr(null);
        setOcrExpanded(false);
        setOcrStatus("idle");
    }, [image?.uid, sessionId]);

    // Automatically load OCR when chat opens
    useEffect(() => {
        if (image && sessionId) {
            fetchOcr(sessionId, image.uid);
        }
    }, [image?.uid, sessionId]);

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

                <button
                    onClick={onClose}
                    className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-md transition-colors ${
                        isDark ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    }`}
                    aria-label="Close chat"
                >
                    <X size={15} />
                </button>
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
                    <div className="px-4 pb-3 max-h-56 overflow-y-auto space-y-3">
                        <div>
                            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                                Mathpix output (raw)
                            </p>
                            <pre className={`text-xs whitespace-pre-wrap font-mono leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                                {JSON.stringify(
                                    {
                                        text: ocr?.mathpixText ?? null,
                                        lineData: ocr?.mathpixLineData ?? null,
                                        wordData: ocr?.mathpixWordData ?? null,
                                    },
                                    null,
                                    2,
                                )}
                            </pre>
                        </div>
                        <div>
                            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                                PP-OCRv5 output (raw)
                            </p>
                            <pre className={`text-xs whitespace-pre-wrap font-mono leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                                {JSON.stringify(
                                    {
                                        text: ocr?.ppocrText ?? null,
                                        lineData: ocr?.lineData ?? null,
                                        wordData: ocr?.wordData ?? null,
                                    },
                                    null,
                                    2,
                                )}
                            </pre>
                        </div>
                        <div>
                            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                                Merged raw output
                            </p>
                            <pre className={`text-xs whitespace-pre-wrap font-mono leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                                {typeof ocr?.mergedRawOutput === "string"
                                    ? ocr.mergedRawOutput
                                    : JSON.stringify(ocr?.mergedRawOutput ?? null, null, 2)}
                            </pre>
                        </div>
                        <div>
                            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                                Expression raw output
                            </p>
                            <pre className={`text-xs whitespace-pre-wrap font-mono leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                                {typeof ocr?.expressionRawOutput === "string"
                                    ? ocr.expressionRawOutput
                                    : JSON.stringify(ocr?.expressionRawOutput ?? null, null, 2)}
                            </pre>
                        </div>
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
                                                return (
                                                    <span
                                                        className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded px-1 py-0.5 cursor-default font-medium text-[0.8em] hover:bg-amber-200 transition-colors"
                                                        onMouseEnter={() => handleHighlight({ uid: image.uid, cnt })}
                                                        onMouseLeave={() => handleHighlight(null)}
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
