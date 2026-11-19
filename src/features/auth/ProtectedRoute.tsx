import React from 'react';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { ShieldAlert, LogIn, Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!isSupabaseConfigured) return <>{children}</>;
  const { user, authLoading, signInWithGoogle } = useAppStore();

  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 animate-fade-in text-[var(--text-secondary)]">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--accent)]" />
        <p className="text-xs uppercase tracking-widest font-bold">Kimlik Doğrulanıyor...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="glass-panel p-10 rounded-[2.5rem] border border-[var(--border-primary)] shadow-2xl max-w-md w-full text-center flex flex-col items-center gap-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-serif font-bold text-[var(--text-primary)] mb-2">Erişim Reddedildi</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Bu modülü kullanabilmek için kurumsal ArcheLens hesabınızla giriş yapmalısınız.
            </p>
          </div>
          <button
            onClick={signInWithGoogle}
            className="w-full h-14 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] hover:bg-[var(--accent)] hover:text-white transition-all shadow-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3"
          >
            <LogIn size={16} /> Google İle Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;

};
