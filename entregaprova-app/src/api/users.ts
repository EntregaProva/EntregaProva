import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase.ts";
import { apiFetch } from "./client.ts";

export type RegistrationRole = "operator" | "driver";

export function registerUser(email: string, role: RegistrationRole) {
  return apiFetch<{ uid: string; role: RegistrationRole }>("/usuarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
}

export function sendFirstAccessEmail(email: string) {
  return sendPasswordResetEmail(auth, email);
}
