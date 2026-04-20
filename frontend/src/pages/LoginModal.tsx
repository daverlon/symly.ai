import { useState } from "react";
import { loginAccount } from "../api/accountsApi";

export default function LoginModal({
    onSuccess,
    onSwitch
}: {
    onSuccess: () => void;
    onSwitch: () => void;
}) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();

        try {
            const result = await loginAccount(username, password);
            localStorage.setItem("jwt", result.token);

            onSuccess();

        } catch (err) {
            if (err instanceof Error) {
                alert(err.message);
            }
            console.error("login failed", err);
        }
    }

    return (
        <form onSubmit={handleLogin}>
            <h1 className="text-xl mb-6 font-semibold">Login</h1>

            <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="border w-full p-2 mb-4 rounded"
            />

            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border w-full p-2 mb-4 rounded"
            />

            <button
                type="submit"
                className="bg-blue-500 text-white w-full p-2 rounded"
            >
                Login
            </button>

            <button
                type="button"
                onClick={onSwitch}
                className="mt-4 text-sm text-blue-600"
            >
                Don’t have an account? Sign up
            </button>
        </form>
    );
}