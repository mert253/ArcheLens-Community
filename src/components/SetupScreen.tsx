import React from 'react';
import { KeyRound, ArrowRight } from 'lucide-react';

export const SetupScreen: React.FC<{ onSetupComplete: () => void }> = ({ onSetupComplete }) => (
  <div className="min-h-screen bg-stone-950 flex items-center justify-center p-6">
    <div className="w-full max-w-lg bg-stone-900 border border-stone-700 rounded-2xl p-8 text-stone-200 shadow-2xl">
      <KeyRound className="text-amber-400 mb-5" size={32} />
      <h1 className="text-2xl font-serif mb-4">ArcheLens Open Source</h1>
      <p className="text-stone-400 mb-5">Explore archaeology tools, maps and virtual museums. Cloud analysis is optional and requires your own provider account.</p>
      <ol className="list-decimal pl-5 space-y-3 text-sm text-stone-300">
        <li>Copy <code>.env.example</code> to <code>.env.local</code>.</li>
        <li>Set <code>GEMINI_API_KEY</code> on your server. For a trusted single-user installation, explicitly set <code>AUTH_MODE=local</code> and keep the server on loopback.</li>
        <li>For shared installations, configure your own Supabase project and keep <code>AUTH_MODE=supabase</code>.</li>
        <li>Restart with <code>npm run dev:all</code>. See the setup guide for details.</li>
      </ol>
      <p className="text-xs text-stone-400 mt-5">Online features send selected images and prompts to configured providers. Local browser history remains in this browser profile. Offline text assistance downloads a model and requires WebGPU; it cannot authenticate or date an artifact from a photograph.</p>
      <button onClick={onSetupComplete} className="mt-6 w-full rounded-xl p-3 bg-amber-500 text-stone-950 font-semibold flex items-center justify-center gap-2">Open workspace <ArrowRight size={16} /></button>
    </div>
  </div>
);
