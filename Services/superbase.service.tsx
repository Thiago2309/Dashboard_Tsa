import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// detectSessionInUrl busca un token de sesión en la URL en cada carga (para flujos
// de OAuth/magic link con redirect). Esta app solo usa login por email y password,
// así que ese parseo nunca encuentra nada: se desactiva para no pagar ese costo.
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
    }
});