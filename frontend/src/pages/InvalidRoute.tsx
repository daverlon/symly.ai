import { useNavigate } from "react-router-dom";

export default function InvalidRoute() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-700">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/70 p-6 text-center">

                <div className="text-4xl font-semibold text-slate-900">
                    404
                </div>

                <div className="text-lg font-semibold text-slate-700 mt-2">
                    Page not found
                </div>

                <div className="text-sm text-slate-500 mt-3">
                    The page you’re looking for doesn’t exist or the link is invalid.
                </div>

                <button
                    onClick={() => navigate("/")}
                    className="mt-6 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition"
                >
                    Go to home
                </button>
            </div>
        </div>
    );
}