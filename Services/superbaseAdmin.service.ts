import { createClient } from '@supabase/supabase-js'

// Cliente ADMIN — usa la key service_role, que bypassea RLS y da acceso total.
// Server-only: nunca importar este archivo desde un componente 'use client' ni
// desde nada que se ejecute en el navegador. Solo se usa dentro de app/api/**/route.ts.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});
