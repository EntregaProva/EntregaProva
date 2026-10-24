import { useEffect, useState } from "react";

type Status = "carregando" | "ok" | "erro";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

const TEXTO: Record<Status, string> = {
  carregando: "Verificando API...",
  ok: "API OK",
  erro: "API indisponível",
};

export default function ApiStatus() {
  const [status, setStatus] = useState<Status>("carregando");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then((res) => setStatus(res.ok ? "ok" : "erro"))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus("erro");
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="api-status" role="status" aria-live="polite" title={`API: ${API_URL}`}>
      <span className={`api-dot ${status === "carregando" ? "" : status}`} />
      <span className="api-status-text">{TEXTO[status]}</span>
    </div>
  );
}
