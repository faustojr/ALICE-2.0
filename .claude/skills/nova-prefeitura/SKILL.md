---
name: nova-prefeitura
description: Conduz o cadastro e a ativação de uma nova prefeitura na ALICE, do lead até os primeiros servidores estudando. Use quando o usuário disser "nova prefeitura", "cadastrar município", "onboarding", "fechei com", "ativar cliente", "novo piloto".
---

# Onboarding de uma prefeitura

Ativação é onde piloto morre. O padrão de falha é sempre o mesmo: o município
é cadastrado, ninguém avisa os servidores, e noventa dias depois o relatório
mostra três acessos. Esta skill existe para impedir isso.

## Passo 1 — Reunir os dados

Pergunte de uma vez só o que falta (não uma pergunta por vez):

- Nome oficial do município e UF
- População aproximada — define o plano adequado
- Nome, e-mail e cargo do responsável pela capacitação
- Domínio de e-mail institucional (ex: `blumenau.sc.gov.br`)
- Quantos servidores lidam com contratações hoje
- Como chegou até a ALICE

Se o usuário já deu parte disso, não repita a pergunta.

## Passo 2 — Recomendar o plano

Consulte `PLANS` em `types.ts`. Regra prática:

| Situação | Plano |
|---|---|
| Primeiro contato, sem contrato | `PILOTO` (90 dias, 30 servidores) |
| Até ~100 servidores em contratações | `ESSENCIAL` |
| Município médio, várias secretarias | `GESTAO` |
| Consórcio ou rede de municípios | `ENTERPRISE` |

Comece sempre pelo piloto quando não houver contrato assinado. Piloto que
converte vale mais que contrato que não é usado.

## Passo 3 — Cadastrar

Pelo console em `appalice.cloud/admin` → "Nova prefeitura". Ou, se o usuário
preferir, monte o `curl` para `POST /api/admin/tenants` com o corpo pronto.

Confira depois do cadastro:
- O domínio de e-mail ficou correto (é o que vincula servidor ao tenant).
- O status é `TRIAL` e a data de fim do piloto está certa.

## Passo 4 — Plano de ativação

Esta é a parte que decide o resultado. Produza para o gestor da prefeitura:

**Mensagem de convite** — curta, para o gestor encaminhar aos servidores. Deve
dizer o que é, quanto tempo toma por dia, e o link. Sem linguagem de marketing:
o servidor recebe muitos e-mails e ignora quase todos.

**Combinado de acompanhamento** — proponha ao gestor uma data para revisar os
primeiros números, entre 10 e 15 dias após o convite. Marque na conversa. Um
piloto sem data de revisão vira um piloto esquecido.

**Meta declarada** — combine com o gestor quantos servidores devem ter feito ao
menos um módulo na primeira semana. Meta explícita muda o comportamento de quem
encaminha o convite.

## Passo 5 — Registrar

Anote no fim da conversa: município, plano, data do cadastro, data combinada de
revisão e a meta da primeira semana. Sugira ao usuário criar um lembrete para a
data de revisão.

## O que não fazer

- Não cadastre sem ter o responsável nomeado. Piloto sem dono não é usado.
- Não prometa funcionalidade que não existe hoje. Consulte `CLAUDE.md` para o
  que está pronto de fato.
