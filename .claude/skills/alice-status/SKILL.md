---
name: alice-status
description: Levanta o estado atual da operação ALICE — prefeituras, engajamento, custo de IA, fila comercial e saúde do código — e devolve um relatório com o que exige decisão. Use quando o usuário pedir "status", "como está a ALICE", "relatório da semana", "panorama", "o que preciso decidir".
---

# Status da operação ALICE

Produz um panorama honesto do negócio e do produto. O objetivo não é enumerar
tudo, é isolar o que exige decisão do fundador nesta semana.

## Passo 1 — Estado do código

```bash
git log --oneline -10
git status --short
npm run lint
```

Se `lint` falhar, isso encabeça o relatório: nada mais importa se a base não
compila.

## Passo 2 — Estado do produto

Leia a seção "Estado atual e próximos passos" do `CLAUDE.md`. Compare com os
commits recentes: o que a fila diz que era prioridade foi de fato o que andou?
Divergência entre os dois é o sinal mais útil deste relatório.

## Passo 3 — Estado da operação

Se houver credenciais configuradas e o console respondendo, colete de
`/api/admin/overview`: receita recorrente, prefeituras por status, servidores
ativos, gerações de IA no mês, pilotos vencendo e tenants sem atividade.

Sem acesso aos dados, diga isso claramente em vez de estimar. Um número
inventado num relatório de gestão é pior que uma lacuna assumida.

## Passo 4 — Relatório

Estruture assim, nesta ordem:

**1. Precisa de decisão sua**
No máximo três itens. Cada um com: a situação, as opções, e sua recomendação.
Se não há nada que exija decisão, diga "nada exige decisão esta semana" — não
invente item para preencher.

**2. Números**
Receita, prefeituras ativas, servidores ativos, custo de IA. Cada um com a
variação desde a última medição, quando houver base de comparação.

**3. Riscos**
Pilotos vencendo sem conversão encaminhada. Prefeituras sem atividade há mais
de duas semanas. Cota de IA perto do limite. Dívida técnica que já está
cobrando juros.

**4. Fila sugerida**
As três próximas coisas, em ordem, com a justificativa de por que nesta ordem.

Seja direto. Este relatório é para uma pessoa que tem quinze minutos e precisa
saber onde colocar a atenção.
