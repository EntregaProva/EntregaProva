import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getIdTokenResult, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from "firebase/auth";
import { auth } from "../firebase.ts";
import { AuthContext, type AuthContextValue } from "./useAuth.ts";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "operator" | "driver" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let requestId = 0;
    return onAuthStateChanged(auth, async (u) => {
      const currentRequest = ++requestId;
      setUser(u);
      setRole(null);
      if (!u) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const token = await getIdTokenResult(u);
        const value = token.claims.role;
        if (currentRequest === requestId) {
          setRole(value === "admin" || value === "operator" || value === "driver" ? value : null);
        }
      } catch {
        if (currentRequest === requestId) setRole(null);
      } finally {
        if (currentRequest === requestId) setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      loading,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOut: () => fbSignOut(auth),
    }),
    [user, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
