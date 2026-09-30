import { createClient } from '@supabase/supabase-js';

// ค่าเริ่มต้นสำหรับ Supabase Project: aogylynelbkjjdiclfeq
const DEFAULT_SUPABASE_URL = 'https://aogylynelbkjjdiclfeq.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_JPASpLsQip_mnqYWsRPCfA_hQAfSCPH';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'));
};
