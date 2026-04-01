# ALICE: Assistente de Microaprendizagem

Uma assistente virtual de microaprendizagem para capacitar servidores públicos municipais com base em leis e soft skills, utilizando uma interface conversacional interativa e gamificada.

## Monitoramento de Custos

Para evitar surpresas com o uso de APIs de IA Generativa (Vertex AI / Gemini), siga estas instruções para configurar alertas de orçamento no Google Cloud Platform.

### 1. Obter o ID da Conta de Faturamento
Execute o comando abaixo para listar suas contas de faturamento e copie o `ACCOUNT_ID`:
```bash
gcloud billing accounts list
```

### 2. Configurar Alerta de Orçamento via CLI
Substitua `BILLING_ACCOUNT_ID` pelo ID obtido no passo anterior e `[PROJECT_ID]` pelo ID do seu projeto:

```bash
# 1. Criar o tópico Pub/Sub para alertas programáticos
gcloud pubsub topics create alice-billing-alerts

# 2. Criar o orçamento com alertas em 50%, 90%, 100% e 120% (previsto)
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="ALICE - Budget Alert" \
  --budget-amount=40USD \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0 \
  --threshold-rule=percent=1.2,basis=forecasted-spend \
  --notifications-rule-pubsub-topic=projects/[PROJECT_ID]/topics/alice-billing-alerts
```

### 3. Ativar Detecção de Anomalias (Console)
Acesse o console do Google Cloud para ativar a detecção inteligente de anomalias:
1. Vá para **Billing** > **Cost anomaly detection**.
2. Clique em **Enable**.

### 4. Notificações por E-mail
Por padrão, os alertas são enviados para os Administradores da Conta de Faturamento. Para garantir que `faustomax@gmail.com` receba os alertas:
1. Vá para **Billing** > **Budgets & alerts**.
2. Edite o orçamento "ALICE - Budget Alert".
3. Em **Manage notifications**, adicione o e-mail desejado ou vincule a um canal de notificação do Cloud Monitoring.
