import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../Services/superbaseAdmin.service';
import { buscarAuthUserPorEmail, verificarCallerEsAdmin } from '../../../../Services/adminAuthHelper';
import { emailValido, escaparLike, normalizarEmail } from '../../../../Services/emailUtil';

// Actualiza el correo y/o la contraseña de una cuenta, manteniendo sincronizados
// Supabase Auth y la tabla public."user".
//
// Orden: PRIMERO Auth (auth.admin.updateUserById con service_role) y DESPUÉS la tabla.
// Si Auth falla, la tabla no se toca y se regresa el error para mostrarlo en pantalla.
// Antes, la edición de empleados escribía solo en la tabla y Auth se quedaba con los
// datos viejos, por lo que el login fallaba con "invalid_credentials".
//
// La contraseña se sigue guardando también en user.pass (a petición del cliente, para
// que el Admin la pueda consultar), pero solo después de que Auth la aceptó.
//
// Body:
//   { userId, email?, password? }          -> edición normal (password vacío = no se cambia)
//   { userId, sincronizarDesdeTabla: true } -> repara una cuenta desincronizada: empuja a
//                                              Auth el correo y la contraseña de la tabla.
export async function POST(request: Request) {
    try {
        const verificacion = await verificarCallerEsAdmin(request);
        if (!verificacion.ok) return verificacion.response;

        const body = (await request.json()) as {
            userId?: number;
            email?: string;
            password?: string;
            sincronizarDesdeTabla?: boolean;
        };

        if (!body.userId) {
            return NextResponse.json({ error: 'userId es obligatorio' }, { status: 400 });
        }

        const { data: usuario, error: usuarioError } = await supabaseAdmin
            .from('user')
            .select('id, auth_id, email, pass')
            .eq('id', body.userId)
            .maybeSingle();

        if (usuarioError || !usuario) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        // Valores finales: en modo sincronizar salen de la tabla; si no, del formulario
        // (si un campo no viene, se conserva el correo actual / no se cambia la contraseña).
        const email = normalizarEmail(body.sincronizarDesdeTabla ? usuario.email : body.email || usuario.email);
        const passwordTexto = body.sincronizarDesdeTabla ? usuario.pass : body.password;
        const password = passwordTexto && passwordTexto.length > 0 ? passwordTexto : undefined;

        if (!email || !emailValido(email)) {
            return NextResponse.json({ error: 'El correo no es válido' }, { status: 400 });
        }
        if (password && password.length < 6) {
            return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
        }

        // 1. El correo no debe pertenecer a otro usuario (tabla y Auth)
        const { data: otrosEnTabla, error: dupError } = await supabaseAdmin
            .from('user')
            .select('id')
            .ilike('email', escaparLike(email))
            .neq('id', usuario.id)
            .limit(1);

        if (dupError) {
            console.error('Error validando correo duplicado:', dupError);
            return NextResponse.json({ error: 'No se pudo validar el correo' }, { status: 500 });
        }
        if ((otrosEnTabla || []).length > 0) {
            return NextResponse.json({ error: `El correo ${email} ya lo usa otro usuario` }, { status: 409 });
        }

        const authConEseCorreo = await buscarAuthUserPorEmail(email);
        let authId: string | null = usuario.auth_id;

        if (authConEseCorreo && authId && authConEseCorreo.id !== authId) {
            return NextResponse.json({ error: `El correo ${email} ya está registrado en otra cuenta de acceso` }, { status: 409 });
        }

        // 2. PRIMERO Auth
        if (!authId) {
            // Usuario sin cuenta en Auth (dato viejo/roto): se liga a la cuenta existente
            // con ese correo o se crea una nueva (para crearla hace falta contraseña).
            if (authConEseCorreo) {
                authId = authConEseCorreo.id;
                const { error } = await supabaseAdmin.auth.admin.updateUserById(authId, {
                    email,
                    email_confirm: true,
                    ...(password ? { password } : {})
                });
                if (error) return NextResponse.json({ error: traducirErrorAuth(error.message) }, { status: 400 });
            } else {
                if (!password) {
                    return NextResponse.json(
                        { error: 'Este usuario no tiene cuenta de acceso; escribe una contraseña para crearla' },
                        { status: 400 }
                    );
                }
                const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
                if (error || !data.user) {
                    return NextResponse.json({ error: traducirErrorAuth(error?.message) }, { status: 400 });
                }
                authId = data.user.id;
            }
        } else {
            const { error } = await supabaseAdmin.auth.admin.updateUserById(authId, {
                email,
                email_confirm: true,
                ...(password ? { password } : {})
            });
            if (error) {
                console.error('Error actualizando credenciales en Auth:', error);
                return NextResponse.json({ error: traducirErrorAuth(error.message) }, { status: 400 });
            }
        }

        // 3. DESPUÉS la tabla (solo si Auth respondió bien)
        const cambios: Record<string, any> = { email, auth_id: authId };
        if (password) cambios.pass = password;

        const { error: updateError } = await supabaseAdmin.from('user').update(cambios).eq('id', usuario.id);
        if (updateError) {
            console.error('Auth actualizado pero falló la tabla user:', updateError);
            return NextResponse.json(
                { error: `El acceso se actualizó, pero no se pudo guardar en la tabla de usuarios: ${updateError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({ ok: true, email, authId });
    } catch (error: any) {
        console.error('Error en /api/usuarios/credenciales:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

const traducirErrorAuth = (mensaje?: string): string => {
    const m = (mensaje || '').toLowerCase();
    if (m.includes('already been registered') || m.includes('already registered') || m.includes('email_exists')) {
        return 'Ese correo ya está registrado en otra cuenta de acceso';
    }
    if (m.includes('password') && (m.includes('at least') || m.includes('weak'))) {
        return 'La contraseña es muy débil o muy corta (mínimo 6 caracteres)';
    }
    if (m.includes('invalid') && m.includes('email')) return 'El correo no es válido';
    return mensaje || 'No se pudo actualizar la cuenta de acceso';
};
