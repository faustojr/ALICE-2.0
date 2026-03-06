
import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, XMarkIcon, LinkIcon } from './Icons';

interface Law {
  id: string;
  title: string;
  category: string;
  description: string;
  officialLink?: string;
  lastUpdated: string;
}

interface LawsManagerProps {
  onBack: () => void;
}

const initialMockLaws: Law[] = [
  {
    id: '1',
    title: 'Lei Nº 14.133 (Lei de Licitações)',
    category: 'Federal',
    description: 'Estabelece normas gerais de licitação e contratação para as Administrações Públicas diretas, autárquicas e fundacionais.',
    officialLink: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm',
    lastUpdated: new Date().toLocaleDateString()
  },
  {
    id: '2',
    title: 'Lei Complementar Nº 101 (LRF)',
    category: 'Federal',
    description: 'Estabelece normas de finanças públicas voltadas para a responsabilidade na gestão fiscal.',
    officialLink: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm',
    lastUpdated: new Date().toLocaleDateString()
  },
  {
    id: '3',
    title: 'Plano Diretor Municipal',
    category: 'Municipal',
    description: 'Instrumento básico da política de desenvolvimento e de expansão urbana.',
    lastUpdated: new Date().toLocaleDateString()
  }
];

const LawsManager: React.FC<LawsManagerProps> = ({ onBack }) => {
  const [laws, setLaws] = useState<Law[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentLaw, setCurrentLaw] = useState<Partial<Law>>({});

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedLaws = localStorage.getItem('alice_laws');
    if (savedLaws) {
      setLaws(JSON.parse(savedLaws));
    } else {
      setLaws(initialMockLaws);
    }
  }, []);

  // Save to LocalStorage whenever laws change
  useEffect(() => {
    if (laws.length > 0) {
      localStorage.setItem('alice_laws', JSON.stringify(laws));
    }
  }, [laws]);

  const handleAddNew = () => {
    setCurrentLaw({ category: 'Federal', title: '', description: '', officialLink: '' });
    setIsEditing(true);
  };

  const handleEdit = (law: Law) => {
    setCurrentLaw(law);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta lei?')) {
      const updatedLaws = laws.filter(l => l.id !== id);
      setLaws(updatedLaws);
      if (updatedLaws.length === 0) localStorage.removeItem('alice_laws');
    }
  };

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentLaw.title || !currentLaw.description || !currentLaw.officialLink) {
      alert('Por favor, preencha todos os campos obrigatórios, incluindo o link oficial.');
      return;
    }

    if (!isValidUrl(currentLaw.officialLink)) {
      alert('O Link Oficial inserido não é válido. Certifique-se de incluir "http://" ou "https://".');
      return;
    }

    const now = new Date().toLocaleDateString();

    if (currentLaw.id) {
      // Update existing
      setLaws(prev => prev.map(l => l.id === currentLaw.id ? { ...l, ...currentLaw as Law, lastUpdated: now } : l));
    } else {
      // Create new
      const newLaw: Law = {
        id: Date.now().toString(),
        title: currentLaw.title || '',
        category: currentLaw.category || 'Geral',
        description: currentLaw.description || '',
        officialLink: currentLaw.officialLink || '',
        lastUpdated: now
      };
      setLaws(prev => [newLaw, ...prev]);
    }
    
    setIsEditing(false);
    setCurrentLaw({});
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-slate-800 transition-colors">
            <ArrowLeftIcon className="w-6 h-6 text-slate-400" />
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
             {isEditing ? (currentLaw.id ? 'Editar Lei/Norma' : 'Nova Lei/Norma') : 'Gerenciar Leis e Normas'}
          </h1>
        </div>
        {!isEditing && (
          <button 
            onClick={handleAddNew}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Adicionar</span>
          </button>
        )}
      </div>

      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
        {isEditing ? (
          <form onSubmit={handleSave} className="p-6 space-y-6 max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-400 mb-2">Título da Lei/Norma</label>
                    <input 
                        type="text" 
                        value={currentLaw.title || ''}
                        onChange={e => setCurrentLaw({...currentLaw, title: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Lei Nº 14.133"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Categoria</label>
                    <select 
                        value={currentLaw.category || 'Federal'}
                        onChange={e => setCurrentLaw({...currentLaw, category: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="Federal">Federal</option>
                        <option value="Estadual">Estadual</option>
                        <option value="Municipal">Municipal</option>
                        <option value="Interna">Norma Interna</option>
                    </select>
                </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Link Oficial da Publicação <span className="text-red-400">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                   <LinkIcon className="h-5 w-5 text-slate-500" />
                </div>
                <input 
                    type="url" 
                    value={currentLaw.officialLink || ''}
                    onChange={e => setCurrentLaw({...currentLaw, officialLink: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                    placeholder="https://www.planalto.gov.br/..."
                    required
                />
              </div>
              <p className="mt-2 text-xs text-amber-400 bg-amber-900/20 p-2 rounded border border-amber-900/50">
                ⚠️ <strong>Importante:</strong> Insira apenas links de leis e normas que já foram publicadas oficialmente (Ex: Diário Oficial, Planalto, Sites Governamentais). A plataforma ALICE utiliza este link para acessar o conteúdo real e gerar o microaprendizagem. Documentos não publicados ou não oficiais não devem ser inseridos.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Descrição / Resumo</label>
              <textarea 
                value={currentLaw.description || ''}
                onChange={e => setCurrentLaw({...currentLaw, description: e.target.value})}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white h-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Descreva o objetivo principal da lei ou norma..."
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button 
                type="button" 
                onClick={() => setIsEditing(false)}
                className="px-6 py-2 rounded-lg text-slate-300 hover:bg-slate-700 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg shadow-green-900/20 transition-all flex items-center gap-2"
              >
                <CheckCircleIcon className="w-5 h-5" /> Salvar Conteúdo
              </button>
            </div>
          </form>
        ) : (
          <div className="overflow-x-auto">
            {laws.length === 0 ? (
                <div className="p-10 text-center text-slate-500">
                    <p>Nenhuma lei cadastrada.</p>
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-900/50 border-b border-slate-700 text-slate-400 text-sm uppercase">
                    <th className="p-4 font-semibold">Título</th>
                    <th className="p-4 font-semibold hidden sm:table-cell">Categoria</th>
                    <th className="p-4 font-semibold hidden md:table-cell">Última Atualização</th>
                    <th className="p-4 font-semibold text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {laws.map(law => (
                    <tr key={law.id} className="hover:bg-slate-700/30 transition-colors group">
                        <td className="p-4">
                            <div className="font-medium text-white">{law.title}</div>
                            {law.officialLink && (
                                <a 
                                    href={law.officialLink} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1"
                                >
                                    <LinkIcon className="w-3 h-3" /> Link Oficial
                                </a>
                            )}
                            <div className="text-sm text-slate-400 md:hidden mt-1">{law.description.substring(0, 50)}...</div>
                        </td>
                        <td className="p-4 hidden sm:table-cell">
                            <span className={`
                                px-2 py-1 rounded text-xs font-semibold
                                ${law.category === 'Federal' ? 'bg-blue-900/50 text-blue-300 border border-blue-800' : 
                                law.category === 'Municipal' ? 'bg-green-900/50 text-green-300 border border-green-800' : 
                                'bg-slate-700 text-slate-300'}
                            `}>
                                {law.category}
                            </span>
                        </td>
                        <td className="p-4 hidden md:table-cell text-slate-400 text-sm">
                            {law.lastUpdated}
                        </td>
                        <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                            <button 
                                onClick={() => handleEdit(law)}
                                className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                title="Editar"
                            >
                                <PencilIcon className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => handleDelete(law.id)}
                                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                title="Excluir"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LawsManager;
