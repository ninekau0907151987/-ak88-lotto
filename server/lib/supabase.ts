import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

let defaultUrl = '';
let defaultKey = '';

const configPath = path.resolve(process.cwd(), 'supabase-config.json');
if (fs.existsSync(configPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    defaultUrl = raw.supabaseUrl || '';
    defaultKey = raw.serviceRoleKey || raw.anonKey || '';
  } catch (e) {
    // ignore
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || defaultUrl;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || defaultKey;

let client: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const getSupabase = (): SupabaseClient => {
  if (!client) {
    client = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};

export const isServerSupabaseConfigured = (): boolean => {
  return Boolean(client && supabaseUrl && !supabaseUrl.includes('placeholder'));
};
