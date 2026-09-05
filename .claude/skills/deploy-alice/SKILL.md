---
name: deploy-alice
description: Publica a ALICE na Vercel e configura os domínios aprendacomalice.com e appalice.cloud. Use quando o usuário pedir "deploy", "publicar", "subir para produção", "configurar domínio", "colocar no ar".
---

# Deploy da ALICE

## Verificação antes de publicar

Nesta ordem, sem pular:

```bash
npm run lint     # tsc --noEmit
npm run build    # build de produção
```

Falhou qualquer um: **não publique**. Corrija primeiro.

Confira também que nada sensível está prestes a ser commitado:

```bash
git status --short
```

Nenhum `.env*`, nenhum JSON de service account, nenhum `firebase-applet-config.json`.

## Variáveis de ambiente na Vercel

Todas em **Settings → Environment Variables**, para Production e Preview.
A lista completa e comentada está em `.env.example`.

As que quebram tudo se faltarem:

| Variável | Consequência se ausente |
|---|---|
| `VITE_FIREBASE_*` | O app não carrega |
| `FIREBASE_SERVICE_ACCOUNT` | Toda rota `/api` falha |
| `GEMINI_API_KEY` | Geração de módulo retorna 503 |
| `SUPER_ADMIN_EMAILS` | Console admin fica inacessível |
| `ALLOWED_ORIGINS` | Chamadas cross-origin são bloqueadas |

`FIREBASE_SERVICE_ACCOUNT` aceita o JSON em uma linha ou o mesmo em base64 —
prefira base64, que evita problema de escape de aspas.

## Domínios

Ambos apontam para o mesmo projeto Vercel; o roteamento por host está em
`App.tsx`.

1. **Settings → Domains** → adicionar `aprendacomalice.com` e `appalice.cloud`
2. Configurar o DNS conforme a Vercel indicar (registro A ou CNAME)
3. Aguardar a emissão do certificado
4. Verificar que `aprendacomalice.com` abre a landing e `appalice.cloud` abre o app

## Regras do Firestore

O deploy da Vercel **não** publica as regras. Elas vão separado:

```bash
npx firebase deploy --only firestore:rules
```

Publicar código novo com regras antigas mantém o banco aberto. Faça as duas coisas.

## Depois de publicar

Teste na ordem, e não pule o terceiro:

1. `aprendacomalice.com` carrega a landing e o formulário envia
2. `appalice.cloud` permite entrar com e-mail e abre um módulo
3. `appalice.cloud/admin` **nega acesso** a uma conta fora da allowlist —
   este teste vale mais que os outros dois

## Se algo quebrar

- Erro 500 em `/api/*` → veja os logs em Vercel → Deployments → Functions.
  Quase sempre é `FIREBASE_SERVICE_ACCOUNT` malformada.
- Tela branca → console do navegador. Quase sempre é `VITE_FIREBASE_*` faltando.
- `permission-denied` no Firestore → esperado no cliente; se aparecer numa rota
  `/api`, a service account está sem permissão no projeto.
