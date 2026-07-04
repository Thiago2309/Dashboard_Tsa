import { supabase } from '../../superbase.service';

export interface PeriodoVacaciones {
    id?: number;
    id_operador: number | null;
    fecha_inicio: string;
    fecha_fin: string;
    dias_otorgados: number;
    dias_disfrutados: number;
    dias_pendientes: number;
    created_at?: string;
    updated_at?: string;
    // Campos de la vista
    operador_nombre?: string;
    // operador_apellidos?: string;
    fecha_contratacion?: string;
    años_antiguedad?: number;
}

export interface OperadorVacaciones {
    id: number;
    nombre: string;
    // apellidos: string;
    fecha_contratacion: string;
    total_dias_otorgados: number;
    total_dias_disfrutados: number;
    total_dias_pendientes: number;
    periodos: PeriodoVacaciones[];
}

// Obtener todos los periodos de vacaciones
export const fetchPeriodosVacaciones = async (): Promise<PeriodoVacaciones[]> => {
    const { data, error } = await supabase
        .from('fetch_vacaciones')
        .select('*');

    if (error) {
        console.error('Error fetching periodos vacaciones:', error);
        throw error;
    }

    return data || [];
};

// Obtener operadores con sus periodos de vacaciones
export const fetchOperadoresConVacaciones = async (): Promise<OperadorVacaciones[]> => {
    const { data: operadores, error: errorOperadores } = await supabase
        .from('operador')
        .select('id, nombre, fecha_contratacion')
        .eq('estatus', true)
        .order('nombre');

    if (errorOperadores) {
        console.error('Error fetching operadores:', errorOperadores);
        throw errorOperadores;
    }

    const { data: periodos, error: errorPeriodos } = await supabase
        .from('fetch_vacaciones')
        .select('*');

    if (errorPeriodos) {
        console.error('Error fetching periodos:', errorPeriodos);
        throw errorPeriodos;
    }

    // Agrupar periodos por operador
    const operadoresConVacaciones = operadores.map(operador => {
        const periodosOperador = periodos?.filter(p => p.id_operador === operador.id) || [];
        
        const total_dias_otorgados = periodosOperador.reduce((sum, p) => sum + (p.dias_otorgados || 0), 0);
        const total_dias_disfrutados = periodosOperador.reduce((sum, p) => sum + (p.dias_disfrutados || 0), 0);
        const total_dias_pendientes = periodosOperador.reduce((sum, p) => sum + (p.dias_pendientes || 0), 0);

        return {
            ...operador,
            total_dias_otorgados,
            total_dias_disfrutados,
            total_dias_pendientes,
            periodos: periodosOperador
        };
    });

    return operadoresConVacaciones;
};

// Crear un nuevo periodo de vacaciones
export const createPeriodoVacaciones = async (periodo: Omit<PeriodoVacaciones, 'id'>): Promise<PeriodoVacaciones> => {
    const { data, error } = await supabase
        .from('vacaciones_periodos')
        .insert([periodo])
        .select('*')
        .single();

    if (error) {
        console.error('Error creating periodo vacaciones:', error);
        throw error;
    }

    return data;
};

// Actualizar un periodo de vacaciones
export const updatePeriodoVacaciones = async (periodo: PeriodoVacaciones): Promise<PeriodoVacaciones> => {
    const { data, error } = await supabase
        .from('vacaciones_periodos')
        .update({
            fecha_inicio: periodo.fecha_inicio,
            fecha_fin: periodo.fecha_fin,
            dias_otorgados: periodo.dias_otorgados,
            dias_disfrutados: periodo.dias_disfrutados,
            dias_pendientes: periodo.dias_pendientes
        })
        .eq('id', periodo.id)
        .select('*')
        .single();

    if (error) {
        console.error('Error updating periodo vacaciones:', error);
        throw error;
    }

    return data;
};

// Eliminar un periodo de vacaciones
export const deletePeriodoVacaciones = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('vacaciones_periodos')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting periodo vacaciones:', error);
        throw error;
    }
};

// Obtener operadores (reutilizamos el existente)
export const fetchOperadores = async (): Promise<{ id: number; nombre: string; fecha_contratacion: string }[]> => {
    const { data, error } = await supabase
        .from('operador')
        .select('id, nombre, fecha_contratacion')
        .eq('estatus', true)
        .order('nombre');

    if (error) {
        console.error('Error fetching operadores:', error);
        throw error;
    }

    return data || [];
};