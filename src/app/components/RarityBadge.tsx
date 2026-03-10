import { Badge } from './ui/badge';
import { Rarity } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface RarityBadgeProps {
  rarity: Rarity;
}

export function RarityBadge({ rarity }: RarityBadgeProps) {
  const { t } = useLanguage();

  const rarityConfig: Record<Rarity, { className: string }> = {
    common: {
      className: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30',
    },
    rare: {
      className: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
    },
    epic: {
      className: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
    },
    legendary: {
      className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
    },
  };

  const config = rarityConfig[rarity];

  return (
    <Badge variant="outline" className={config.className}>
      {t(`rarity.${rarity}`)}
    </Badge>
  );
}