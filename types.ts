
export type UserRole = 'GESTOR' | 'ALUNO';

export type FontSize = 'normal' | 'large' | 'extra';

export interface AccessibilityState {
  highContrast: boolean;
  fontSize: FontSize;
  screenReaderMode: boolean;
  toggleHighContrast: () => void;
  setFontSize: (size: FontSize) => void;
  toggleScreenReaderMode: () => void;
}

export interface Option {
  label: string;
  value: string;
}

export interface Slide {
  text: string;
  imageUrl: string;
}

export interface ModuleContent {
  title: string;
  slides: Slide[];
  question: string;
  options: Option[];
  feedbackCorrect: string;
  feedbackWrong: string;
}

export interface Message {
  id: string;
  sender: 'ALICE' | 'USER';
  text: string;
  imageUrl?: string;
  options?: Option[];
  reward?: {
    title: string;
    points: number;
  };
}

export type ConversationStage = 
  | 'GREETING'
  | 'REELS_VIEW'
  | 'QUIZ_VIEW'
  | 'FEEDBACK_VIEW'
  | 'DIAGNOSTIC_START'
  | 'TRAIL_SELECTION'
  | 'LEVEL_SELECTION';

export interface UserState {
  name?: string;
  email?: string;
  goal?: string; 
  currentTrail?: string;
  currentModuleIndex: number;
  currentSlideIndex: number;
  currentModuleContent?: ModuleContent;
  completedQuizzes: number[];
  points: number;
  level: number;
  badges?: string[];
}
