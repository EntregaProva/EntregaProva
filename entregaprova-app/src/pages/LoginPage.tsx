import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { createUserWithEmailAndPassword, sendEmailVerification, type User } from "firebase/auth";
import { useAuth } from "../auth/useAuth.ts";
import { apiFetch, mensagemDoErro } from "../api/client.ts";
import { auth } from "../firebase.ts";

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

export default function LoginPage({ user }: { user: User | null }) {
  return user ? <CompleteRegistration key={user.uid} user={user} /> : <LoginForm />;
}

function LoginForm() {
  const { signIn } = useAuth();
  const [cadastro, setCadastro] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      if (cadastro) {
        const { user } = await createUserWithEmailAndPassword(auth, email.trim(), senha);
        await sendEmailVerification(user);
      } else {
        await signIn(email.trim(), senha);
      }
    } catch (e: unknown) {
      setErro(cadastro
        ? "Não foi possível concluir esta etapa. Se você já tem conta, entre para continuar."
        : mensagemDeLogin(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="panel login-card" onSubmit={handleSubmit}>
        <img src="/logo-entregaprova.png" alt="EntregaProva" className="login-logo" />
        <h1>{cadastro ? "Criar conta" : "Entrar"}</h1>
        {cadastro && <p className="muted">Confirme seu e-mail para cadastrar uma pessoa física ou uma empresa.</p>}

        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" autoComplete={cadastro ? "new-password" : "current-password"}
          minLength={cadastro ? 6 : undefined} required value={senha} onChange={(e) => setSenha(e.target.value)} />

        {erro && (
          <div className="alert error" role="alert">
            <span aria-hidden="true">✕</span> {erro}
          </div>
        )}

        <button type="submit" className="button primary full" disabled={enviando}>
          {enviando ? "Aguarde..." : cadastro ? "Criar conta" : "Entrar"}
        </button>
        <button type="button" className="button secondary full" disabled={enviando} onClick={() => {
          setCadastro(!cadastro);
          setErro(null);
          setSenha("");
        }}>
          {cadastro ? "Voltar ao login" : "Criar uma conta"}
        </button>
      </form>
    </div>
  );
}

function CompleteRegistration({ user }: { user: User }) {
  const { refreshRole, signOut } = useAuth();
  const [verificado, setVerificado] = useState(user.emailVerified);
  const [tipo, setTipo] = useState("cpf");
  const [documento, setDocumento] = useState("");
  const [papel, setPapel] = useState("admin");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const executar = async (acao: () => Promise<void>) => {
    setEnviando(true);
    setErro(null);
    setMensagem(null);
    try {
      await acao();
    } catch (e: unknown) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const concluir = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void executar(async () => {
      await user.getIdToken(true);
      await apiFetch<void>("/cadastros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, documento, papel }),
      });
      await refreshRole();
    });
  };

  return (
    <div className="login-wrap">
      <form className="panel login-card form-panel" onSubmit={concluir}>
        <img src="/logo-entregaprova.png" alt="EntregaProva" className="login-logo" />
        <h1>{verificado ? "Concluir cadastro" : "Confirmar e-mail"}</h1>
        {verificado ? (
          <>
            <p className="muted">O cadastro cria um espaço novo. Para entrar em uma empresa existente, peça um convite ao administrador.</p>
            <label htmlFor="tipo">Tipo de cadastro</label>
            <select id="tipo" value={tipo} disabled={enviando} onChange={(e) => {
              setTipo(e.target.value);
              setDocumento("");
              if (e.target.value === "cnpj" && papel === "driver") setPapel("admin");
            }}>
              <option value="cpf">Pessoa física (CPF)</option>
              <option value="cnpj">Empresa / pessoa jurídica (CNPJ)</option>
            </select>
            <label htmlFor="documento">{tipo.toUpperCase()}</label>
            <input id="documento" value={documento} onChange={(e) => setDocumento(e.target.value)}
              inputMode={tipo === "cpf" ? "numeric" : "text"} maxLength={tipo === "cpf" ? 14 : 18}
              required disabled={enviando} />
            <label htmlFor="papel">Papel no novo espaço</label>
            <select id="papel" value={papel} onChange={(e) => setPapel(e.target.value)} disabled={enviando}>
              <option value="admin">Administrador</option>
              <option value="operator">Operador</option>
              {tipo === "cpf" && <option value="driver">Motorista</option>}
            </select>
            <button type="submit" className="button primary full" disabled={enviando}>
              {enviando ? "Concluindo..." : "Concluir cadastro"}
            </button>
          </>
        ) : (
          <>
            <p className="muted">Abra o link de verificação recebido no seu e-mail para continuar.</p>
            <button type="button" className="button primary full" disabled={enviando} onClick={() => void executar(async () => {
              await user.reload();
              setVerificado(user.emailVerified);
              if (!user.emailVerified) setMensagem("O e-mail ainda não foi confirmado. Confira sua caixa de entrada.");
            })}>Já confirmei meu e-mail</button>
            <button type="button" className="button secondary full" disabled={enviando} onClick={() => void executar(async () => {
              await sendEmailVerification(user);
              setMensagem("E-mail de confirmação enviado.");
            })}>Reenviar e-mail</button>
          </>
        )}
        {erro && <div className="alert error" role="alert">{erro}</div>}
        {mensagem && <p role="status">{mensagem}</p>}
        <button type="button" className="button secondary full" disabled={enviando}
          onClick={() => void executar(signOut)}>Sair</button>
      </form>
    </div>
  );
}
