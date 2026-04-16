import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import type { QuizState } from './types';

// Custom storage using IndexedDB for lightweight persistence
const storage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export const useQuizStore = create<QuizState>()(
  persist(
    (set) => ({
      questions: [],
      preferences: {
        randomize: false,
        feedbackMode: 'immediate',
        isTimerEnabled: true,
        theme: 'light',
      },
      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),
      setQuestions: (questions) => set({ questions }),
      clearQuestions: () => set({ questions: [] }),
    }),
    {
      name: 'flashcard-storage',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ preferences: state.preferences }),
    }
  )
);
