import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getIdTokenResult, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from "firebase/auth";
import { auth, firebaseConfigError } from "../firebase.ts";
import { AuthContext, type AuthContextValue } from "./useAuth.ts";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "operator" | "driver" | null>(null);
  const [authIssue, setAuthIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let requestId = 0;
    return onAuthStateChanged(auth, async (u) => {
      const currentRequest = ++requestId;
      setUser(u);
      setRole(null);
      setAuthIssue(null);
      if (!u) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Force refresh so a user receives claims just added by the emulator seed.
        const token = await getIdTokenResult(u, true);
        const value = token.claims.role;
        const tenantId = token.claims.tenantId;
        if (currentRequest === requestId) {
          if (value !== "admin" && value !== "operator" && value !== "driver") {
            setAuthIssue("Sua conta não tem um papel aceito pela API. Use admin, operator ou driver; no emulador, recrie as contas com npm run seed.");
          } else if (typeof tenantId !== "string" || !tenantId.trim()) {
            setAuthIssue("Sua conta não tem a claim tenantId exigida pela API. Atualize o seed do backend e entre novamente.");
          } else {
            setRole(value);
          }
        }
      } catch {
        if (currentRequest === requestId) {
          setRole(null);
          setAuthIssue("Não foi possível ler as permissões da sua conta. Tente sair e entrar novamente.");
        }
      } finally {
        if (currentRequest === requestId) setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      authIssue,
      loading,
      signIn: async (email, password) => {
        if (firebaseConfigError) throw new Error(firebaseConfigError);
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOut: () => fbSignOut(auth),
    }),
    [user, role, authIssue, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
