const API_BASE = "http://localhost:8080/api";

export async function createCustomer(firstName: string, lastName: string): Promise<string> {
    const response = await fetch(
        `${API_BASE}/createCustomer?firstName=${firstName}&lastName=${lastName}`
    );
    if (!response.ok) {
        throw new Error(`Failed to create customer.`);
    }
    return await response.text();
}