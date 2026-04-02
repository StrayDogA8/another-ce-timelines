import { ENABLE_CLOUD } from './features.js';
import { getToken } from './auth.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function request(method, path, body, { skipSessionExpiry = false } = {}) {
  if (!ENABLE_CLOUD) {
    return { success: false, error: 'Cloud features are disabled.' };
  }

  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401) {
        localStorage.removeItem('timelines-auth-token');
        localStorage.removeItem('timelines-auth-user');
        window.dispatchEvent(new Event('auth:session-expired'));
      } else if (res.status === 403 && text.toLowerCase().includes('verified')) {
        // Email verification block — do NOT clear the session
        return { success: false, error: 'Please verify your email to use cloud sync.', unverified: true };
      } else if (res.status === 403 && token && !skipSessionExpiry) {
        localStorage.removeItem('timelines-auth-token');
        localStorage.removeItem('timelines-auth-user');
        window.dispatchEvent(new Event('auth:session-expired'));
      }
      return { success: false, error: `HTTP ${res.status}${text ? `: ${text}` : ''}` };
    }

    if (res.status === 204) {
      return { success: true };
    }

    const data = await res.json().catch(() => null);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function apiLogin({ email, password }) {
  return request('POST', '/api/auth/login', { email, password });
}


export async function apiGetCurrentUser() {
  return request('GET', '/api/users/me');
}

export async function apiListTimelines() {
  return request('GET', '/api/timelines');
}

// Returns an array (0 or 1 match) — backend contract for slug lookups.
export async function apiGetTimelineBySlug(slug) {
  return request('GET', `/api/timelines?slug=${encodeURIComponent(slug)}`);
}

// ownerId is auto-set by the backend from the JWT — do not include it in payload.
export async function apiCreateTimeline(payload) {
  return request('POST', '/api/timelines', payload);
}

export async function apiGetTimelineById(id) {
  return request('GET', `/api/timelines/${id}`);
}

export async function apiUpdateTimeline(id, payload) {
  return request('PUT', `/api/timelines/${id}`, payload);
}

export async function apiDeleteTimeline(id) {
  return request('DELETE', `/api/timelines/${id}`);
}

export async function apiHealth() {
  return request('GET', '/api/health');
}

export async function apiLogout() {
  return request('POST', '/api/auth/logout');
}

