// Shared Types for Scholar App
export interface User {
  id: number;
  email: string;
  display_name: string | null;
  exp: number;
  max_combo: number;
  streak: number;
}

export interface Course  { name: string; total: number; completed: number; }
export interface Unit    { name: string; total: number; completed: number; }
export interface Question { id: number; vi: string; zh: string; pinyin: string; viPlus?: string; }
export interface Vocab   { id: number; word: string; pinyin: string; meaning: string; status: string; }
export interface Flashcard { id: number; zh: string; vi: string; pinyin: string; intervalDays: number; easeFactor: number; }
export interface Passage { id: number; level: string; title: string; zh: string; vi: string; }
export interface HSKWord {
  id: number; word: string; pinyin: string; wordType: string;
  meaning: string; exampleZh: string; examplePinyin: string; exampleVi: string;
  isAdded: boolean; level: string;
}
export interface DayActivity { label: string; value: number; date: string; }

export const THEMES = ['jade', 'dark', 'ocean', 'sunset'] as const;
export type Theme = typeof THEMES[number];
export const THEME_COLORS: Record<string, string> = {
  jade: '#006d43', dark: '#59de9b', ocean: '#0066cc', sunset: '#c04a00'
};
export const HSK_LEVELS = ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'];
