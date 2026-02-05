export const API_BASE = "http://localhost:8000";

export const setToken = (token: string) => {
    if (typeof window !== "undefined") {
        localStorage.setItem("token", token);
    }
};

export const getToken = () => {
    if (typeof window !== "undefined") {
        return localStorage.getItem("token");
    }
    return null;
};

export const logout = () => {
    if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        window.location.href = "/login";
    }
}

export const fetchAuth = async (endpoint: string, options: RequestInit = {}) => {
    const token = getToken();
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        logout();
        throw new Error("Unauthorized");
    }

    if (!response.ok) {
        try {
            const validJson = await response.clone().json();
            throw new Error(validJson.detail || "API Error");
        } catch (e) {
            throw new Error(`API Error: ${response.statusText}`);
        }
    }

    return response;
};
