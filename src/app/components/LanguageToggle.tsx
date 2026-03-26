import { Globe } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useLanguage } from '../contexts/LanguageContext';

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon"
          className="relative border-border/50 bg-background/72"
          title={t('language.change')}
          aria-label={t('language.change')}
        >
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[100] min-w-[140px] bg-background/95 backdrop-blur-sm" sideOffset={8}>
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            setLanguage('tr');
          }}
          className={`cursor-pointer ${language === 'tr' ? 'bg-primary/20 font-medium' : ''}`}
        >
          <span className="mr-2 text-base">🇹🇷</span>
          <span>{t('language.tr')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            setLanguage('en');
          }}
          className={`cursor-pointer ${language === 'en' ? 'bg-primary/20 font-medium' : ''}`}
        >
          <span className="mr-2 text-base">🇬🇧</span>
          <span>{t('language.en')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
