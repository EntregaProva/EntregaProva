FROM node:20-bookworm-slim

# Emuladores do Firestore e Storage precisam de Java
RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jre-headless curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g firebase-tools@13

WORKDIR /workspace

CMD ["firebase", "emulators:start", "--only", "auth,firestore,storage", "--project", "demo-entregaprova"]