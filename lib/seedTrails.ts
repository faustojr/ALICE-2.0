/**
 * Trilha da Lei 14.133/21 — conteúdo de origem.
 *
 * Este material estava embutido em services/geminiService.ts (LAW_14133_TOPICS
 * e FALLBACK_CONTENT), o que amarrava a plataforma a uma única trilha: vender
 * uma segunda exigia editar o código e publicar de novo.
 *
 * Aqui ele é apenas a semente. A fonte de verdade em produção é a coleção
 * `trails` no Firestore, populada por scripts/seedTrails.mjs. Editar uma
 * trilha passa a ser uma operação de dados, não um deploy.
 */

import type { Trail } from '../types.js';

const now = new Date().toISOString();

export const LEI_14133_TRAIL: Trail = {
  id: 'lei-14133',
  slug: 'lei-14133',
  name: 'Lei 14.133/21 — Nova Lei de Licitações',
  description:
    'Os 16 temas que um servidor de contratações precisa dominar para instruir '
    + 'processos sem expor a si mesmo e ao município a apontamentos do Tribunal de Contas.',
  tenantId: null,
  levels: ['Básico', 'Intermediário', 'Especialista'],
  isPublished: true,
  order: 1,
  createdAt: now,
  updatedAt: now,
  topics: [
  {
    id: 'ambito-de-aplicacao-e-principios',
    title: 'Âmbito de Aplicação e Princípios',
    legalReference: 'Arts. 1º a 7º',
    baseContent: {
      title: 'Âmbito de Aplicação e Princípios',
      slideTexts: [
        'O âmbito de aplicação e os princípios fundamentais da Lei 14.133 estabelecem as regras do jogo, obrigando a aplicação a toda a Administração Pública direta, autárquica e fundacional.',
        'Na Lei 14.133, o tema "Âmbito de Aplicação e Princípios" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'A Nova Lei de Licitações aplica-se obrigatoriamente a qual dessas estruturas municipais?',
      options: [
        { label: 'Administração direta, autárquica e fundacional do Município', value: 'correct' },
        { label: 'Apenas a autarquias, excluindo secretarias municipais', value: 'wrong' },
        { label: 'Empresas públicas e sociedades de economia mista estatais reguladas pela Lei 13.303', value: 'wrong' },
      ],
      feedbackCorrect: 'Excelente! O Art. 1º se aplica à Administração direta, autárquica e fundacional de todos os entes federados.',
      feedbackWrong: 'Incorreto. A Nova Lei aplica-se a toda a administração direta, autárquica e fundacional. Empresas públicas seguem a Lei 13.303.',
    },
  },
  {
    id: 'agentes-publicos-e-definicoes',
    title: 'Agentes Públicos e Definições',
    legalReference: 'Arts. 7º a 10',
    baseContent: {
      title: 'Agentes Públicos e Definições',
      slideTexts: [
        'As regras para agentes públicos proíbem o nepotismo e estabelecem que quem planeja a contratação não deve ser quem a julga, sob o princípio da segregação de funções.',
        'Na Lei 14.133, o tema "Agentes Públicos e Definições" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Qual princípio veda que o mesmo agente elabore o ETP e atue como membro exclusivo da comissão de contratação?',
      options: [
        { label: 'Princípio da Segregação de Funções', value: 'correct' },
        { label: 'Princípio da Economicidade Ativa', value: 'wrong' },
        { label: 'Princípio da Celeridade Processual', value: 'wrong' },
      ],
      feedbackCorrect: 'Correto! A segregação de funções visa reduzir erros e evitar conflitos de interesse dividindo etapas críticas.',
      feedbackWrong: 'Incorreto. É o Princípio da Segregação de Funções (Art. 7º, § 1º) que manda separar o planejamento da decisão.',
    },
  },
  {
    id: 'fase-preparatoria-planejamento-e-etp',
    title: 'Fase Preparatória: Planejamento e ETP',
    legalReference: 'Arts. 18 a 27',
    baseContent: {
      title: 'Fase Preparatória: Planejamento e ETP',
      slideTexts: [
        'Na Fase Preparatória, o Estudo Técnico Preliminar (ETP) é o documento crucial que justifica a necessidade da contratação e avalia a viabilidade técnica.',
        'Na Lei 14.133, o tema "Fase Preparatória: Planejamento e ETP" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Qual é o principal objetivo da elaboração do Estudo Técnico Preliminar (ETP) na fase preparatória?',
      options: [
        { label: 'Evidenciar o problema a ser resolvido e buscar a melhor solução', value: 'correct' },
        { label: 'Apenas registrar as assinaturas e aprovar a dotação orçamentária', value: 'wrong' },
        { label: 'Definir diretamente a marca específica do item a ser comprado', value: 'wrong' },
      ],
      feedbackCorrect: 'Exato! O ETP serve para descrever o problema, avaliar alternativas e escolher a solução ideal para o município.',
      feedbackWrong: 'Incorreto. O ETP (Art. 18, I) foca em apontar e caracterizar o problema e definir a solução mais vantajosa.',
    },
  },
  {
    id: 'modalidades-pregao-e-concorrencia',
    title: 'Modalidades: Pregão e Concorrência',
    legalReference: 'Arts. 28 a 30',
    baseContent: {
      title: 'Modalidades: Pregão e Concorrência',
      slideTexts: [
        'Pregão e Concorrência são as principais modalidades. O pregão é mandatório para bens e serviços comuns, cujo critério de julgamento principal é menor preço ou maior desconto.',
        'Na Lei 14.133, o tema "Modalidades: Pregão e Concorrência" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Em qual cenário a modalidade Pregão é amplamente obrigatória para a prefeitura municipal?',
      options: [
        { label: 'Na aquisição de bens e serviços comuns de qualquer valor', value: 'correct' },
        { label: 'Apenas para obras complexas de grande vulto de engenharia', value: 'wrong' },
        { label: 'Para alienação de bens móveis inservíveis do patrimônio', value: 'wrong' },
      ],
      feedbackCorrect: 'Correto! O Pregão é obrigatório para aquisição de bens e serviços comuns, sob critério de julgamento de menor preço/maior desconto.',
      feedbackWrong: 'Incorreto. O Pregão aplica-se a bens e serviços comuns (Art. 29). Obras de engenharia complexas usam Concorrência ou Diálogo.',
    },
  },
  {
    id: 'modalidades-concurso-leilao-e-dialogo-competitiv',
    title: 'Modalidades: Concurso, Leilão e Diálogo Competitivo',
    legalReference: 'Arts. 31 a 32',
    baseContent: {
      title: 'Modalidades: Concurso, Leilão e Diálogo Competitivo',
      slideTexts: [
        'O Diálogo Competitivo é uma grande novidade para contratações complexas e inovadoras, onde o município dialoga com parceiros antes de definir a licitação.',
        'Na Lei 14.133, o tema "Modalidades: Concurso, Leilão e Diálogo Competitivo" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Para qual finalidade o inovador Diálogo Competitivo foi desenhado na Lei 14.133?',
      options: [
        { label: 'Contratações que envolvem inovação tecnológica ou soluções complexas', value: 'correct' },
        { label: 'Dispensa de licitação para compras simples em datas festivas', value: 'wrong' },
        { label: 'Leiloar veículos antigos e inservíveis da frota da prefeitura', value: 'wrong' },
      ],
      feedbackCorrect: 'Excelente! O Diálogo Competitivo (Art. 32) permite negociar melhores soluções tecnológicas ou de infraestrutura.',
      feedbackWrong: 'Incorreto. O Diálogo Competitivo destina-se a inovações e soluções onde a administração não consegue definir requisitos sozinha.',
    },
  },
  {
    id: 'criterios-de-julgamento',
    title: 'Critérios de Julgamento',
    legalReference: 'Arts. 33 a 39',
    baseContent: {
      title: 'Critérios de Julgamento',
      slideTexts: [
        'Os critérios de julgamento determinam como o vencedor será escolhido: menor preço, maior desconto, melhor técnica ou conteúdo artístico, técnica e preço, ou maior retorno econômico.',
        'Na Lei 14.133, o tema "Critérios de Julgamento" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Qual critério é especificamente associado ao contrato de eficiência, buscando economia para o erário?',
      options: [
        { label: 'Maior retorno econômico', value: 'correct' },
        { label: 'Melhor técnica ou conteúdo artístico', value: 'wrong' },
        { label: 'Menor preço puro sem verificação de desempenho', value: 'wrong' },
      ],
      feedbackCorrect: 'Excelente! O critério de maior retorno econômico é usado em contratos de eficiência, remunerando baseado na economia gerada.',
      feedbackWrong: 'Incorreto. O critério para contratos de eficiência é o maior retorno econômico (Art. 39).',
    },
  },
  {
    id: 'procedimentos-auxiliares-credenciamento-e-pre-qu',
    title: 'Procedimentos Auxiliares: Credenciamento e Pré-qualificação',
    legalReference: 'Arts. 78 a 81',
    baseContent: {
      title: 'Procedimentos Auxiliares: Credenciamento e Pré-qualificação',
      slideTexts: [
        'O credenciamento e a pré-qualificação simplificam o processo. No credenciamento, a prefeitura convoca todos os interessados que preencham requisitos pré-estabelecidos.',
        'Na Lei 14.133, o tema "Procedimentos Auxiliares: Credenciamento e Pré-qualificação" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Quando o credenciamento (procedimento auxiliar) é legalmente viável para prefeituras municipais?',
      options: [
        { label: 'Quando houver inviabilidade de competição pela pluralidade de prestadores e preços fixados', value: 'correct' },
        { label: 'Quando apenas uma única empresa exclusiva puder fornecer o serviço', value: 'wrong' },
        { label: 'Para obras de alta engenharia que exijam concorrência célere', value: 'wrong' },
      ],
      feedbackCorrect: 'Incrível! O Credenciamento serve para quando a administração puder contratar todos os interessados que atendam ao edital.',
      feedbackWrong: 'Incorreto. O Credenciamento (Art. 79) pressupõe pluralidade de interessados simultâneos com preços pré-definidos.',
    },
  },
  {
    id: 'procedimentos-auxiliares-registro-de-precos-e-re',
    title: 'Procedimentos Auxiliares: Registro de Preços e Registro Cadastral',
    legalReference: 'Arts. 82 a 88',
    baseContent: {
      title: 'Procedimentos Auxiliares: Registro de Preços e Registro Cadastral',
      slideTexts: [
        'O Sistema de Registro de Preços (SRP) facilita compras repetitivas por meio de atas de registro de preços, válidas por até 1 ano, prorrogáveis por igual período.',
        'Na Lei 14.133, o tema "Procedimentos Auxiliares: Registro de Preços e Registro Cadastral" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Qual é o prazo máximo inicial de vigência de uma Ata de Registro de Preços sob a Lei 14.133?',
      options: [
        { label: '1 ano, prorrogável por até mais 1 ano se comprovadas condições vantajosas', value: 'correct' },
        { label: 'Até 5 anos improrrogáveis para garantir entrega contínua', value: 'wrong' },
        { label: 'Apenas 6 meses, sem qualquer hipótese de prorrogação ou reajuste', value: 'wrong' },
      ],
      feedbackCorrect: 'Excelente! A ata de registro de preços vigora por 1 ano, podendo ser prorrogada por mais 1 ano (Art. 84).',
      feedbackWrong: 'Incorreto. A vigência inicial máxima é de 1 ano, prorrogável por até mais 1 ano desde que vantajoso.',
    },
  },
  {
    id: 'contratacao-direta-inexigibilidade',
    title: 'Contratação Direta: Inexigibilidade',
    legalReference: 'Art. 74',
    baseContent: {
      title: 'Contratação Direta: Inexigibilidade',
      slideTexts: [
        'A inexigibilidade ocorre pela inviabilidade de competição, como na contratação de artista consagrado ou fornecedor com exclusividade comprovada legalmente.',
        'Na Lei 14.133, o tema "Contratação Direta: Inexigibilidade" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Qual hipótese abaixo caracteriza um caso típico de Inexigibilidade de licitação?',
      options: [
        { label: 'Contratação de profissional de qualquer setor artístico consagrado pela opinião pública', value: 'correct' },
        { label: 'Aquisição de materiais comuns de escritório em situação de pouca urgência', value: 'wrong' },
        { label: 'Contratação de engenharia comum que conte com dezenas de licitantes aptos', value: 'wrong' },
      ],
      feedbackCorrect: 'Exato! Se há inviabilidade de competição, como com artista consagrado, a licitação é inexigível (Art. 74).',
      feedbackWrong: 'Incorreto. Contratação de artista consagrado é caso de Inexigibilidade (Art. 74, II), pois é inviável comparar competidores.',
    },
  },
  {
    id: 'contratacao-direta-dispensa-de-licitacao',
    title: 'Contratação Direta: Dispensa de Licitação',
    legalReference: 'Art. 75',
    baseContent: {
      title: 'Contratação Direta: Dispensa de Licitação',
      slideTexts: [
        'A Dispensa por Valor foi atualizada, permitindo compras diretas em limites maiores, e requer agilidade e controle de fracionamento de despesa.',
        'Na Lei 14.133, o tema "Contratação Direta: Dispensa de Licitação" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'A dispensa de licitação em razão do valor exige qual das seguintes precauções do gestor público municipal?',
      options: [
        { label: 'Evitar o fracionamento ilegal de despesas para um mesmo item ao longo do ano', value: 'correct' },
        { label: 'Garantir que a compra seja feita exclusivamente em dinheiro vivo sem nota fiscal', value: 'wrong' },
        { label: 'Omitir a publicação no Portal Nacional de Contratações Públicas (PNCP)', value: 'wrong' },
      ],
      feedbackCorrect: 'Parabéns! É vedado o fracionamento de despesas para burlar o limite anual de dispensa por valor (Art. 75).',
      feedbackWrong: 'Incorreto. A prefeitura deve controlar o fracionamento de despesas para manter as dispensas dentro dos limites limites legais do Art. 75.',
    },
  },
  {
    id: 'alienacoes-e-formalizacao-dos-contratos',
    title: 'Alienações e Formalização dos Contratos',
    legalReference: 'Arts. 76 a 95',
    baseContent: {
      title: 'Alienações e Formalização dos Contratos',
      slideTexts: [
        'A formalização do contrato é feita por termo escrito ou instrumento substitutivo. Ela exige a verificação prévia de regularidade fiscal e trabalhista.',
        'Na Lei 14.133, o tema "Alienações e Formalização dos Contratos" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Antes de formalizar e assinar um contrato administrativo, o que o setor de contratos da prefeitura deve fazer?',
      options: [
        { label: 'Exigir a comprovação de regularidade fiscal, trabalhista e previdenciária do contratante', value: 'correct' },
        { label: 'Proceder à dispensa verbal e oral de todas as certidões negativas como cortesia', value: 'wrong' },
        { label: 'Redigir o contrato em cartório particular sem nenhuma publicação oficial posterior', value: 'wrong' },
      ],
      feedbackCorrect: 'Perfeito! A certidão de regularidade fiscal e trabalhista é requisito impostergável para assinar o termo de contrato.',
      feedbackWrong: 'Incorreto. A regularidade fiscal e certidões negativas são requisitos obrigatórios de habilitação e contratação.',
    },
  },
  {
    id: 'execucao-e-alteracao-dos-contratos',
    title: 'Execução e Alteração dos Contratos',
    legalReference: 'Arts. 115 a 136',
    baseContent: {
      title: 'Execução e Alteração dos Contratos',
      slideTexts: [
        'As alterações contratuais podem ser unilaterais (feitas pela Administração) ou bilaterais (por acordo). Há limites percentuais rigorosos para acréscimos ou supressões.',
        'Na Lei 14.133, o tema "Execução e Alteração dos Contratos" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Qual o limite percentual clássico de acréscimo unilateral do objeto em contratos de obras e serviços comuns?',
      options: [
        { label: 'Até 25% do valor inicial atualizado do contrato', value: 'correct' },
        { label: 'Até 50% de acréscimo para qualquer modalidade ou fornecimento', value: 'wrong' },
        { label: 'Não há limites percentuais, bastando que as partes concordem livremente', value: 'wrong' },
      ],
      feedbackCorrect: 'Incrível! O limite geral para acréscimo unilateral é de 25% para compras e serviços, e reformas chegam a 50% (Art. 125).',
      feedbackWrong: 'Incorreto. A Lei define limite de até 25% de acréscimo unilateral para fornecimentos, obras e serviços comuns.',
    },
  },
  {
    id: 'extincao-dos-contratos-e-recebimento-do-objeto',
    title: 'Extinção dos Contratos e Recebimento do Objeto',
    legalReference: 'Arts. 137 a 140',
    baseContent: {
      title: 'Extinção dos Contratos e Recebimento do Objeto',
      slideTexts: [
        'A extinção contratual pode se dar judicialmente, amigavelmente ou ato unilateral da prefeitura, por atraso ou inexecuções graves.',
        'Na Lei 14.133, o tema "Extinção dos Contratos e Recebimento do Objeto" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Em qual cenário a prefeitura pode extinguir o contrato unilateralmente sem indenizar a contratada?',
      options: [
        { label: 'Inexecução total ou parcial das cláusulas contratuais por culpa exclusiva da contratada', value: 'correct' },
        { label: 'Por mera vontade política sem justificativa ou dolo da contratada', value: 'wrong' },
        { label: 'Por divergências estéticas do gestor a respeito do logotipo da empresa contratada', value: 'wrong' },
      ],
      feedbackCorrect: 'Muito bem! A inexecução culposa autoriza a rescisão unilateral e aplicação de sanções à empresa transgressora.',
      feedbackWrong: 'Incorreto. A rescisão unilateral sem dever de indenizar se dá por inexecução das obrigações da contratada (Art. 137).',
    },
  },
  {
    id: 'pagamentos-e-nulidades',
    title: 'Pagamentos e Nulidades',
    legalReference: 'Arts. 141 a 154',
    baseContent: {
      title: 'Pagamentos e Nulidades',
      slideTexts: [
        'O pagamento deve respeitar a ordem cronológica de exigibilidade para cada categoria de contrato, impedindo favorecimentos indevidos.',
        'Na Lei 14.133, o tema "Pagamentos e Nulidades" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Como o setor financeiro da prefeitura deve guiar o pagamento de faturas e liquidações de empenho?',
      options: [
        { label: 'Seguindo estritamente a ordem cronológica de suas exigibilidades por fonte de recurso', value: 'correct' },
        { label: 'Priorizando fornecedores de preferência pessoal do prefeito ou secretários', value: 'wrong' },
        { label: 'Pagar sempre o menor valor pendente sem observar qualquer data de vencimento', value: 'wrong' },
      ],
      feedbackCorrect: 'Exato! A ordem cronológica de pagamentos (Art. 141) é um preceito de moralidade e impessoalidade na administração.',
      feedbackWrong: 'Incorreto. A ordem cronológica de exigibilidade para cada fonte deve ser rigidamente respeitada pela tesouraria municipal.',
    },
  },
  {
    id: 'infracoes-e-sancoes-administrativas',
    title: 'Infrações e Sanções Administrativas',
    legalReference: 'Arts. 155 a 163',
    baseContent: {
      title: 'Infrações e Sanções Administrativas',
      slideTexts: [
        'Nas infrações e sanções, a prefeitura deve aplicar advertência, multa, impedimento de licitar ou declaração de inidoneidade, proporcionalmente.',
        'Na Lei 14.133, o tema "Infrações e Sanções Administrativas" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Qual sanção impede uma empresa de licitar com TODA a Administração Pública de todos os entes federativos?',
      options: [
        { label: 'Declaração de inidoneidade para licitar ou contratar', value: 'correct' },
        { label: 'Advertência formal escrita aplicada de maneira interna', value: 'wrong' },
        { label: 'Impedimento de licitar e contratar limitado ao município aplicador', value: 'wrong' },
      ],
      feedbackCorrect: 'Correto! A declaração de inidoneidade impede licitar com federação, estados e municípios por até 6 anos (Art. 156).',
      feedbackWrong: 'Incorreto. A inidoneidade tem efeitos ampliados a todos os entes federativos, enquanto o impedimento limita-se ao próprio ente.',
    },
  },
  {
    id: 'controle-das-contratacoes-e-pncp',
    title: 'Controle das Contratações e PNCP',
    legalReference: 'Arts. 169 a 176',
    baseContent: {
      title: 'Controle das Contratações e PNCP',
      slideTexts: [
        'O controle das contratações estabelece três linhas de defesa do erário, e o PNCP centraliza a transparência nacional das licitações.',
        'Na Lei 14.133, o tema "Controle das Contratações e PNCP" é essencial para evitar riscos e otimizar as compras do município.',
        'Dica ALICE: revise os artigos correspondentes antes de responder ao quiz de fixação.',
      ],
      question: 'Quem compõe a primeira linha de defesa contra irregularidades nas licitações e contratos?',
      options: [
        { label: 'Os agentes públicos que atuam nos processos de contratação e fiscalização', value: 'correct' },
        { label: 'Os auditores do Tribunal de Contas de maneira externa e corretiva', value: 'wrong' },
        { label: 'Os vereadores que compõem a comissão de finanças da câmara municipal', value: 'wrong' },
      ],
      feedbackCorrect: 'Exato! A primeira linha de defesa (Art. 169) é composta pelos próprios agentes que planejam, executam e fiscalizam.',
      feedbackWrong: 'Incorreto. A primeira linha de defesa é dos agentes internos que atuam nas licitações. Tribunais de Contas são a terceira linha.',
    },
  },
  ],
};

export const SEED_TRAILS: Trail[] = [LEI_14133_TRAIL];
