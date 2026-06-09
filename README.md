# Admin Predictable

Application admin simple pour gerer des marches de prediction en juin 2026.

## Stack

- Next.js (App Router) + TypeScript
- TailwindCSS
- API routes Next.js
- Stockage JSON: fichier local en dev (`data/markets.json`), **Vercel Blob** en production

## Installation

```bash
npm install
```

## Lancement

```bash
npm run dev
```

URL locale:

[`http://127.0.0.1:3002`](http://127.0.0.1:3002)

## Variables d'environnement

Copier `.env.example` vers `.env.local` puis renseigner:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o
```

L'analyse utilise OpenAI avec recherche web (Responses API), puis des regles deterministes (confiance, dates juin 2026, marche ouvert jusqu'a l'echeance).

## Deploiement Vercel

1. **Storage → Blob** : creer un store Blob sur le projet (injecte `BLOB_READ_WRITE_TOKEN`).
2. **Environment Variables** : `OPENAI_API_KEY` (+ `OPENAI_MODEL` optionnel).
3. **Redeploy** apres configuration.

Au premier acces, les marches du fichier `data/markets.json` sont copies dans Blob. L'analyse se fait **marche par marche** (compatible serverless).

Verifier `/api/env-status` : `storage: "blob"`, `openai: true`, `blobConfigured: true`.

## CSV supporte

- `titre,categorie`
- `titre,url`

Categories reconnues:

- politique
- monde
- business
- ia
- crypto
- rap
