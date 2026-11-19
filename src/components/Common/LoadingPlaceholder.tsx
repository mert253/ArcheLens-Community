import React from 'react';
import { t } from '../../i18n';
import { Language } from '../../types';

interface LoadingPlaceholderProps {
  lang: Language;
}

export const LoadingPlaceholder: React.FC<LoadingPlaceholderProps> = ({ lang }) => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
        {t('common.loading', lang)}
      </p>
    </div>
  </div>
);
