import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../Services/superbaseAdmin.service';
import { verificarCallerEsAdmin } from '../../../../Services/adminAuthHelper';

// Cambia la contraseña de cualquier cuenta. Requiere service_role (solo Auth
// admin puede forzar una contraseña nueva sin conocer la actual), así que
// corre en el servidor y exige que quien llama sea Admin.
//
// También se guarda en 'user.pass' a petición explícita: la app ya no la lee
// de ahí (RLS se lo bloquea a 'authenticated'), pero el Admin la consulta
// directo en el Table Editor de Supabase (que sí ve la columna, RLS no aplica
// ahí) cuando se le olvida una contraseña.
export async function POST(request: Request) {
    try {
        const verificacion = await verificarCallerEsAdmin(request);
        if (!verificacion.ok) return verificacion.response;

        const { userId, nuevaPassword } = (await request.json()) as { userId?: number; nuevaPassword?: string };

        if (!userId || !nuevaPassword) {
            return NextResponse.json({ error: 'userId y nuevaPassword son obligatorios' }, { status: 400 });
        }

        if (nuevaPassword.length < 6) {
            return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
        }

        const { data: objetivo, error: objetivoError } = await supabaseAdmin
            .from('user')
            .select('auth_id')
            .eq('id', userId)
            .maybeSingle();

        if (objetivoError || !objetivo?.auth_id) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(objetivo.auth_id, {
            password: nuevaPassword
        });

        if (updateError) {
            console.error('Error actualizando contraseña:', updateError);
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        const { error: updatePassColumnError } = await supabaseAdmin
            .from('user')
            .update({ pass: nuevaPassword })
            .eq('id', userId);

        if (updatePassColumnError) {
            console.error('Contraseña cambiada en Auth, pero no se pudo reflejar en user.pass:', updatePassColumnError);
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Error en /api/usuarios/cambiar-password:', error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
