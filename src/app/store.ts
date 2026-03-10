import { create } from 'zustand';

interface User {
  walletAddress: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
}

interface AppStore {
  user: User | null;
  setUser: (user: User | null) => void;
  solBalance: number;
  tokenBalance: number;
  setSolBalance: (balance: number) => void;
  setTokenBalance: (balance: number) => void;
}

export const useStore = create<AppStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  solBalance: 0,
  tokenBalance: 1000, // Mock starting balance
  setSolBalance: (balance) => set({ solBalance: balance }),
  setTokenBalance: (balance) => set({ tokenBalance: balance }),
}));
