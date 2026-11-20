import { useState, type FormEvent } from "react";
import { registerUser, type RegistrationResult, type RegistrationRole } from "../api/users.ts";
import { mensagemDoErro } from "../api/client.ts";

export default function RegisterUserPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RegistrationRole>("operator");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<RegistrationResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const address = email.trim();
    setSaving(true);
    setCreated(null);
    setCopied(false);
    setError(null);
    try {
      const result = await registerUser(address, role);
      setCreated(result);
    } catch (err) {
      setError(mensagemDoErro(err));
    } finally {
      setSaving(false);
    }
  }

  async function copyInvitation(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setError("Selecione e copie o código manualmente.");
    }
  }
  return (
    <>
      <section className="welcome">
        <div>
          <h1>Cadastrar usuário</h1>
          <p className="muted">Gere um convite para um operador ou motorista. Compartilhe o código com a pessoa pelo seu canal habitual.</p>
        </div>
      </section>
      <form className="panel form-panel" onSubmit={submit}>
        <label htmlFor="novo-usuario-email">E-mail</label>
        <input id="novo-usuario-email" type="email" required maxLength={254} value={email}
          onChange={event => { setEmail(event.target.value); setCreated(null); }} disabled={saving} />
        <label htmlFor="novo-usuario-papel">Papel</label>
        <select id="novo-usuario-papel" value={role} disabled={saving}
          onChange={event => { setRole(event.target.value === "driver" ? "driver" : "operator"); setCreated(null); }}>
          <option value="operator">Operador</option>
          <option value="driver">Motorista</option>
        </select>
        <div className="form-actions">
          <button className="button primary" type="submit" disabled={saving}>
            {saving ? "Consultando..." : "Gerar convite ou consultar membro"}
          </button>
        </div>
      </form>
      {error && <p className="alert error" role="alert">{error}</p>}
      {created && "codigo" in created && (
        <section className="panel form-panel" aria-label="Convite gerado">
          <p role="status">Convite válido até {new Date(created.expiraEm).toLocaleString("pt-BR")}.</p>
          <p>A pessoa deve criar a conta com este e-mail, confirmá-lo e informar o código na opção <strong>Aceitar convite</strong>.</p>
          <label htmlFor="codigo-gerado">Código do convite</label>
          <input id="codigo-gerado" readOnly value={created.codigo} />
          <button type="button" className="button secondary" onClick={() => void copyInvitation(created.codigo)}>Copiar código</button>
          {copied && <p role="status">Código copiado.</p>}
        </section>
      )}
      {created && "uid" in created && (
        <section className="panel form-panel" aria-label="Membro encontrado">
          <p role="status">Este e-mail já está vinculado à sua empresa.</p>
          {created.role === "driver" && <p>UID para atribuir entregas <code>{created.uid}</code></p>}
        </section>
      )}
    </>
  );
}
