// Services/BD/incidenciasService.ts
import { supabase } from '../superbase.service';

export type EstatusIncidencia = 'pendiente' | 'completado';

export interface Incidencia {
    id?: number;
    folio?: string;
    titulo: string;
    nota?: string;
    estatus: EstatusIncidencia;
    id_usuario_reporta: number | null;
    usuario_nombre?: string;
    usuario_apellido?: string;
    created_at?: string;
    updated_at?: string;
}

// Obtener el id del usuario logueado desde localStorage
export const getUsuarioIdFromLocalStorage = (): number | null => {
    const userData = localStorage.getItem('userData');
    return userData ? (JSON.parse(userData).userId as number) : null;
};

// Obtener todas las incidencias
export const fetchIncidencias = async (): Promise<Incidencia[]> => {
    const { data, error } = await supabase
        .from('fetch_incidencias')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error obteniendo incidencias:', error);
        throw error;
    }

    return data || [];
};

// Crear una nueva incidencia (el folio INC-#### se genera automáticamente en la base de datos)
export const createIncidencia = async (incidencia: { titulo: string; nota?: string; id_usuario_reporta: number | null }): Promise<Incidencia> => {
    const { data, error } = await supabase
        .from('incidencias')
        .insert([
            {
                titulo: incidencia.titulo,
                nota: incidencia.nota || null,
                id_usuario_reporta: incidencia.id_usuario_reporta,
                estatus: 'pendiente'
            }
        ])
        .select('*')
        .single();

    if (error) {
        console.error('Error creando incidencia:', error);
        throw error;
    }

    return data;
};

// Actualizar el estatus de una incidencia (pendiente / completado)
export const updateEstatusIncidencia = async (id: number, estatus: EstatusIncidencia): Promise<Incidencia> => {
    const { data, error } = await supabase
        .from('incidencias')
        .update({ estatus, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        console.error('Error actualizando estatus de incidencia:', error);
        throw error;
    }

    return data;
};

// Eliminar una incidencia
export const deleteIncidencia = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('incidencias')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error eliminando incidencia:', error);
        throw error;
    }
};
