
import React, { useState } from 'react';
import { useAccessibility } from '../App';
import { AccessibilityIcon, PlusIcon, MinusIcon, TextSizeIcon, XMarkIcon } from './Icons';
import type { FontSize } from '../types';

const AccessibilityMenu: React.FC = () => {
  const { highContrast, fontSize, screenReaderMode, toggleHighContrast, setFontSize, toggleScreenReaderMode } = useAccessibility();
  const [isOpen, setIsOpen] = useState(false);

  const getButtonClass = (isActive: boolean) => {
    const base = "w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-colors ";
    if (highContrast) {
        return isActive ? base + "bg-yellow-400 text-black font-bold border-2 border-white" : base + "bg-gray-800 text-yellow-300 border border-yellow-300";
    }
    return isActive ? base + "bg-blue-600 text-white" : base + "bg-slate-700 text-slate-200 hover:bg-slate-600";
  };

  const handleFontSizeChange = (increment: boolean) => {
    const sizes: FontSize[] = ['normal', 'large', 'extra'];
    const currentIndex = sizes.indexOf(fontSize);
    
    if (increment && currentIndex < sizes.length - 1) {
        setFontSize(sizes[currentIndex + 1]);
    } else if (!increment && currentIndex > 0) {
        setFontSize(sizes[currentIndex - 1]);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-3 rounded-full shadow-lg transition-transform hover:scale-105 ${highContrast ? 'bg-yellow-400 text-black' : 'bg-blue-600 text-white'}`}
        aria-label="Menu de Acessibilidade"
        aria-expanded={isOpen}
      >
        {isOpen ? <XMarkIcon className="w-6 h-6" /> : <AccessibilityIcon className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div className={`absolute top-14 right-0 w-72 rounded-xl shadow-2xl border p-4 space-y-4 ${highContrast ? 'bg-black border-yellow-400' : 'bg-slate-800 border-slate-600'}`}>
          <h3 className={`font-bold text-lg mb-2 ${highContrast ? 'text-yellow-300' : 'text-white'}`}>Acessibilidade</h3>
          
          {/* Alto Contraste */}
          <button 
            onClick={toggleHighContrast}
            className={getButtonClass(highContrast)}
          >
            <span>Alto Contraste</span>
            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${highContrast ? 'bg-black' : 'bg-slate-500'}`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${highContrast ? 'translate-x-4' : ''}`}></div>
            </div>
          </button>

          {/* Tamanho da Fonte */}
          <div className={`rounded-lg p-3 ${highContrast ? 'bg-gray-800 border border-yellow-300' : 'bg-slate-700'}`}>
            <div className={`text-sm mb-2 font-semibold ${highContrast ? 'text-yellow-300' : 'text-slate-300'}`}>Tamanho da Fonte</div>
            <div className="flex items-center justify-between gap-2">
                <button 
                    onClick={() => handleFontSizeChange(false)}
                    disabled={fontSize === 'normal'}
                    className={`p-2 rounded hover:bg-opacity-80 disabled:opacity-30 ${highContrast ? 'bg-yellow-400 text-black' : 'bg-slate-600 text-white'}`}
                    aria-label="Diminuir fonte"
                >
                    <MinusIcon className="w-5 h-5" />
                </button>
                <div className={`flex items-center gap-2 ${highContrast ? 'text-yellow-300' : 'text-white'}`}>
                    <TextSizeIcon className="w-5 h-5" />
                    <span className="capitalize">{fontSize === 'extra' ? 'Extra' : fontSize === 'large' ? 'Grande' : 'Normal'}</span>
                </div>
                <button 
                    onClick={() => handleFontSizeChange(true)}
                    disabled={fontSize === 'extra'}
                    className={`p-2 rounded hover:bg-opacity-80 disabled:opacity-30 ${highContrast ? 'bg-yellow-400 text-black' : 'bg-slate-600 text-white'}`}
                    aria-label="Aumentar fonte"
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            </div>
          </div>

          {/* Modo Leitor de Tela */}
          <button 
            onClick={toggleScreenReaderMode}
            className={getButtonClass(screenReaderMode)}
          >
            <span>Leitor de Tela</span>
            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${screenReaderMode ? (highContrast ? 'bg-black' : 'bg-blue-400') : 'bg-slate-500'}`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${screenReaderMode ? 'translate-x-4' : ''}`}></div>
            </div>
          </button>
          
          {screenReaderMode && (
             <p className={`text-xs p-2 rounded ${highContrast ? 'text-yellow-300 bg-gray-900' : 'text-slate-400 bg-slate-900'}`}>
                Modo ativado: Descrições de imagem serão priorizadas e animações reduzidas.
             </p>
          )}

        </div>
      )}
    </div>
  );
};

export default AccessibilityMenu;
