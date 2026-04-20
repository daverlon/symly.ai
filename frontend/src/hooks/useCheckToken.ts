import { useEffect, useState } from "react";
import { verifyToken } from "../api/accountsApi";

export function useCheckToken(
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
    
) {

    const [username, setUsername] = useState<string | null>(null);

    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {

        const run = async () => {
            const token = localStorage.getItem("jwt");

            if (!token) {
                setIsAuthenticated(false);
                return;
            }

            try {
                const result = await verifyToken(token);
                setUsername(result.username);
                setIsAuthenticated(true);
            } catch (err) {
                console.error("Token verification failed.");
                localStorage.removeItem("jwt");
                setIsAuthenticated(false);
            } finally {
                setLoading(false);
            }
        };

        run();

    }, [setUsername, setLoading]);

    return { username, setUsername, isAuthenticated, setIsAuthenticated };
}