import { createClient } from '@supabase/supabase-js';

// อ่านค่าจาก Environment variables หรือ localStorage/config
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (typeof window !== 'undefined' ? (window as any).__SUPABASE_URL__ : '') || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof window !== 'undefined' ? (window as any).__SUPABASE_ANON_KEY__ : '') || '';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'));
};
