import { useState } from "react";
import { signupAccount } from "../api/accountsApi";

export default function SignupModal({
    onSuccess,
    onSwitch
}: {
    onSuccess: () => void;
    onSwitch: () => void;
}) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");

    async function handleSignUp(e: React.FormEvent) {
        e.preventDefault();

        if (password !== passwordConfirmation) {
            alert("Password confirmation must match.");
            return;
        }

        try {
            const result = await signupAccount(username, password);
            alert(result.message);

            onSuccess();

        } catch (err) {
            if (err instanceof Error) {
                alert(err.message);
            }
            console.error("signup failed.");
        }
    }

    return (
        <form onSubmit={handleSignUp}>
            <h1 className="text-xl mb-6 font-semibold">Create Account</h1>

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

            <input
                type="password"
                placeholder="Confirm Password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                className="border w-full p-2 mb-4 rounded"
            />

            <button
                type="submit"
                className="bg-blue-500 text-white w-full p-2 rounded"
            >
                Create
            </button>

            <button
                type="button"
                onClick={onSwitch}
                className="mt-4 text-sm text-blue-600"
            >
                Already have an account? Login
            </button>
        </form>
    );
}