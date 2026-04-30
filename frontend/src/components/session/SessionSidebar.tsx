import { Plus, X } from "lucide-react";
import type { SessionId } from "../../api/sessionsApi";

interface SessionSidebarProps {
    isDark?: boolean;
    isOpen: boolean;
    sessions: SessionId[];
    activeSessionId: string | null;
    onClose: () => void;
    onSelectSession: (id: string) => void;
    onCreateSession: () => void;
    onDeleteSession: (id: string) => void;
    onDeleteAll: () => void;
}

export function SessionSidebar({
    isDark = false,
    isOpen,
    sessions,
    activeSessionId,
    onClose,
    onSelectSession,
    onCreateSession,
    onDeleteSession,
    onDeleteAll,
}: SessionSidebarProps) {
    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className={`fixed inset-0 z-30 ${isDark ? "bg-black/50" : "bg-slate-900/20"}`}
                    onClick={onClose}
                />
            )}

            {/* Drawer */}
            <aside
                className={`fixed left-0 top-14 z-40 w-72 h-[calc(100vh-3.5rem)] bg-white/95 backdrop-blur border-r border-slate-200 transition-transform duration-200 ${
                    isDark ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-slate-200"
                } ${
                    isOpen ? "translate-x-0" : "-translate-x-full"
                }`}
                aria-label="Sessions sidebar"
            >
                <div className="h-full flex flex-col">
                    <div className={`p-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                        <button
                            onClick={onCreateSession}
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
                                className={`group flex items-center justify-between rounded-lg px-2 py-1.5 ${
                                    activeSessionId === s.id
                                        ? (isDark ? "bg-blue-900/40 text-blue-300" : "bg-blue-50 text-blue-700")
                                        : (isDark ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-50")
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => onSelectSession(s.id)}
                                    className="flex-1 text-left text-sm cursor-pointer"
                                >
                                    {`${s.id} (${new Date(s.creationDate).toLocaleString()})`}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteSession(s.id);
                                    }}
                                    className={`ml-2 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                                        isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"
                                    }`}
                                    aria-label={`Delete session ${s.id}`}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className={`p-2 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                        <button
                            onClick={onDeleteAll}
                            disabled={!sessions.length}
                            className="w-full rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Delete all sessions
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
