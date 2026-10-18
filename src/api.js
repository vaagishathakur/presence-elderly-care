// Presence Dashboard API Client Helper
// Connects the React dashboard to the Node.js/Express backend

export const DEFAULT_BASE_URL = "https://elderly-monitoring-backend.onrender.com/api";

export function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (!envUrl) return DEFAULT_BASE_URL;
  return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
}

export const API_BASE = getApiBaseUrl();

let authToken = localStorage.getItem("presence_id_token") || "";
let unauthorizedListeners = [];

export function setAuthToken(token) {
  authToken = token || "";
  if (token) {
    localStorage.setItem("presence_id_token", token);
  } else {
    localStorage.removeItem("presence_id_token");
  }
}

export function getAuthToken() {
  return authToken;
}

export function onUnauthorized(listener) {
  unauthorizedListeners.push(listener);
  return () => {
    unauthorizedListeners = unauthorizedListeners.filter((l) => l !== listener);
  };
}

function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error("Error in onUnauthorized listener:", err);
    }
  });
}

/**
 * Universal safe API request wrapper
 */
export async function apiRequest(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${normalizedEndpoint}`;

  const headers = {
    Accept: "application/json",
    ...options.headers,
  };

  if (authToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      notifyUnauthorized();
      const errBody = await response.json().catch(() => ({}));
      const error = new Error(errBody.message || "Your session has expired. Please log in again.");
      error.status = 401;
      throw error;
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const error = new Error(errBody.message || `API request failed with status ${response.status}`);
      error.status = response.status;
      error.data = errBody;
      throw error;
    }

    // 204 No Content
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    if (error.status) throw error;

    // Network error (backend down, CORS, offline)
    console.warn(`[API] Network failure at ${url}:`, error.message);
    const networkError = new Error(
      "Unable to connect to the Presence backend. Please verify the server is running."
    );
    networkError.isNetworkError = true;
    throw networkError;
  }
}

// -------------------------------------------------------------
// Typed Domain Methods
// -------------------------------------------------------------

export const api = {
  // Health
  getHealth: () => apiRequest("/health"),

  // Caregiver identity and assigned elders
  getMe: () => apiRequest("/me"),

  // Elder status and profile
  getUserProfile: (userId) => apiRequest(`/users/${userId}`),
  getUserStatus: (userId) => apiRequest(`/users/${userId}/status`),

  // Interactions and Timeline
  getUserInteractions: (userId, { limit = 20, offset = 0 } = {}) =>
    apiRequest(`/users/${userId}/interactions?limit=${limit}&offset=${offset}`),

  // Alerts
  getUserAlerts: (userId, { status } = {}) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiRequest(`/users/${userId}/alerts${query}`);
  },
  acknowledgeAlert: (alertId, note = "Acknowledged via dashboard by caregiver.") =>
    apiRequest(`/alerts/${alertId}/acknowledge`, {
      method: "POST",
      body: { note },
    }),
  resolveAlert: (alertId, note = "Resolved by caregiver.") =>
    apiRequest(`/alerts/${alertId}/resolve`, {
      method: "POST",
      body: { note },
    }),

  // Medications
  getUserMedications: (userId) => apiRequest(`/users/${userId}/medications`),
  createMedicationSchedule: (userId, scheduleData) =>
    apiRequest(`/users/${userId}/medications`, {
      method: "POST",
      body: scheduleData,
    }),
  confirmMedication: (userId, { scheduleId, logId }) =>
    apiRequest(`/users/${userId}/medications/confirm`, {
      method: "POST",
      body: { scheduleId, logId },
    }),

  // Alexa Voice Simulator
 simulateAlexa: (payload) =>
  apiRequest("/alexa/simulate", {
    method: "POST",
    body: payload,
  }),
};