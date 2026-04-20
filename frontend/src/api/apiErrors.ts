export function isAuthError(e: any): boolean {
    return (
        e?.status === 401 ||
        e?.response?.status === 401 ||
        e?.message?.toLowerCase?.().includes("unauthorized")
    );
}