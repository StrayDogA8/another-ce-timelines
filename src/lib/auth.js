import { ENABLE_CLOUD } from './features.js';
import { apiLogin, apiRegister, apiGetCurrentUser } from './api.js';

const TOKEN_KEY = 'timelines-auth-token';
const USER_KEY = 'timelines-auth-user';

const listeners = new Set();

function notifyListeners(user) {
  listeners.forEach(fn => fn(user));
}

window.addEventListener('auth:session-expired', () => notifyListeners(null));

export function isLoggedIn() {
  if (!ENABLE_CLOUD) return false;
  return !!localStorage.getItem(TOKEN_KEY);
}

export function getToken() {
  if (!ENABLE_CLOUD) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser() {
  if (!ENABLE_CLOUD) return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function login({ email, password }) {
  if (!ENABLE_CLOUD) {
    return { success: false, error: 'Cloud features are disabled.' };
  }

  const result = await apiLogin({ email, password });
  if (!result.success) return result;

  const { token } = result.data;
  localStorage.setItem(TOKEN_KEY, token);

  const userResult = await apiGetCurrentUser();
  const user = userResult.success ? userResult.data : null;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));

  notifyListeners(user);
  return { success: true };
}

export async function register({ email, password }) {
  if (!ENABLE_CLOUD) {
    return { success: false, error: 'Cloud features are disabled.' };
  }

  const result = await apiRegister({ email, password });
  if (!result.success) return result;

  const { token } = result.data;
  localStorage.setItem(TOKEN_KEY, token);

  const userResult = await apiGetCurrentUser();
  const user = userResult.success ? userResult.data : null;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));

  notifyListeners(user);
  return { success: true };
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyListeners(null);
}

export async function refreshCurrentUser() {
  if (!isLoggedIn()) return { success: false, error: 'Not logged in.' };

  const result = await apiGetCurrentUser();
  if (result.success && result.data) {
    localStorage.setItem(USER_KEY, JSON.stringify(result.data));
    notifyListeners(result.data);
  }
  return result;
}

// Returns an unsubscribe function — use in useEffect cleanup.
export function onAuthStateChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
