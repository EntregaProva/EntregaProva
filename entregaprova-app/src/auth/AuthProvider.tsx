import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getIdTokenResult, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, type User } from "firebase/auth";
import { auth, firebaseConfigError } from "../firebase.ts";
import { AuthContext, type AuthContextValue } from "./useAuth.ts";

type Role = AuthContextValue["role"];
type RoleCheck = { role: Role; issue: string | null };

async function readRole(user: User, refresh = false): Promise<RoleCheck> {
  const { claims } = await getIdTokenResult(user, refresh);
  const value = claims.role;
  const tenantId = claims.tenantId;
  if (value === undefined || value === null) return { role: null, issue: null };
  if (value !== "admin" && value !== "operator" && value !== "driver") {
    return { role: null, issue: "Sua conta não tem um papel aceito pela API. Use admin, operator ou driver; no emulador, recrie as contas com npm run seed." };
  }
  if (typeof tenantId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(tenantId)) {
    return { role: null, issue: "Sua conta não tem a claim tenantId válida exigida pela API. Atualize as claims do backend e entre novamente." };
  }
  return { role: value, issue: null };
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
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
        // Force refresh so new accounts can receive claims just added by the registration flow or emulator seed.
        const result = await readRole(u, true);
        if (currentRequest === requestId) {
          setRole(result.role);
          setAuthIssue(result.issue);
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
      refreshRole: async () => {
        if (!user) return;
        const result = await readRole(user, true);
        if (auth.currentUser === user) {
          setRole(result.role);
          setAuthIssue(result.issue);
        }
      },
    }),
    [user, role, authIssue, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
