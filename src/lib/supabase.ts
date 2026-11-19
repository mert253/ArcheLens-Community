import { createClient } from '@supabase/supabase-js';

// .env.local dosyanızdaki verileri okur
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Anahtarlar yoksa placeholder ile başlat — uygulama kurulum ekranını gösterir
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
    auth: {
        persistSession: Boolean(supabaseUrl),
        autoRefreshToken: Boolean(supabaseUrl),
        detectSessionInUrl: Boolean(supabaseUrl),
    }
});

export type Profile = {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    updated_at?: string;
};

export type AnalysisRecord = {
    id: string;
    user_id: string;
    title: string;
    result_json: any;
    image_url?: string;
    created_at: string;
};
