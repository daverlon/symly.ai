import { Link } from "react-router-dom"

export default function Home() {

    return (
        <div className="grid justify-center">
            <h1 className="bg-gray-50 underline border-0 text-center">Home page</h1>
            <div className="my-3"></div>
            <Link to="/dashboard" className="bg-amber-600 italic rounded-3xl px-10 text-center">Dashboard</Link>
            <div className="my-3"></div>
            <Link to="/login" className="bg-amber-600 italic rounded-3xl px-10 text-center">Login</Link>
            <div className="my-3"></div>
            <Link to="/signup" className="bg-amber-600 italic rounded-3xl px-10 text-center">Create account</Link>
        </div>
    )
}