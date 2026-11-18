import { useEffect, useRef, useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { createUserWithEmailAndPassword, sendEmailVerification, type User } from "firebase/auth";
import { apiFetch, mensagemDoErro } from "../api/client.ts";
import { useAuth } from "../auth/useAuth.ts";
import { auth, firebaseConfigError } from "../firebase.ts";
import "./LoginPage.css";

function mensagemDeLogin(erro: unknown): string {
  if (erro instanceof FirebaseError) {
    if (erro.code === "auth/network-request-failed") {
      return "Não foi possível falar com o serviço de login. O emulador do Firebase Auth está rodando?";
    }
    if (erro.code === "auth/too-many-requests") return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  }
  return "E-mail ou senha incorretos.";
}

const passos = [
  { icon: "XML", title: "Importação de NF-e", copy: "Organize os dados do documento fiscal e vincule cada entrega ao motorista responsável." },
  { icon: "◎", title: "Captura no celular", copy: "Registre o comprovante no destino com foto, nome de quem recebeu e horário." },
  { icon: "✓", title: "Conferência lado a lado", copy: "Compare os dados da entrega com o comprovante e registre a aprovação ou a rejeição." },
];

export default function LoginPage({ user }: { user: User | null }) {
  return user ? <CompleteRegistration key={user.uid} user={user} /> : <LandingPage />;
}

function LandingPage() {
  const { signIn } = useAuth();
  const [loginAberto, setLoginAberto] = useState(false);
  const [cadastro, setCadastro] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const focoAnteriorRef = useRef<HTMLElement | null>(null);

  const abrirLogin = () => {
    focoAnteriorRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setErro(null);
    setLoginAberto(true);
  };

  const fecharLogin = () => {
    setLoginAberto(false);
    focoAnteriorRef.current?.focus();
  };

  useEffect(() => {
    if (!loginAberto) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.requestAnimationFrame(() => emailRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setLoginAberto(false); focoAnteriorRef.current?.focus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflowAnterior;
    };
  }, [loginAberto]);


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      if (firebaseConfigError) throw new Error(firebaseConfigError);
      if (cadastro) {
        const { user: newUser } = await createUserWithEmailAndPassword(auth, email.trim(), senha);
        await sendEmailVerification(newUser);
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
    <div className="landing-page" id="inicio">
      <header className="lp-navbar">
        <div className="lp-wrap lp-navinner">
          <a className="lp-brand" href="#inicio" aria-label="EntregaProva — início">
            <img src="/logo-entregaprova.png" alt="EntregaProva" />
          </a>
          <nav className={`lp-navlinks${menuAberto ? " is-open" : ""}`} aria-label="Navegação principal">
            <a href="#recursos" onClick={() => setMenuAberto(false)}>Recursos</a>
            <a href="#como-funciona" onClick={() => setMenuAberto(false)}>Como funciona</a>
            <a href="#beneficios" onClick={() => setMenuAberto(false)}>Benefícios</a>
          </nav>
          <div className="lp-navactions">
            <button className="lp-button lp-primary lp-open-login" type="button" onClick={abrirLogin}>Acessar minha conta <span aria-hidden="true">→</span></button>
            <button className="lp-mobilemenu" type="button" aria-label={menuAberto ? "Fechar menu" : "Abrir menu"} aria-expanded={menuAberto} onClick={() => setMenuAberto((open) => !open)}>{menuAberto ? "×" : "☰"}</button>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-herogrid">
            <div className="lp-herocopy">
              <p className="lp-eyebrow"><i aria-hidden="true" /> CONTROLE DE ENTREGAS E COMPROVANTES</p>
              <h1>Da nota fiscal à entrega <span>comprovada.</span></h1>
              <p className="lp-herotext">Acompanhe documentos, registros de entrega e conferências em um só fluxo. Mais clareza para quem organiza as rotas e para quem está na rua.</p>
              <div className="lp-herobuttons">
                <button className="lp-button lp-primary" type="button" onClick={abrirLogin}>Entrar na plataforma <span aria-hidden="true">→</span></button>
                <a className="lp-button lp-secondary" href="#como-funciona">Conheça o fluxo</a>
              </div>
              <div className="lp-trust"><span aria-hidden="true">✓</span> Um processo simples para cada etapa da entrega.</div>
            </div>

            <div className="lp-herovisual" aria-label="Ilustração demonstrativa de acompanhamento de entrega">
              <div className="lp-herohalo" />
              <article className="lp-dashboard">
                <div className="lp-dashtop"><div className="lp-dashbrand"><img src="/logo-entregaprova.png" alt="" /> Visão da operação</div><span className="lp-dashstatus"><i /> Em andamento</span></div>
                <div className="lp-dashbody">
                  <div className="lp-dashtitle"><div><small>ACOMPANHAMENTO DE ENTREGA</small><h2>Rota do dia</h2></div><span>Exemplo visual</span></div>
                  <div className="lp-routemap" aria-hidden="true">
                    <svg viewBox="0 0 560 190" preserveAspectRatio="none"><path className="lp-street" d="M-20 150 C60 126 70 25 170 57 S294 168 360 108 460 30 580 51" /><path className="lp-street" d="M-5 24 C100 39 100 105 208 117 S337 17 411 60 502 144 575 119" /><path className="lp-route" d="M65 126 C135 126 144 64 247 68 S333 133 422 81 476 48 520 48" /></svg>
                    <span className="lp-pin lp-pin-one">1</span><span className="lp-pin lp-pin-two">2</span><span className="lp-pin lp-pin-three">3</span>
                    <span className="lp-maplabel">Origem · Campinas</span><span className="lp-maplabel lp-maplabel-end">Destino · Ribeirão Preto</span>
                  </div>
                  <div className="lp-dashstats"><div><small>DOCUMENTO</small><b>NF-e vinculada</b></div><div><small>COMPROVANTE</small><b>Registro digital</b></div><div><small>PRÓXIMA ETAPA</small><b>Conferência</b></div></div>
                </div>
                <div className="lp-dashbottom"><span><b>Fluxo</b> Importação → entrega → revisão</span><span className="lp-progress"><i /></span></div>
              </article>
              <div className="lp-floatcard"><span aria-hidden="true">✓</span><div><b>Comprovante registrado</b><small>Pronto para conferência</small></div></div>
            </div>
          </div>
        </section>

        <section className="lp-proofbar" id="beneficios" aria-label="Benefícios">
          <div className="lp-wrap lp-proofinner">
            <div className="lp-proof"><span aria-hidden="true">▤</span><div><b>Documentos organizados</b><small>Dados da NF-e em um só lugar</small></div></div>
            <div className="lp-proof"><span aria-hidden="true">◎</span><div><b>Registro na entrega</b><small>Foto, recebedor e horário</small></div></div>
            <div className="lp-proof"><span aria-hidden="true">✓</span><div><b>Conferência clara</b><small>Documento e comprovante lado a lado</small></div></div>
          </div>
        </section>

        <section className="lp-block" id="recursos">
          <div className="lp-wrap">
            <header className="lp-sectionhead"><p className="lp-eyebrow">UM FLUXO, TRÊS ETAPAS</p><h2>O que acontece entre a nota e a confirmação?</h2><p>As informações acompanham a entrega do início à conferência, com cada etapa visível para a equipe.</p></header>
            <div className="lp-features">{passos.map((passo) => <article className="lp-feature" key={passo.title}><span aria-hidden="true">{passo.icon}</span><h3>{passo.title}</h3><p>{passo.copy}</p></article>)}</div>
          </div>
        </section>

        <section className="lp-block lp-how" id="como-funciona">
          <div className="lp-wrap">
            <header className="lp-sectionhead"><p className="lp-eyebrow">COMO FUNCIONA</p><h2>Uma jornada fácil de acompanhar</h2><p>Do escritório ao destino, cada pessoa encontra a próxima etapa do seu trabalho.</p></header>
            <div className="lp-steps"><article><span>01</span><h3>Prepare a entrega</h3><p>Importe os dados fiscais e organize as entregas para a operação.</p></article><article><span>02</span><h3>Registre no destino</h3><p>O motorista envia a foto e os dados de quem recebeu pelo celular.</p></article><article><span>03</span><h3>Confira e finalize</h3><p>A equipe revisa o documento e o comprovante para concluir o processo.</p></article></div>
          </div>
        </section>

        <section className="lp-cta"><div className="lp-wrap"><div className="lp-ctapanel"><div><h2>Pronto para acompanhar suas entregas?</h2><p>Acesse sua conta para continuar na plataforma EntregaProva.</p></div><button className="lp-button" type="button" onClick={abrirLogin}>Acessar minha conta <span aria-hidden="true">→</span></button></div></div></section>
      </main>

      <footer className="lp-footer"><div className="lp-wrap lp-footerinner"><img src="/logo-entregaprova.png" alt="EntregaProva" /><span>© 2026 EntregaProva · Prévia da plataforma de entregas</span></div></footer>

      <div className={`lp-modalbackdrop${loginAberto ? " is-open" : ""}`} aria-hidden={!loginAberto} onMouseDown={(event) => { if (event.target === event.currentTarget) fecharLogin(); }}>
        <section className="lp-modal" role="dialog" aria-modal="true" aria-labelledby="lp-login-title">
          <button className="lp-close" type="button" aria-label="Fechar janela de login" onClick={fecharLogin}>×</button>
          <img className="lp-modallogo" src="/logo-entregaprova.png" alt="EntregaProva" />
          <h2 id="lp-login-title">{cadastro ? "Criar conta" : "Entrar"}</h2>
          <p className="lp-modalintro">{cadastro ? "Confirme seu e-mail para cadastrar uma pessoa física ou uma empresa." : "Seja bem-vindo ao EntregaProva! Por favor, efetue login para continuar :D"}</p>
          <form className="lp-loginform" onSubmit={handleSubmit}>
            {firebaseConfigError && <div className="alert error" role="alert">{firebaseConfigError}</div>}
            <label htmlFor="lp-email">E-mail</label>
            <div className="lp-field"><input ref={emailRef} id="lp-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <label htmlFor="lp-password">Senha</label>
            <div className="lp-field"><input id="lp-password" type={mostrarSenha ? "text" : "password"} autoComplete={cadastro ? "new-password" : "current-password"} minLength={cadastro ? 6 : undefined} required value={senha} onChange={(event) => setSenha(event.target.value)} /><button type="button" className="lp-toggle" aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"} aria-pressed={mostrarSenha} onClick={() => setMostrarSenha((shown) => !shown)}>{mostrarSenha ? "Ocultar" : "Mostrar"}</button></div>
            {erro && <div className="alert error" role="alert">{erro}</div>}
            <button className="lp-submit" type="submit" disabled={enviando || Boolean(firebaseConfigError)}>{enviando ? "Aguarde..." : cadastro ? "Criar conta" : "Entrar"}</button>
            <button className="lp-signup" type="button" disabled={enviando} onClick={() => { setCadastro((current) => !current); setErro(null); setSenha(""); }}>{cadastro ? "Voltar ao login" : "Criar uma conta"}</button>
            <p className="lp-modalnote">Precisa de acesso? Solicite uma conta ao administrador da sua empresa.</p>
          </form>
        </section>
      </div>

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

