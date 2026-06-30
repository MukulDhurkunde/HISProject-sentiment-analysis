/**
 * Authenticated fetch wrapper.
 * Automatically injects the JWT Authorization header from localStorage.
 * Falls back to a regular fetch if no token is stored.
 *
 * Usage:  authFetch(url, { method: 'POST', body: ... })
 */
export async function authFetch(url, options = {}) {
  const token = localStorage.getItem('auth_token');

  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
