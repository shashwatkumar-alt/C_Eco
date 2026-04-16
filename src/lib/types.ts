export interface Question {
  id: string;
  weekId: string;
  questionText: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D' | string;
  explanation?: string;
}

export interface QuizState {
  questions: Question[];
  preferences: {
    randomize: boolean;
    feedbackMode: 'immediate' | 'review';
    isTimerEnabled: boolean;
    theme: 'light' | 'dark';
  };
  setPreferences: (prefs: Partial<QuizState['preferences']>) => void;
  setQuestions: (questions: Question[]) => void;
  clearQuestions: () => void;
}
