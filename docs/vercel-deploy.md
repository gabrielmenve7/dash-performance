# Deploy na Vercel com domínio próprio

Checklist alinhado ao projeto **dash-performance** (Next.js + NextAuth + Prisma).

## 1. Importar o repositório e primeiro deploy

1. Acesse [vercel.com](https://vercel.com) e faça login.
2. **Add New Project** → importe o repositório Git (GitHub/GitLab/Bitbucket).
3. Deixe o framework como **Next.js** e clique em **Deploy**.
4. Anote a URL `*.vercel.app` gerada até o domínio próprio estar ativo.

## 2. Variáveis de ambiente (Production)

Em **Project → Settings → Environment Variables**, para o ambiente **Production** (e **Preview**, se quiser previews funcionando):

| Variável | Observação |
|----------|------------|
| `DATABASE_URL` | Connection string Postgres (Neon). Prefira o host **pooler** (`-pooler`). Se o login na Vercel falhar ou demorar, **remova** `channel_binding=require` da URL (Prisma costuma falhar com isso). |
| `NEXTAUTH_SECRET` | Gere um valor novo e forte em produção (`openssl rand -base64 32`). Não reutilize placeholder de desenvolvimento. |
| `NEXTAUTH_URL` | URL **exata** que o usuário usa no navegador, com **https** e **sem** barra final (ex.: `https://seu-projeto.vercel.app`). O código usa `trustHost` para produção na Vercel. |
| `CRON_SECRET` | Obrigatório para o cron da Vercel chamar `/api/sync` com segurança (string aleatória ≥ 16 caracteres). A Vercel envia `Authorization: Bearer <CRON_SECRET>` automaticamente quando esta variável existe. |
| `META_APP_ID`, `META_APP_SECRET`, etc. | Copie de `.env.example` o que for usar. |
| `OPENAI_API_KEY` | Opcional. Habilita o **Assistente** (`/assistant` e `POST /api/assistant/chat`). Uso da API OpenAI é **por conta do operador** do painel; defina limites e monitoramento no dashboard OpenAI. |

Após alterar variáveis, faça **Redeploy** do último deployment.

**Importante:** Se o site for servido com `www` e sem `www`, escolha um canônico em `NEXTAUTH_URL` e configure redirect do outro na Vercel (**Domains**).

## 3. Domínio customizado e DNS

1. **Project → Settings → Domains** → adicione `seudominio.com` e/ou `www.seudominio.com` (ou um subdomínio como `app.seudominio.com`).
2. Siga as instruções da Vercel no painel:
   - **Apex:** registros **A** para os IPs indicados; ou
   - **Subdomínio:** **CNAME** para o host indicado (ex.: `cname.vercel-dns.com`).
3. No registrador (Registro.br, Cloudflare, etc.), crie os registros e aguarde propagação e emissão automática do **HTTPS** (TLS).

## 4. OAuth — URLs para configurar nos consoles

Com `NEXTAUTH_URL=https://SEU_DOMINIO` (sem barra final):

| Integração | Onde configurar | URL típica |
|------------|-----------------|------------|
| Meta (Facebook Login / OAuth da app) | App Dashboard → Facebook Login → Settings → Valid OAuth Redirect URIs | `https://SEU_DOMINIO/api/meta/callback` |

O fluxo usa `redirect_uri = ${NEXTAUTH_URL}/api/meta/callback` (ver `src/app/api/meta/auth/route.ts` e `callback/route.ts`).

Para **Google Ads**, use as URLs exigidas pelo console Google conforme os fluxos que você habilitar.

## 5. Cron `/api/sync`

O [`vercel.json`](../vercel.json) agenda o path `/api/sync`, mas o cron da Vercel invoca **GET** (não POST).

- Foi adicionado **GET** em `src/app/api/sync/route.ts`, protegido por `CRON_SECRET`.
- Defina `CRON_SECRET` no projeto Vercel (mesmo valor não precisa estar no `.env.local` para dev, a menos que teste o GET manualmente).

**Teste local do GET (opcional):**

```bash
curl -s -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/sync
```

**Logs:** Vercel → **Cron Jobs** → **View Logs**, ou **Logs** com filtro no path `/api/sync`.

**Limites:** No plano Hobby o cron só pode rodar **no máximo uma vez por dia**. O `vercel.json` usa `0 8 * * *` (todo dia às **08:00 UTC**). Para mais frequência, use plano pago ou outro agendador.

## 6. Checklist pós-deploy

- [ ] `https://SEU_DOMINIO/login` abre e o login funciona.
- [ ] Rede do navegador: sem 404 em `/_next/static/css/...`.
- [ ] Sessão/cookies estáveis (domínio alinhado com `NEXTAUTH_URL`).
- [ ] Primeira invocação do cron ou logs sem 401 em `/api/sync`.

### Login ok no servidor mas o navegador não entra

1. Rode `npx prisma db push` e `npm run db:seed` com a **mesma** `DATABASE_URL` da Vercel (usuários demo no Neon).
2. Confira `NEXTAUTH_URL` **exatamente** igual à URL do site (sem `/` no final).
3. Atualização forçada: **Ctrl+Shift+R** ou aba **anônima**.
4. No DevTools → **Application** → **Cookies**, apague cookies do domínio e tente de novo.

O backend de auth responde certo se `POST /api/auth/callback/credentials` retornar **200** com cookie de sessão após senha válida.

Em **HTTPS**, o cookie de sessão chama-se `__Secure-authjs.session-token`. O middleware usa `getToken({ secureCookie: true })` nesse caso; sem isso o login parece “não entrar” (volta ao `/login`).
