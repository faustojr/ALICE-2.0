import React, { useState } from 'react';
import { Star, CheckCircle2, Loader2, ChevronRight, ChevronLeft, ArrowLeft } from 'lucide-react';
import { useAccessibility } from '../App';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

interface PrePilotSurveyProps {
  onComplete: () => void;
  onBack: () => void;
}

interface Question {
  key: string;
  label: string;
  description: string;
  type: 'select' | 'boolean' | 'rating';
  options?: { label: string; value: any }[];
  minLabel?: string;
  maxLabel?: string;
}

const PrePilotSurvey: React.FC<PrePilotSurveyProps> = ({ onComplete, onBack }) => {
  const { highContrast } = useAccessibility();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [answers, setAnswers] = useState({
    pre_experienceTime: '',
    pre_formalCapacitation: null as boolean | null,
    pre_generalKnowledge: 0,
    pre_prepKnowledge: 0,
    pre_confidenceBasic: 0,
    pre_interestCustomTool: 0,
  });

  const questions: Question[] = [
    {
      key: 'pre_experienceTime',
      label: 'Tempo de Atuação',
      description: 'Qual o seu tempo de atuação na administração pública ou com contratações públicas?',
      type: 'select',
      options: [
        { label: 'Menos de 1 ano', value: 'Menos de 1 ano' },
        { label: '1 a 3 anos', value: '1 a 3 anos' },
        { label: '3 a 5 anos', value: '3 a 5 anos' },
        { label: 'Mais de 5 anos', value: 'Mais de 5 anos' },
      ],
    },
    {
      key: 'pre_formalCapacitation',
      label: 'Capacitação Prévia',
      description: 'Você já realizou alguma capacitação formal sobre a Nova Lei de Licitações (Lei 14.133)?',
      type: 'boolean',
      options: [
        { label: 'Sim, já realizei', value: true },
        { label: 'Não, ainda não', value: false },
      ],
    },
    {
      key: 'pre_generalKnowledge',
      label: 'Conhecimento Geral',
      description: 'Como você avalia seu conhecimento geral sobre a Nova Lei de Licitações (Lei 14.133)?',
      type: 'rating',
      minLabel: 'Iniciante / Muito Baixo',
      maxLabel: 'Especialista / Excelente',
    },
    {
      key: 'pre_prepKnowledge',
      label: 'Fase Preparatória',
      description: 'Qual o seu nível de compreensão sobre a Fase Preparatória das contratações na Nova Lei?',
      type: 'rating',
      minLabel: 'Nenhum / Muito Baixo',
      maxLabel: 'Completo / Avançado',
    },
    {
      key: 'pre_confidenceBasic',
      label: 'Segurança no Dia a Dia',
      description: 'Como você se sente para responder ou encaminhar dúvidas básicas de licitações no dia a dia institucional?',
      type: 'rating',
      minLabel: 'Totalmente Inseguro(a)',
      maxLabel: 'Totalmente Seguro(a)',
    },
    {
      key: 'pre_interestCustomTool',
      label: 'Interesse na Solução',
      description: 'Qual o seu nível de interesse em contar com uma ferramenta inteligente customizada de microaprendizagem como a ALICE?',
      type: 'rating',
      minLabel: 'Sem Interesse',
      maxLabel: 'Total Interesse / Expectativa Alta',
    },
  ];

  const currentQ = questions[currentStep - 1];

  const isCurrentStepValid = () => {
    const val = answers[currentQ.key as keyof typeof answers];
    if (currentQ.type === 'select') {
      return val !== '';
    }
    if (currentQ.type === 'boolean') {
      return val !== null;
    }
    if (currentQ.type === 'rating') {
      return Number(val) > 0;
    }
    return false;
  };

  const handleNext = () => {
    if (!isCurrentStepValid()) {
      setErrorMsg('Por favor, selecione uma resposta para continuar.');
      return;
    }
    setErrorMsg('');
    if (currentStep < questions.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    setErrorMsg('');
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      onBack();
    }
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      setErrorMsg('Usuário não autenticado. Por favor, faça login novamente.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const emailLower = user.email.toLowerCase();

      // 1. Salva na coleção pilotSurveys com dados prévios
      await setDoc(doc(db, 'pilotSurveys', emailLower), {
        email: emailLower,
        pre_experienceTime: answers.pre_experienceTime,
        pre_formalCapacitation: answers.pre_formalCapacitation,
        pre_generalKnowledge: Number(answers.pre_generalKnowledge),
        pre_prepKnowledge: Number(answers.pre_prepKnowledge),
        pre_confidenceBasic: Number(answers.pre_confidenceBasic),
        pre_interestCustomTool: Number(answers.pre_interestCustomTool),
        timestampPre: new Date().toISOString(),
      }, { merge: true });

      // 2. Atualiza dados do usuário para status correspondente 'ativo'
      await setDoc(doc(db, 'users', emailLower), {
        pilotStatus: 'ativo',
        status: 'ativo',
        email: emailLower,
        name: user.displayName || emailLower.split('@')[0],
      }, { merge: true });

      // 3. Atualiza também localmente o progresso se houver
      const localProgress = localStorage.getItem('alice_progress_v3') || '{}';
      try {
        const parsed = JSON.parse(localProgress);
        parsed.pilotStatus = 'ativo';
        parsed.status = 'ativo';
        localStorage.setItem('alice_progress_v3', JSON.stringify(parsed));
      } catch (err) {
        console.error("Erro ao salvar progresso local:", err);
      }

      onComplete();
    } catch (err: any) {
      console.error("Erro ao salvar questionário de pré-piloto:", err);
      setErrorMsg('Ocorreu um erro ao salvar suas respostas. Por favor, tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectAnswer = (value: any) => {
    setErrorMsg('');
    setAnswers(prev => ({
      ...prev,
      [currentQ.key]: value,
    }));
  };

  const renderOptionControls = () => {
    const currentVal = answers[currentQ.key as keyof typeof answers];

    if (currentQ.type === 'select' || currentQ.type === 'boolean') {
      return (
        <div className="flex flex-col gap-3.5 w-full max-w-md mx-auto">
          {currentQ.options?.map((opt, idx) => {
            const isSelected = currentVal === opt.value;
            return (
              <button
                key={idx}
                onClick={() => selectAnswer(opt.value)}
                id={`survey-opt-${idx}`}
                className={`w-full py-4 px-5 rounded-2xl font-bold text-left transition-all active:scale-[0.98] border-2 flex items-center justify-between text-base md:text-lg ${
                  isSelected
                    ? highContrast
                      ? 'bg-yellow-400 border-white text-black'
                      : 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                    : highContrast
                    ? 'bg-black border-yellow-400/50 text-yellow-300 hover:border-yellow-400'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/30 hover:bg-white/10'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <CheckCircle2 className={`w-5 h-5 ${highContrast ? 'text-black' : 'text-blue-400'}`} />
                )}
              </button>
            );
          })}
        </div>
      );
    }

    if (currentQ.type === 'rating') {
      return (
        <div className="w-full max-w-sm mx-auto">
          <div className="flex justify-between gap-1.5 mb-6">
            {[1, 2, 3, 4, 5].map((val) => {
              const ratingVal = Number(currentVal);
              const isSelected = ratingVal === val;
              const isGold = ratingVal >= val;
              return (
                <button
                  key={val}
                  onClick={() => selectAnswer(val)}
                  id={`survey-star-${val}`}
                  className="p-1 focus:outline-none flex-1 group transition-transform hover:scale-110 active:scale-95"
                >
                  <div
                    className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${
                      isSelected
                        ? highContrast
                          ? 'bg-yellow-400 border-white text-black'
                          : 'bg-yellow-500/30 border-yellow-400 text-yellow-300 scale-105 shadow-md shadow-yellow-500/10'
                        : isGold
                        ? 'bg-yellow-500/15 border-yellow-500/50 text-yellow-300'
                        : highContrast
                        ? 'bg-black border-yellow-400/50 text-yellow-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    <Star
                      className={`w-6 h-6 ${
                        isGold ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500'
                      }`}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-500 mt-2 block">{val}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between items-start text-xs font-semibold text-slate-400 px-1 gap-4">
            <span className="text-left w-1/2">{currentQ.minLabel}</span>
            <span className="text-right w-1/2">{currentQ.maxLabel}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="h-full w-full max-w-md mx-auto flex flex-col justify-center py-6 px-4 animate-in fade-in duration-500">
      
      {/* Botão de Cancelar/Voltar */}
      <div className="mb-4 text-left">
        <button
          onClick={handlePrev}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
      </div>

      <div className={`border rounded-3xl p-6 sm:p-8 flex flex-col justify-between min-h-[480px] max-h-[85vh] md:max-h-[540px] shadow-2xl relative overflow-y-auto ${
        highContrast ? 'bg-black border-yellow-400' : 'bg-slate-900 border-slate-800'
      }`}>
        <div>
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <span className={`text-xs font-black uppercase tracking-widest ${highContrast ? 'text-yellow-300' : 'text-blue-400'}`}>
              Questionário Pré-Piloto
            </span>
            <span className="text-slate-400 text-xs font-bold font-mono">
              {currentStep} / {questions.length}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full mb-6 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                highContrast ? 'bg-yellow-400' : 'bg-blue-500'
              }`}
              style={{ width: `${(currentStep / questions.length) * 100}%` }}
            />
          </div>

          {/* Alert Callout for mandatory nature */}
          {currentStep === 1 && (
            <div className={`p-3 rounded-2xl mb-5 text-[11px] leading-relaxed border-l-4 ${
              highContrast ? 'bg-yellow-400/15 border-yellow-400 text-white' : 'bg-blue-900/10 border-blue-500 text-blue-200'
            }`}>
              Este questionário rápido é de autopreenchimento <strong>obrigatório</strong> pelo termo de adesão ao piloto da Nova Lei de Licitações. Leva apenas 45 segundos.
            </div>
          )}

          {/* Question Text */}
          <div className="space-y-1.5 mb-2">
            <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
              {currentQ.label}
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              {currentQ.description}
            </p>
          </div>
        </div>

        {/* Answer Controls */}
        <div className="my-auto py-1">
          {renderOptionControls()}
        </div>

        {/* Footer controls */}
        <div className="space-y-3 pt-4 border-t border-slate-800/60">
          {errorMsg && (
            <p className={`text-xs font-bold text-center ${highContrast ? 'text-yellow-400' : 'text-red-400'}`}>
              {errorMsg}
            </p>
          )}

          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                onClick={handlePrev}
                className={`px-5 py-3.5 font-bold rounded-2xl transition-all active:scale-95 ${
                  highContrast
                    ? 'border border-yellow-400 bg-black text-yellow-300 hover:bg-yellow-400/10'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                Anterior
              </button>
            )}

            <button
              onClick={handleNext}
              disabled={submitting}
              className={`flex-1 py-3.5 font-extrabold text-base rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 ${
                highContrast
                  ? 'bg-yellow-400 text-black border border-white hover:bg-yellow-300'
                  : currentStep === questions.length
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Salvando cadastro...</span>
                </>
              ) : currentStep === questions.length ? (
                <>
                  <span>Finalizar Pesquisa</span>
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </>
              ) : (
                <>
                  <span>Continuar</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrePilotSurvey;
