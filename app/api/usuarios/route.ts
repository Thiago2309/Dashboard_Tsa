import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../Services/superbaseAdmin.service';
import { buscarAuthUserPorEmail, verificarCallerEsAdmin } from '../../../Services/adminAuthHelper';
import { emailValido, escaparLike, normalizarEmail } from '../../../Services/emailUtil';

// Crea un usuario nuevo (auth + tabla 'user' + rol). Corre en el servidor con la
// key service_role, para que esa key nunca tenga que exponerse al navegador.
// Reemplaza la lógica que antes vivía en Services/BD/userService.ts:register(),
// la cual llamaba supabase.auth.admin.listUsers() directo desde el cliente.
//
// Esta ruta es de administración (crea cuentas con el rol que se le pida), así
// que exige que quien llama tenga una sesión válida Y sea Admin — si no,
// cualquiera que conociera la URL podría crearse una cuenta con cualquier rol.
export async function POST(request: Request) {
    try {
        const verificacion = await verificarCallerEsAdmin(request);
        if (!verificacion.ok) return verificacion.response;

        const body = await request.json();
        const { email: emailRecibido, password, userData, roleId } = body as {
            email: string;
            password: string;
            userData: { nombre?: string; apellido?: string; ciudad?: string; sueldo?: number };
            roleId?: number;
        };

        // Correo siempre en minúsculas y sin espacios (así lo guarda Supabase Auth)
        const email = normalizarEmail(emailRecibido);

        if (!email || !password) {
            return NextResponse.json({ error: 'email y password son obligatorios' }, { status: 400 });
        }
        if (!emailValido(email)) {
            return NextResponse.json({ error: 'El correo no es válido' }, { status: 400 });
        }

        // 1. Verificar si el email ya existe en auth (recorriendo todas las páginas:
        // listUsers() sin paginar solo regresaba los primeros 50 usuarios)
        let authExistente;
        try {
            authExistente = await buscarAuthUserPorEmail(email);
        } catch (listError) {
            console.error('Error listando usuarios:', listError);
            return NextResponse.json({ error: 'Error verificando usuarios existentes' }, { status: 500 });
        }

        let authId = authExistente?.id ?? '';

        if (!authId) {
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });

            if (authError || !authData.user) {
                console.error('Error en registro:', authError?.message);
                return NextResponse.json({ error: authError?.message || 'No se pudo crear el usuario' }, { status: 400 });
            }

            authId = authData.user.id;
        } else {
            // La cuenta ya existía en Auth. Si ningún registro de 'user' la usa, es una cuenta
            // huérfana (ej. se eliminó el empleado y solo se borró de la tabla): se le pone la
            // contraseña nueva, si no el login fallaría con la contraseña vieja (invalid_credentials).
            const { data: ligado } = await supabaseAdmin
                .from('user')
                .select('id')
                .eq('auth_id', authId)
                .limit(1)
                .maybeSingle();

            if (!ligado) {
                const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(authId, {
                    password,
                    email_confirm: true,
                    ban_duration: 'none'
                });
                if (resetError) {
                    console.error('Error reactivando cuenta huérfana en Auth:', resetError);
                    return NextResponse.json({ error: resetError.message }, { status: 400 });
                }
            }
        }

        // 2. Verificar si el usuario ya existe en la tabla 'user'
        const { data: usuarioExistente, error: userLookupError } = await supabaseAdmin
            .from('user')
            .select('id')
            .ilike('email', escaparLike(email))
            .limit(1)
            .maybeSingle();

        if (userLookupError) {
            console.error('Error verificando usuario en tabla:', userLookupError);
            return NextResponse.json({ error: 'Error verificando usuario en tabla' }, { status: 500 });
        }

        let userId = usuarioExistente?.id ?? null;

        if (!usuarioExistente) {
            const { data: userDataResponse, error: userError } = await supabaseAdmin
                .from('user')
                .insert([{
                    auth_id: authId,
                    email,
                    pass: password,
                    nombre: userData?.nombre || '',
                    apellido: userData?.apellido || '',
                    ciudad: userData?.ciudad || 'Ciudad de México',
                    sueldo: userData?.sueldo || 0
                }])
                .select()
                .single();

            if (userError) {
                console.error('Error insertando usuario en tabla user:', userError.message);
                return NextResponse.json({ error: userError.message }, { status: 500 });
            }

            userId = userDataResponse.id;
        }

        // 3. Asignar rol si se proporcionó
        if (roleId && userId) {
            const { data: existingRole } = await supabaseAdmin
                .from('userroles')
                .select('id')
                .eq('userid', userId)
                .eq('roleid', roleId)
                .maybeSingle();

            if (!existingRole) {
                const { error: roleError } = await supabaseAdmin
                    .from('userroles')
                    .insert([{ userid: userId, roleid: roleId }]);

                if (roleError) {
                    console.warn('No se pudo asignar el rol, pero el usuario fue creado:', roleError.message);
                }
            }
        }

        return NextResponse.json({ userId, authId });
    } catch (error: any) {
        console.error('Error en /api/usuarios:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}

// Activa o desactiva el acceso de un usuario. No borra nada — es reversible:
// login() revisa 'user.activo' y bloquea la entrada mientras esté en false.
// También se banea/desbanea la cuenta a nivel de Supabase Auth (no solo el
// flag de la app), para que quede bloqueada aunque alguien intente entrar sin
// pasar por login(). Si está ligada a un 'operador', se le refleja el mismo
// estatus en 'acceso_sistema' para que la pantalla de Operadores no quede
// desincronizada.
export async function PATCH(request: Request) {
    try {
        const verificacion = await verificarCallerEsAdmin(request);
        if (!verificacion.ok) return verificacion.response;

        const { userId, activo } = (await request.json()) as { userId?: number; activo?: boolean };
        if (!userId || typeof activo !== 'boolean') {
            return NextResponse.json({ error: 'userId y activo son obligatorios' }, { status: 400 });
        }

        if (!activo && userId === verificacion.callerUserId) {
            return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 });
        }

        const { data: objetivo, error: objetivoError } = await supabaseAdmin
            .from('user')
            .select('auth_id')
            .eq('id', userId)
            .maybeSingle();

        if (objetivoError || !objetivo) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        if (!activo) {
            const { data: rolesObjetivo } = await supabaseAdmin
                .from('userroles')
                .select('roleid')
                .eq('userid', userId);

            const esAdminObjetivo = (rolesObjetivo || []).some((r) => r.roleid === 1);
            if (esAdminObjetivo) {
                const { count } = await supabaseAdmin
                    .from('userroles')
                    .select('id', { count: 'exact', head: true })
                    .eq('roleid', 1);

                if ((count ?? 0) <= 1) {
                    return NextResponse.json({ error: 'No puedes desactivar al último administrador' }, { status: 400 });
                }
            }
        }

        const { error: updateUserError } = await supabaseAdmin.from('user').update({ activo }).eq('id', userId);
        if (updateUserError) {
            console.error('Error actualizando estado del usuario:', updateUserError);
            return NextResponse.json({ error: updateUserError.message }, { status: 500 });
        }

        await supabaseAdmin.from('operador').update({ acceso_sistema: activo }).eq('user_id', userId);

        if (objetivo.auth_id) {
            const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(objetivo.auth_id, {
                ban_duration: activo ? 'none' : '876000h'
            });
            if (banError) {
                console.error('Error actualizando estado en auth:', banError);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Error en PATCH /api/usuarios:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
