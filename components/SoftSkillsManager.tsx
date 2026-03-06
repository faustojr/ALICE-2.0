
import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, BrainIcon, CheckCircleIcon } from './Icons';

interface SoftSkill {
  id: string;
  title: string;
  author: string;
  description: string;
  isActive: boolean;
}

interface SoftSkillsManagerProps {
  onBack: () => void;
}

const DEFAULT_SOFT_SKILLS: SoftSkill[] = [
    {
        id: '1',
        title: 'Inteligência Emocional',
        author: 'Daniel Goleman',
        description: 'Capacidade de reconhecer e gerenciar as próprias emoções e as dos outros. Fundamental para a saúde do ambiente de trabalho.',
        isActive: true
    },
    {
        id: '2',
        title: 'Comunicação Não-Violenta (CNV)',
        author: 'Marshall Rosenberg',
        description: 'Método focado em expressar-se com honestidade e ouvir com empatia para resolver conflitos pacificamente.',
        isActive: true
    },
    {
        id: '3',
        title: 'Mindset de Crescimento',
        author: 'Carol Dweck',
        description: 'A crença de que talentos podem ser desenvolvidos através de esforço, estratégias e mentoria.',
        isActive: true
    },
    {
        id: '4',
        title: 'Escuta Ativa',
        author: 'Carl Rogers',
        description: 'Técnica de comunicação que exige foco total no interlocutor, validando sua fala sem julgamentos precipitados.',
        isActive: true
    },
    {
        id: '5',
        title: 'Negociação e Conflitos',
        author: 'William Ury',
        description: 'Estratégias "ganha-ganha" para alcançar acordos satisfatórios em situações de divergência.',
        isActive: false
    },
    {
        id: '6',
        title: 'Pensamento Crítico',
        author: 'Daniel Kahneman',
        description: 'Habilidade de analisar informações de forma racional, identificando vieses cognitivos na tomada de decisão.',
        isActive: false
    },
    {
        id: '7',
        title: 'Gestão do Tempo (GTD)',
        author: 'David Allen',
        description: 'Arte da produtividade sem estresse: capturar, clarificar, organizar, refletir e engajar.',
        isActive: true
    },
    {
        id: '8',
        title: 'Resiliência e Antifragilidade',
        author: 'Nassim Taleb',
        description: 'Capacidade de não apenas resistir ao caos, mas de evoluir e se fortalecer diante das adversidades.',
        isActive: false
    },
    {
        id: '9',
        title: 'Liderança Inspiradora',
        author: 'Simon Sinek',
        description: 'Liderar pelo "Porquê": inspirar ação e lealdade através de um propósito claro e valores compartilhados.',
        isActive: false
    },
    {
        id: '10',
        title: 'Trabalho em Equipe',
        author: 'Patrick Lencioni',
        description: 'Superar as disfunções de um time para construir confiança e foco em resultados coletivos.',
        isActive: true
    }
];

const SoftSkillsManager: React.FC<SoftSkillsManagerProps> = ({ onBack }) => {
  const [skills, setSkills] = useState<SoftSkill[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('alice_soft_skills');
    if (saved) {
        setSkills(JSON.parse(saved));
    } else {
        setSkills(DEFAULT_SOFT_SKILLS);
    }
  }, []);

  const toggleSkill = (id: string) => {
    setSkills(prev => prev.map(skill => 
        skill.id === id ? { ...skill, isActive: !skill.isActive } : skill
    ));
    setHasChanges(true);
  };

  const handleSave = () => {
      localStorage.setItem('alice_soft_skills', JSON.stringify(skills));
      setHasChanges(false);
      alert('Configurações de trilhas salvas com sucesso!');
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-slate-800 transition-colors">
            <ArrowLeftIcon className="w-6 h-6 text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
               <BrainIcon className="w-8 h-8 text-blue-400" />
               Trilhas de Soft Skills
            </h1>
            <p className="text-slate-400 text-sm mt-1">
                Selecione as competências comportamentais disponíveis para os alunos.
            </p>
          </div>
        </div>
        
        {hasChanges && (
            <button 
                onClick={handleSave}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition-all shadow-lg animate-pulse"
            >
                <CheckCircleIcon className="w-5 h-5" /> Salvar Alterações
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skills.map(skill => (
                <div 
                    key={skill.id} 
                    className={`
                        p-5 rounded-xl border transition-all duration-300 relative overflow-hidden group
                        ${skill.isActive 
                            ? 'bg-slate-800 border-blue-500/50 shadow-lg shadow-blue-900/10' 
                            : 'bg-slate-900/50 border-slate-700 opacity-60 hover:opacity-100'}
                    `}
                >
                    <div className="flex justify-between items-start mb-3 relative z-10">
                        <div>
                            <h3 className={`font-bold text-lg ${skill.isActive ? 'text-white' : 'text-slate-400'}`}>
                                {skill.title}
                            </h3>
                            <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">
                                {skill.author}
                            </span>
                        </div>
                        <div className="flex items-center">
                            <button
                                onClick={() => toggleSkill(skill.id)}
                                className={`
                                    w-12 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500
                                    ${skill.isActive ? 'bg-blue-600' : 'bg-slate-600'}
                                `}
                                role="switch"
                                aria-checked={skill.isActive}
                                aria-label={`Ativar trilha ${skill.title}`}
                            >
                                <div 
                                    className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-300 ${skill.isActive ? 'translate-x-6' : 'translate-x-0'}`}
                                ></div>
                            </button>
                        </div>
                    </div>
                    
                    <p className="text-slate-300 text-sm leading-relaxed relative z-10">
                        {skill.description}
                    </p>

                    {/* Decorative Background Icon */}
                    <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
                         <BrainIcon className="w-24 h-24 text-white" />
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default SoftSkillsManager;
