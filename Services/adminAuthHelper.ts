// Services/adminAuthHelper.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './superbaseAdmin.service';

// Server-only: busca una cuenta de Supabase Auth por correo. listUsers() regresa solo 50
// usuarios por página si no se pagina, así que se recorren todas las páginas.
export const buscarAuthUserPorEmail = async (email: string): Promise<{ id: string; email?: string } | null> => {
    const buscado = email.trim().toLowerCase();
    const porPagina = 1000;
    for (let page = 1; page <= 50; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: porPagina });
        if (error) throw error;
        const usuarios = data?.users || [];
        const encontrado = usuarios.find((u) => (u.email || '').toLowerCase() === buscado);
        if (encontrado) return { id: encontrado.id, email: encontrado.email };
        if (usuarios.length < porPagina) break;
    }
    return null;
};

// Solo Admin (roleid 1, ver ROLES en layout/AppMenu.tsx) puede usar las rutas
// de administración de usuarios (crear, cambiar contraseña, eliminar acceso).
const ROLEID_ADMIN = 1;

// Server-only: verifica que la petición traiga un token de sesión válido y que
// ese usuario sea Admin. Se usa al inicio de cada ruta bajo app/api/usuarios/**
// para que nadie que solo conozca la URL pueda gestionar cuentas ajenas.
export const verificarCallerEsAdmin = async (
    request: Request
): Promise<{ ok: true; callerUserId: number } | { ok: false; response: NextResponse }> => {
    const authHeader = request.headers.get('authorization') || '';
    const callerToken = authHeader.replace(/^Bearer\s+/i, '');

    if (!callerToken) {
        return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
    }

    const { data: callerAuth, error: callerAuthError } = await supabaseAdmin.auth.getUser(callerToken);
    if (callerAuthError || !callerAuth.user) {
        return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
    }

    const { data: callerUser, error: callerUserError } = await supabaseAdmin
        .from('user')
        .select('id')
        .eq('auth_id', callerAuth.user.id)
        .maybeSingle();

    if (callerUserError || !callerUser) {
        return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
    }

    const { data: callerRole } = await supabaseAdmin
        .from('userroles')
        .select('roleid')
        .eq('userid', callerUser.id)
        .eq('roleid', ROLEID_ADMIN)
        .maybeSingle();

    if (!callerRole) {
        return { ok: false, response: NextResponse.json({ error: 'Solo un administrador puede hacer esto' }, { status: 403 }) };
    }

    return { ok: true, callerUserId: callerUser.id };
};
