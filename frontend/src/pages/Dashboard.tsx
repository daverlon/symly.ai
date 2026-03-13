import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { verifyToken } from "../api/accountsApi"

export default function Dashboard() {

    const navigate = useNavigate();
    const [username, setUsername] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        checkToken();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <h1>Symbiol dashboard</h1>
            <div className="w-80">
                <button onClick={handleSignOut} className="bg-blue-300 rounded-sm px-5 text-center self-start">Sign out</button>
            </div>
            <br />
            <h1>Welcome {username}</h1>
        </div>
    );
}