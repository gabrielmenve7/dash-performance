# Dash Performance

Dashboard de performance para campanhas **Meta Ads** e **Google Ads**.

## Desenvolvimento local

1. Copie o ambiente: `cp .env.example .env.local` (Windows: copie manualmente).
2. Preencha **`DATABASE_URL`**, **`NEXTAUTH_SECRET`**, **`NEXTAUTH_URL`**. Use a mesma origem que o navegador (ex.: `http://localhost:3000`; se o Next subir na **3001**, alinhe `NEXTAUTH_URL` a isso).
3. Banco e Prisma:
   ```bash
   npx prisma generate
   npx prisma db push
   npm run db:seed
   ```
4. Suba o app:
   ```bash
   npm install
   npm run dev
   ```
   - No **PowerShell** do Windows, `cd pasta && npm run dev` costuma dar erro; use `cd pasta; npm run dev` ou abra o terminal já na pasta do projeto e rode só `npm run dev`.
   - Enquanto `npm run dev` **não** estiver rodando (terminal fechou ou o comando encerrou com erro), o navegador mostra **ERR_CONNECTION_REFUSED** / **Connection Failed** — isso é esperado; suba o servidor de novo e espere **Ready**.
5. Abra a URL que o terminal mostrar em **Local** (geralmente **`http://localhost:3000`**). Se a porta 3000 estiver ocupada, o Next usa **3001** (ou outra) — usar a porta errada ou um processo antigo na 3000 pode gerar **500** ou página genérica de erro.
6. Não use só `http://localhost` sem porta.

### Página sem estilo (“sem design”, só HTML com fonte padrão)

Isso costuma ser **CSS do Next em 404** ou cache de dev corrompido — o HTML carrega, mas `/_next/static/css/...` não.

1. Pare **todos** os `npm run dev` antigos (e qualquer coisa usando a mesma porta).
2. Apague a pasta **`.next`** na raiz do projeto e suba de novo (`npm run dev`). No Windows (PowerShell): `Remove-Item -Recurse -Force .next` antes do `npm run dev`.
3. Abra a URL em **Local:** do terminal que você acabou de subir; se for **3001**, ajuste **`NEXTAUTH_URL`** na `.env.local` para essa porta.

Atalho: `npm run dev:clean` (remove `.next` e inicia o dev).

### Login de demonstração (após seed)

- Admin: `admin@dash.com` / `admin123`
- Cliente: `cliente@demo.com` / `cliente123`

## “This page isn’t working” / localhost unable to handle this request

Isso costuma ser **HTTP 500** no Next.js.

1. Olhe o **terminal onde roda `npm run dev`** — o stack trace (Prisma, Auth, etc.) indica a causa.
2. No Chrome, **Show details** mostra o código HTTP.
3. Confirme a URL e a **porta** iguais ao **Local:** no terminal (ex.: `3000` ou `3001` se a 3000 estiver em uso). Teste **`/login`** primeiro; depois `/`.
4. Causas frequentes:
   - **Porta errada**: outro app em `3000` respondendo com erro enquanto o Next está em `3001`.
   - **Postgres**: `DATABASE_URL` errada ou banco offline → rode `npx prisma db push`.
   - **NextAuth**: `NEXTAUTH_SECRET` ou `NEXTAUTH_URL` vazios → veja `.env.example`.

Ao iniciar o servidor, avisos `[dash-performance] Variáveis de ambiente ausentes` vêm de `src/instrumentation.ts`.

## Deploy na Vercel (domínio próprio)

Passo a passo, variáveis, DNS, OAuth e cron: [docs/vercel-deploy.md](docs/vercel-deploy.md).
