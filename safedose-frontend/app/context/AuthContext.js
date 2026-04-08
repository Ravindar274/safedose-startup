'use client';
// app/context/AuthContext.js
//
// Fetches the logged-in user once on mount from /api/user/profile (httpOnly cookie).
// Provides { user, loading } to any component via useAuth().
// No props — derives everything from the session cookie.

import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/profile', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        setUser(data?.user ?? null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
