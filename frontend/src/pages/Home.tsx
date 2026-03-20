import { Link } from "react-router-dom"

export default function Home() {

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-start pt-16 px-6">
            <h1 className="text-3xl font-semibold text-slate-800 bg-transparent border-0 text-center mb-10">Home page</h1>
            <div className="my-3"></div>
            <Link to="/dashboard" className="bg-amber-600 rounded-xl px-10 py-2.5 text-center font-medium text-white shadow-sm hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2">Dashboard</Link>
            <div className="my-3"></div>
            <Link to="/login" className="bg-amber-600 rounded-xl px-10 py-2.5 text-center font-medium text-white shadow-sm hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2">Login</Link>
            <div className="my-3"></div>
            <Link to="/signup" className="bg-amber-600 rounded-xl px-10 py-2.5 text-center font-medium text-white shadow-sm hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2">Create account</Link>
        </div>
    )
}