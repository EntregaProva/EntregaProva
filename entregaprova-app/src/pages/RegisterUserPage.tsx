import { useState, type FormEvent } from "react";
import { registerUser, sendFirstAccessEmail, type RegistrationRole } from "../api/users.ts";
import { mensagemDoErro } from "../api/client.ts";

export default function RegisterUserPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RegistrationRole>("operator");
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; uid: string; role: RegistrationRole } | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function sendEmail(address: string) {
    setSendingEmail(true);
    setEmailSent(false);
    setError(null);
    try {
      await sendFirstAccessEmail(address);
      setEmailSent(true);
    } catch {
      setError("A conta foi criada, mas o Firebase não confirmou o envio do e-mail. Tente enviar novamente.");
    } finally {
      setSendingEmail(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || sendingEmail) return;
    const address = email.trim();
    setSaving(true);
    setCreated(null);
    setEmailSent(false);
    setError(null);
    try {
      const result = await registerUser(address, role);
      setCreated({ email: address, ...result });
      setEmail("");
      await sendEmail(address);
    } catch (err) {
      setError(mensagemDoErro(err));
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || sendingEmail;
  return (
    <>
      <section className="welcome">
        <div>
          <h1>Cadastrar usuário</h1>
          <p className="muted">Adicione um operador ou motorista à sua empresa. A pessoa recebe um e-mail para definir a senha.</p>
        </div>
      </section>
      <form className="panel form-panel" onSubmit={submit}>
        <label htmlFor="novo-usuario-email">E-mail</label>
        <input id="novo-usuario-email" type="email" required maxLength={254} value={email}
          onChange={event => setEmail(event.target.value)} disabled={busy} />
        <label htmlFor="novo-usuario-papel">Papel</label>
        <select id="novo-usuario-papel" value={role} disabled={busy}
          onChange={event => setRole(event.target.value === "driver" ? "driver" : "operator")}>
          <option value="operator">Operador</option>
          <option value="driver">Motorista</option>
        </select>
        <div className="form-actions">
          <button className="button primary" type="submit" disabled={busy}>
            {saving ? "Cadastrando..." : "Cadastrar usuário"}
          </button>
        </div>
      </form>
      {error && <p className="alert error" role="alert">{error}</p>}
      {created && (
        <section className="panel form-panel" aria-label="Usuário cadastrado">
          <p role="status">Conta criada para {created.email}. {emailSent && "E-mail de primeiro acesso solicitado."}</p>
          {created.role === "driver" && <p>UID para atribuir entregas <code>{created.uid}</code></p>}
          <button type="button" className="button secondary" disabled={busy} onClick={() => void sendEmail(created.email)}>
            {sendingEmail ? "Enviando..." : "Reenviar e-mail"}
          </button>
        </section>
      )}
    </>
  );
}
