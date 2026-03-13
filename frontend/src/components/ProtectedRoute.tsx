import type { JSX } from "react";
import { Navigate } from "react-router-dom";

type ProtectedRouteProps = { 
    children: JSX.Element;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const token = localStorage.getItem("jwt");

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (Date.now() >= payload.exp * 1000) {
            localStorage.removeItem("jwt");
            return <Navigate to="/login" replace />;
        }
    } catch {
        localStorage.removeItem("jwt");
        return <Navigate to="/login" replace />;
    }

    return children;
}