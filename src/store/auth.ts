import { create } from 'zustand';
import { supabase } from '../lib/supabase';

type User = {
  id: string;
  email: string;
};

type AuthState = {
  user: User | null;
  setUser: (user: User | null) => void;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  showAuthModal: false,
  setShowAuthModal: (show) => set({ showAuthModal: show }),
}));