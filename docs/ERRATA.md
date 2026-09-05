# ERRATA

**LIMA JÚNIOR, Fausto Alcântara de.** *ALICE: Inteligência Artificial
Generativa e Microlearning para Capacitação Personalizada de Servidores
Públicos Municipais — Desenvolvimento, Validação e Impactos na Modernização
da Gestão Pública.* Dissertação (Mestrado em Ciência, Tecnologia e Inovação) —
Programa de Pós-Graduação em Ciência, Tecnologia e Inovação, Universidade
Federal do Rio Grande do Norte, Natal, 2026.

---

As correções a seguir decorrem da evolução do artefato após a redação do
texto. Referem-se aos parâmetros de progressão do usuário e ao mecanismo de
ponderação da pontuação, descritos na Seção 4.2 (Arquitetura Pedagógica da
Plataforma).

---

## Item 1 — Patamares de experiência (XP)

**Onde se lê** (Seção 4.2):

> pontos de experiência (XP) acumulados ao longo de toda a trajetória do
> usuário sinalizam metas de carreira exibidas no painel do servidor,
> classificadas em Iniciante (500 pontos), Intermediário (1.500 pontos) e
> Especialista (3.000 pontos)

**Leia-se:**

> pontos de experiência (XP) acumulados ao longo de toda a trajetória do
> usuário sinalizam metas de carreira exibidas no painel do servidor,
> classificadas em Iniciante (5.000 pontos), Intermediário (15.000 pontos) e
> Especialista (30.000 pontos)

**Justificativa.** Os valores publicados foram definidos antes da observação
do ritmo real de uso. Com pontuação-base de 100 pontos por acerto, o patamar
de Especialista seria alcançado com 30 acertos — aproximadamente duas semanas
de uso no ritmo de três minutos diários previsto pelo desenho da solução. Um
indicador de carreira que se esgota nesse prazo deixa de cumprir a função
motivacional que o framework Octalysis (CHOU, 2015) lhe atribui: o progresso
tangível perde o horizonte que sustenta o engajamento de longo prazo. A
revisão por uma ordem de grandeza reposiciona o topo da escala em cerca de um
ano de uso continuado, compatível com a natureza da capacitação continuada
que a plataforma se propõe a oferecer.

---

## Item 2 — Limiar de desbloqueio entre camadas de conteúdo

**Onde se lê** (Seção 4.2):

> o avanço real do servidor entre camadas de conteúdo dentro de cada trilha
> temática é controlado por um número de acertos consecutivos exigidos, 15
> quizzes corretos para desbloquear o nível Intermediário e 30 para o nível
> Especialista

**Leia-se:**

> o avanço real do servidor entre camadas de conteúdo dentro de cada trilha
> temática é controlado pelo número de acertos acumulados, 150 quizzes
> corretos para desbloquear o nível Intermediário e 300 para o nível
> Especialista

**Justificativa.** Duas correções se somam neste item.

A primeira é de ordem de grandeza. A trilha de referência da Lei nº
14.133/2021 compreende dezesseis tópicos. Com o limiar publicado, o servidor
alcançaria o nível Especialista antes de completar duas passagens pela
trilha — desbloqueando conteúdo de julgamento sob pressão sem ter percorrido
o repertório básico. Os limiares revisados situam o desbloqueio de
Intermediário após aproximadamente nove ciclos completos e o de Especialista
após dezoito, o que preserva a progressão gradual pressuposta pelo desenho
adaptativo.

A segunda é de precisão conceitual. O texto original registra "acertos
consecutivos", mas o mecanismo implementado contabiliza acertos **acumulados**.
A distinção não é acessória: exigir consecutividade significaria zerar o
progresso do servidor a cada erro, o que contraria diretamente o fundamento
adotado na dissertação. Sob a Teoria da Autoeficácia (BANDURA, 1997), o erro
é tratado como oportunidade de remediação e não como retrocesso; penalizar a
sequência a cada engano produziria justamente o efeito que a plataforma
busca evitar — a percepção de incapacidade diante da dificuldade.

---

## Item 3 — Ponderação da pontuação por nível cognitivo

**Onde se lê** (Seção 4.2):

> A ponderação da pontuação por acerto, adicionalmente, considera o nível
> cognitivo exigido pela pílula pedagógica, com base na Taxonomia de Bloom
> Revisada (ANDERSON; KRATHWOHL, 2001): questões de reconhecimento e
> compreensão recebem pontuação-base, enquanto questões de aplicação,
> análise, avaliação e criação que exigem raciocínio jurídico sobre casos
> concretos de licitação recebem pontuação ponderada superior

**Leia-se** (acrescente-se ao final do parágrafo):

> Os fatores de ponderação aplicados são: 1,0 para os processos cognitivos
> *lembrar* e *entender*; 1,5 para *aplicar* e *analisar*; e 2,0 para
> *avaliar* e *criar*. A classificação de cada questão é declarada pelo
> próprio modelo de linguagem no momento da geração e validada pelo servidor
> de aplicação, que atribui o fator neutro (1,0) sempre que a classificação
> recebida não corresponder a um dos seis processos previstos na taxonomia.

**Justificativa.** O texto original descreve corretamente o princípio da
ponderação, sem especificar os fatores empregados nem o mecanismo de
classificação. O acréscimo torna o parâmetro reproduzível, requisito para a
avaliação do artefato sob a Design Science Research. A regra de validação
merece registro por sua consequência metodológica: sendo a classificação
produzida pelo próprio modelo generativo, admitir rótulos não previstos
permitiria inflar a pontuação sem correspondência com a demanda cognitiva
efetiva, comprometendo o indicador que o gestor municipal utiliza para
avaliar a preparação da equipe.

---

## Nota sobre o alcance destas correções

As correções não alteram os resultados da avaliação apresentada no Capítulo 5.
O estudo piloto conduzido em Fraiburgo e Florianópolis avaliou a percepção de
utilidade, a usabilidade e a variação de autoeficácia declarada, dimensões
que independem dos limiares de progressão. Nenhum participante do piloto
atingiu os patamares de desbloqueio em qualquer das duas configurações, de
modo que os dados coletados permanecem íntegros.

O mecanismo central descrito na Seção 4.2 — a invocação do modelo de
linguagem exclusivamente por gatilho de erro do usuário, com a primeira
passagem ocorrendo sobre trilha base curada — permanece integralmente válido
e é o que se encontra implementado no artefato.

---

*Natal, 2026.*
