import { apiFetch } from "./client.ts";

export type RegistrationRole = "operator" | "driver";

export type RegistrationResult = { codigo: string; expiraEm: string } | { uid: string; role: RegistrationRole };

export function registerUser(email: string, role: RegistrationRole) {
  return apiFetch<RegistrationResult>("/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
}

export function acceptInvitation(codigo: string) {
  return apiFetch<void>("/convites/aceitar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo }),
  });
}
