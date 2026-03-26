import { create } from 'zustand';

interface User {
  walletAddress: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  selectedAvatarId?: string;
  selectedBackgroundId?: string;
  ownedAvatarIds?: string[];
  ownedBackgroundIds?: string[];
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
  tokenBalance: 0,
  setSolBalance: (balance) => set({ solBalance: balance }),
  setTokenBalance: (balance) => set({ tokenBalance: balance }),
}));
