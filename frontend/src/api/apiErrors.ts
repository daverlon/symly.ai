export function isAuthError(err: any): boolean {
    const msg = err?.message?.toLowerCase?.() ?? "";
    return msg.includes("not authenticated") || msg.includes("unauthorized");
}