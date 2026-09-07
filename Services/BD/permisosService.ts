// Services/BD/permisosService.ts
import { supabase } from '../superbase.service';

export interface ModuloDisponible {
    key: string;
    label: string;
    grupo?: string;
}

// Mismo universo de módulos sembrado en scripts/control_accesos_setup.sql.
// 'home' no aparece aquí porque siempre está visible, sin configurar.
// 'auditoria' y 'control de accesos' tampoco: se quedan fijos solo para Admin
// en layout/AppMenu.tsx, no se delegan por este sistema.
export const MODULOS_DISPONIBLES: ModuloDisponible[] = [
    { key: 'gestion', label: 'Gestión (GPS, Notas)' },
    { key: 'rrhh', label: 'RRHH' },
    { key: 'mantenimiento_equipamiento', label: 'Equipamiento', grupo: 'Mantenimiento' },
    { key: 'mantenimiento_taller', label: 'Taller', grupo: 'Mantenimiento' },
    { key: 'mantenimiento_almacen', label: 'Almacén', grupo: 'Mantenimiento' },
    { key: 'mantenimiento_costo_operativo', label: 'Costo Operativo', grupo: 'Mantenimiento' },
    { key: 'mantenimiento_compras', label: 'Compras', grupo: 'Mantenimiento' },
    { key: 'mantenimiento_combustible', label: 'Combustible', grupo: 'Mantenimiento' },
    { key: 'control_obras', label: 'Control de Obras' },
    { key: 'soporte', label: 'Soporte' },
    { key: 'admin_viajes', label: 'Administración de Viajes' },
    { key: 'admin_logistica', label: 'Administración de Logística' }
];

export interface UsuarioConAccesos {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
    roleid: number | null;
    activo: boolean;
    modulos: string[];
}

export const fetchUsuariosConAccesos = async (): Promise<UsuarioConAccesos[]> => {
    const { data: usuarios, error: usuariosError } = await supabase
        .from('user')
        .select('id, nombre, apellido, email, activo')
        .order('nombre');

    if (usuariosError) {
        console.error('Error obteniendo usuarios:', usuariosError);
        throw usuariosError;
    }

    const { data: roles, error: rolesError } = await supabase.from('userroles').select('userid, roleid');
    if (rolesError) console.error('Error obteniendo roles:', rolesError);

    const { data: permisos, error: permisosError } = await supabase.from('permisos_modulo').select('userid, modulo');
    if (permisosError) console.error('Error obteniendo permisos:', permisosError);

    const roleidPorUsuario = new Map<number, number>();
    (roles || []).forEach((r: any) => roleidPorUsuario.set(r.userid, r.roleid));

    const modulosPorUsuario = new Map<number, string[]>();
    (permisos || []).forEach((p: any) => {
        const actuales = modulosPorUsuario.get(p.userid) || [];
        actuales.push(p.modulo);
        modulosPorUsuario.set(p.userid, actuales);
    });

    return (usuarios || []).map((u: any) => ({
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        email: u.email,
        roleid: roleidPorUsuario.get(u.id) ?? null,
        activo: u.activo ?? true,
        modulos: modulosPorUsuario.get(u.id) || []
    }));
};

export const actualizarModulosDeUsuario = async (userId: number, modulos: string[]): Promise<void> => {
    const { error: deleteError } = await supabase.from('permisos_modulo').delete().eq('userid', userId);
    if (deleteError) {
        console.error('Error limpiando módulos previos:', deleteError);
        throw deleteError;
    }

    if (modulos.length === 0) return;

    const { error: insertError } = await supabase
        .from('permisos_modulo')
        .insert(modulos.map((modulo) => ({ userid: userId, modulo })));

    if (insertError) {
        console.error('Error asignando módulos:', insertError);
        throw insertError;
    }
};

const llamarConSesion = async (url: string, method: string, body: Record<string, any>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) throw new Error('No hay sesión activa');

    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result?.error || 'Ocurrió un error');
    return result;
};

export const cambiarPassword = async (userId: number, nuevaPassword: string): Promise<void> => {
    await llamarConSesion('/api/usuarios/cambiar-password', 'POST', { userId, nuevaPassword });
};

export const cambiarEstadoAcceso = async (userId: number, activo: boolean): Promise<void> => {
    await llamarConSesion('/api/usuarios', 'PATCH', { userId, activo });
};
