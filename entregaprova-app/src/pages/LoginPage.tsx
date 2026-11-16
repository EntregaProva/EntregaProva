import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { useAuth } from "../auth/useAuth.ts";
import { firebaseConfigError, usingAuthEmulator } from "../firebase.ts";

function mensagemDeLogin(erro: unknown): string {
  if (erro instanceof Error && erro.message.startsWith("Firebase Web não configurado:")) return erro.message;
  if (erro instanceof FirebaseError) {
    if (erro.code === "auth/network-request-failed") {
      return usingAuthEmulator
        ? "Não foi possível falar com o Firebase Auth Emulator. Inicie os emuladores com Docker Compose e confirme a porta 9099."
        : "Não foi possível falar com o Firebase Authentication. Confira a internet e a configuração do projeto Firebase.";
    }
    if (erro.code === "auth/too-many-requests") {
      return "Muitas tentativas. Aguarde um pouco e tente de novo.";
    }
    if (erro.code === "auth/operation-not-allowed") {
      return "O provedor E-mail/senha está desativado no Firebase Authentication. Ative-o nas configurações do projeto.";
    }
    if (erro.code === "auth/invalid-api-key" || erro.code === "auth/api-key-not-valid") {
      return "A chave do Firebase Web está ausente ou inválida. Confira VITE_FIREBASE_API_KEY.";
    }
    if (erro.code === "auth/invalid-credential" || erro.code === "auth/user-not-found" || erro.code === "auth/wrong-password") {
      return usingAuthEmulator
        ? "Conta não encontrada no emulador. Rode o seed do backend e use um dos usuários de teste."
        : "E-mail ou senha incorretos.";
    }
  }
  return erro instanceof Error ? erro.message : "Não foi possível entrar. Confira a configuração do Firebase e tente novamente.";
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await signIn(email.trim(), senha);
    } catch (e: unknown) {
      setErro(mensagemDeLogin(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="panel login-card" onSubmit={handleSubmit}>
        <img src="/logo-entregaprova.png" alt="EntregaProva" className="login-logo" />
        <h1>Entrar</h1>
        <p className="muted">Seja bem-vindo ao EntregaProva! Por favor, efetue login para continuar :D</p>

        {firebaseConfigError && <div className="alert error" role="alert">{firebaseConfigError}</div>}

        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />

        {erro && (
          <div className="alert error" role="alert">
            <span aria-hidden="true">✕</span> {erro}
          </div>
        )}

        <button type="submit" className="button primary full" disabled={enviando || Boolean(firebaseConfigError)}>
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
