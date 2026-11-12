import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getIdTokenResult, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from "firebase/auth";
import { auth } from "../firebase.ts";
import { AuthContext, type AuthContextValue } from "./useAuth.ts";

async function readRole(user: User, refresh = false) {
  const { claims } = await getIdTokenResult(user, refresh);
  const role = claims.role;
  return role === "admin" || role === "operator" || role === "driver" ? role : null;
}

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
        const value = await readRole(u);
        if (currentRequest === requestId) {
          setRole(value);
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
      refreshRole: async () => {
        if (!user) return;
        const value = await readRole(user, true);
        if (auth.currentUser === user) setRole(value);
      },
    }),
    [user, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
