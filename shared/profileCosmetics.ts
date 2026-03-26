export type CosmeticCurrency = 'duan' | 'sol';
export type CosmeticSlot = 'avatar' | 'background';

// Profil kozmetikleri backend odul bakiyesi ve frontend profil ekrani tarafinda
// ayni katalogtan okunur.
export type ProfileAvatarOption = {
  id: string;
  name: string;
  symbol: string;
  gradient: string;
  price: number;
  currency: CosmeticCurrency;
};

export type ProfileBackgroundOption = {
  id: string;
  name: string;
  gradient: string;
  price: number;
  currency: CosmeticCurrency;
};

export const PROFILE_AVATAR_OPTIONS: ProfileAvatarOption[] = [
  { id: 'default-core', name: 'Core Sigil', symbol: 'D', gradient: 'linear-gradient(135deg, #0f766e 0%, #22c55e 100%)', price: 0, currency: 'duan' },
  { id: 'sol-orbit', name: 'Sol Orbit', symbol: '◎', gradient: 'linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)', price: 0.01, currency: 'sol' },
  { id: 'duan-flare', name: 'DUAN Flare', symbol: '✦', gradient: 'linear-gradient(135deg, #f97316 0%, #facc15 100%)', price: 180, currency: 'duan' },
  { id: 'validator-mark', name: 'Validator Mark', symbol: '◇', gradient: 'linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)', price: 260, currency: 'duan' },
];

export const PROFILE_BACKGROUND_OPTIONS: ProfileBackgroundOption[] = [
  { id: 'default-grid', name: 'Grid Pulse', gradient: 'linear-gradient(135deg, #0f172a 0%, #0f766e 45%, #14b8a6 100%)', price: 0, currency: 'duan' },
  { id: 'solana-skyline', name: 'Solana Skyline', gradient: 'linear-gradient(135deg, #111827 0%, #7c3aed 35%, #06b6d4 100%)', price: 0.02, currency: 'sol' },
  { id: 'market-surge', name: 'Market Surge', gradient: 'linear-gradient(135deg, #1f2937 0%, #f97316 50%, #facc15 100%)', price: 240, currency: 'duan' },
  { id: 'guild-hall', name: 'Guild Hall', gradient: 'linear-gradient(135deg, #1e293b 0%, #2563eb 50%, #38bdf8 100%)', price: 320, currency: 'duan' },
];

export function getAvatarOptionById(id?: string | null) {
  return PROFILE_AVATAR_OPTIONS.find((option) => option.id === id) ?? PROFILE_AVATAR_OPTIONS[0];
}

export function getBackgroundOptionById(id?: string | null) {
  return PROFILE_BACKGROUND_OPTIONS.find((option) => option.id === id) ?? PROFILE_BACKGROUND_OPTIONS[0];
}
