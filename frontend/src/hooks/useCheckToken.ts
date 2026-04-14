import { useEffect, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { verifyToken } from "../api/accountsApi";

export function useCheckToken(

    navigate: NavigateFunction,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
    
) {

    const [username, setUsername] = useState<string | null>(null);

    useEffect(() => {

        const run = async () => {
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
        };

        run();

    }, [navigate, setUsername, setLoading]);

    return { username, setUsername };
}