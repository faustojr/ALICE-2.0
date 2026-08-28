---
name: proposta-comercial
description: Gera uma proposta comercial para uma prefeitura, com enquadramento jurídico da contratação e valores. Use quando o usuário pedir "proposta", "orçamento para", "cotação", "documento para a prefeitura", "como cobrar de".
---

# Proposta comercial para prefeitura

## Antes de escrever

Levante, perguntando de uma vez o que faltar:

- Município, UF e população
- A quem a proposta é endereçada (nome e cargo)
- Quantos servidores serão atendidos
- Se já houve piloto e qual foi o resultado
- Se o interlocutor sinalizou preferência de enquadramento

Se houve piloto, **os números dele são o corpo da proposta**. Servidores que
participaram, módulos concluídos, evolução entre pesquisa pré e pós-uso. Uma
proposta ancorada no resultado do próprio município converte muito acima de
uma proposta genérica.

## Enquadramento da contratação

Apresente o caminho mais provável e diga por quê:

- **Dispensa por valor** (Art. 75, II) — caminho usual para valor anual baixo.
  **Verifique o limite vigente com WebSearch antes de escrever o número**: ele é
  atualizado por decreto, e um valor desatualizado numa proposta a um controlador
  interno encerra a negociação.
- **Adesão a ata de registro de preços** — se houver ata vigente de outro órgão.
- **Pregão eletrônico** — para contratos maiores.

Ofereça o dado, não o parecer: quem decide o enquadramento é a procuradoria do
município. A frase certa é "entendemos que se enquadra em X; a decisão cabe à
assessoria jurídica dessa prefeitura".

## Estrutura da proposta

Uma página. Nesta ordem:

1. **Situação** — a dor daquele município, com o que você sabe dele. Não é um
   parágrafo genérico sobre a Lei 14.133.
2. **O que a ALICE entrega** — em termos do resultado, não da tecnologia.
   "Sua equipe estuda 3 minutos por dia e você acompanha quem está preparado",
   não "plataforma de microlearning com IA generativa".
3. **Resultado do piloto**, quando houver — números reais.
4. **Investimento** — plano, valor mensal e anual. Valores de `PLANS` em
   `types.ts`, nunca inventados.
5. **Como contratar** — o enquadramento e os documentos que a ALICE fornece.
6. **Próximo passo** — uma ação concreta com data.

## Tom

O leitor é um gestor público que responde por essa contratação no Tribunal de
Contas. Ele precisa de clareza e de segurança jurídica, não de entusiasmo.

- Sem superlativo, sem "revolucionário", sem "inovador".
- Sem jargão de startup: "engajamento", "jornada", "onboarding", "solução
  disruptiva" soam mal nesse contexto.
- Números redondos e verificáveis. Se não tem o dado, não use o dado.

## Formato de saída

Markdown por padrão. Se o usuário pedir documento formal para anexar a processo
administrativo, gere `.docx` com a skill `docx`.
