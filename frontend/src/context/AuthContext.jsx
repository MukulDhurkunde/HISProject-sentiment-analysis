import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const API_BASE = 'http://localhost:8000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // { username, role }
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);  // true while checking stored token

  // On mount, check if a valid token exists in localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      // Validate token by calling /api/me
      fetch(`${API_BASE}/api/me`, {
        headers: { 'Authorization': `Bearer ${storedToken}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Token invalid');
        })
        .then((data) => {
          setToken(storedToken);
          setUser({ username: data.username, role: data.role });
        })
        .catch(() => {
          // Token is invalid or expired — clear it
          localStorage.removeItem('auth_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Authenticate and store JWT. Returns { success, error? }
  const login = async (username, password) => {
    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.detail || 'Invalid username or password',
        };
      }

      const data = await response.json();
      setToken(data.access_token);
      setUser({ username: data.username, role: data.role });
      localStorage.setItem('auth_token', data.access_token);

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: 'Unable to connect to the server. Please try again.',
      };
    }
  };

  // Clear auth state and remove stored token.
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
