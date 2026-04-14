import { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";


export function useHandleSessionChange(
    navigate: NavigateFunction,


    activeSessionId: string | null,

    setLoading: React.Dispatch<React.SetStateAction<boolean>>,

    clearSessionState: () => void

) {
    console.log("Handle Session Change");

    useEffect(() => {

        clearSessionState();
        setLoading(true);

        if (!activeSessionId) {
            navigate("/dashboard");
            setLoading(false);
            return;
        }
        navigate(`/dashboard/s/${activeSessionId}`);

        setLoading(false);

    }, [activeSessionId, navigate]);

}