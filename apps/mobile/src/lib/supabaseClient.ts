import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL_RAW = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_RAW = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

function sanitizeEnv(s: string) {
  return (s ?? '').trim().replace(/^"|"$/g, '');
}

export const SUPABASE_URL = sanitizeEnv(SUPABASE_URL_RAW);
export const SUPABASE_ANON_KEY = sanitizeEnv(SUPABASE_ANON_RAW);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
} else {
    // Diagnostic safe logs
    try {
        const urlHost = new URL(SUPABASE_URL).host;
        const anonLen = SUPABASE_ANON_KEY.length;
        const parts = SUPABASE_ANON_KEY.split('.');
        console.log(`Supabase Config: Host=${urlHost}, KeyLen=${anonLen}, Parts=${parts.length}`);
        
        if (anonLen < 50 || parts.length !== 3) {
            console.error("Anon key looks malformed (quotes/whitespace/truncated). Check .env");
        }
    } catch (e) {
        console.error("Error checking Supabase config format", e);
    }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
