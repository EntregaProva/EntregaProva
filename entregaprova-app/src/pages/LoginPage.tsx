import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { useAuth } from "../auth/useAuth.ts";

function mensagemDeLogin(erro: unknown): string {
  if (erro instanceof FirebaseError) {
    if (erro.code === "auth/network-request-failed") {
      return "Não foi possível falar com o serviço de login. O emulador do Firebase Auth está rodando?";
    }
    if (erro.code === "auth/too-many-requests") {
      return "Muitas tentativas. Aguarde um pouco e tente de novo.";
    }
  }
  return "E-mail ou senha incorretos.";
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

        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />

        {erro && (
          <div className="alert error" role="alert">
            <span aria-hidden="true">✕</span> {erro}
          </div>
        )}

        <button type="submit" className="button primary full" disabled={enviando}>
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
