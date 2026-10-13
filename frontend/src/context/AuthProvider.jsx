import { useCallback, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "../api/client";
import { AuthContext } from "./auth-context";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only show the loading screen if there's a saved token to check.
  const [isCheckingSession, setIsCheckingSession] = useState(() => Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // Restore the session on page load.
  useEffect(() => {
    if (!tokenStore.get()) return;
    const controller = new AbortController();

    api
      .me({ signal: controller.signal })
      .then((data) => setUser(data.user))
      .catch((error) => {
        if (error.name === "AbortError") return;
        // A network error keeps the token so a refresh can retry; 401 already logged out.
        console.error("Could not restore session:", error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsCheckingSession(false);
      });

    return () => controller.abort();
  }, []);

  const handleAuth = useCallback((data) => {
    tokenStore.set(data.token);
    setUser(data.user);
  }, []);

  const login = useCallback(
    async (email, password) => handleAuth(await api.login({ email, password })),
    [handleAuth],
  );

  const register = useCallback(
    async (name, email, password) => handleAuth(await api.register({ name, email, password })),
    [handleAuth],
  );

  const value = useMemo(
    () => ({ user, isCheckingSession, login, register, logout }),
    [user, isCheckingSession, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
