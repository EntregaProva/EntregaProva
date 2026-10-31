// Seed reproduzivel dos emuladores. Local: backend/src/seed.ts
// Uso (com `docker compose up` rodando): docker compose exec backend npm run seed
//
// Cria SEMPRE os mesmos usuarios no emulador de Auth. Pode rodar varias vezes:
// apaga e recria cada usuario, entao o resultado e identico.

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Trava de seguranca: nunca roda contra um projeto real.
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error(
    "[seed] FIREBASE_AUTH_EMULATOR_HOST nao definido. Recusando rodar fora dos emuladores."
  );
  process.exit(1);
}

const projectId = process.env.GCP_PROJECT_ID || "demo-entregaprova";
initializeApp({ projectId });
const auth = getAuth();

type SeedUser = {
  uid: string;
  email: string;
  password: string;
  displayName: string;
  role: string;
};

const users: SeedUser[] = [
  {
    uid: "seed-admin-001",
    email: "admin@teste.com",
    password: "Teste@123",
    displayName: "Admin Teste",
    role: "admin",
  },
  {
    uid: "seed-motorista-001",
    email: "motorista@teste.com",
    password: "Teste@123",
    displayName: "Motorista Teste",
    role: "motorista",
  },
];

async function main(): Promise<void> {
  for (const u of users) {
    try {
      await auth.deleteUser(u.uid);
    } catch {
      // usuario ainda nao existia: tudo bem
    }
    await auth.createUser({
      uid: u.uid,
      email: u.email,
      password: u.password,
      displayName: u.displayName,
      emailVerified: true,
    });
    await auth.setCustomUserClaims(u.uid, { role: u.role });
    console.log(`[seed] ${u.role}: ${u.email}`);
  }
  console.log("[seed] Concluido.");
}

main().catch((err) => {
  console.error("[seed] Falhou:", err);
  process.exit(1);
});