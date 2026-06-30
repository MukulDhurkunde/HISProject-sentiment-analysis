/**
 * Authenticated fetch wrapper.
 * Automatically injects the JWT Authorization header from localStorage.
 * If the server responds with 401 (token expired/invalid), the user is
 * automatically logged out and redirected to the login page.
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

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If the server says the token is invalid/expired, auto-logout
  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    // Only redirect if we're not already on the login page
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
  }

  return response;
}
