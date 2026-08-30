import { supabase } from '../../../superbase.service';

export type EstatusMaquinaria = 'Activo' | 'Mantenimiento' | 'Inactivo' | 'Dado de Baja';

export interface Maquinaria {
    id?: number;
    eco: string;
    equipo: string;
    año: number | null;
    modelo: string | null;
    no_serie: string | null;
    ubicacion: string | null;
    obra: string | null;
    operador_id: number | null;
    responsable_id: number | null;
    estatus: EstatusMaquinaria;
    precio_hrs: number | null;
    operador_nombre?: string;
    responsable_nombre?: string;
    created_at?: string;
    updated_at?: string;
}

// Helper para normalizar el resultado de la vista fetch_maquinaria
const transformMaquinariaData = (data: any): Maquinaria => ({
    id: data.id,
    eco: data.eco,
    equipo: data.equipo,
    año: data.año,
    modelo: data.modelo,
    no_serie: data.no_serie,
    ubicacion: data.ubicacion,
    obra: data.obra,
    operador_id: data.operador_id,
    responsable_id: data.responsable_id,
    estatus: data.estatus || 'Activo',
    precio_hrs: data.precio_hrs ?? null,
    operador_nombre: data.operador_nombre || '',
    responsable_nombre: data.responsable_nombre || '',
    created_at: data.created_at,
    updated_at: data.updated_at
});

// Resuelve operador_nombre/responsable_nombre a partir de la tabla operador.
// Se consulta la tabla base "maquinaria" en vez de la vista fetch_maquinaria para que
// cualquier columna nueva (como precio_hrs) se refleje de inmediato sin depender de
// que la vista en Supabase también se actualice.
const resolverNombresOperadores = async (maquinarias: any[]): Promise<any[]> => {
    const ids = Array.from(new Set([
        ...maquinarias.map(m => m.operador_id),
        ...maquinarias.map(m => m.responsable_id)
    ].filter(Boolean)));

    if (ids.length === 0) return maquinarias;

    const { data: operadoresData, error } = await supabase
        .from('operador')
        .select('id, nombre')
        .in('id', ids as any[]);

    if (error) {
        console.error('Error al obtener operadores para maquinaria:', error);
        return maquinarias;
    }

    const nombresMap = new Map<number, string>((operadoresData || []).map((o: any) => [o.id, o.nombre]));
    return maquinarias.map(m => ({
        ...m,
        operador_nombre: m.operador_id ? nombresMap.get(m.operador_id) : '',
        responsable_nombre: m.responsable_id ? nombresMap.get(m.responsable_id) : ''
    }));
};

// Obtener todas las maquinarias (incluye nombre de operador/responsable)
export const fetchMaquinarias = async (): Promise<Maquinaria[]> => {
    const { data, error } = await supabase
        .from('maquinaria')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error al obtener maquinaria:', error);
        throw new Error(error.message);
    }
    const conNombres = await resolverNombresOperadores(data || []);
    return conNombres.map(transformMaquinariaData);
};

// Obtener una maquinaria por ID
export const fetchMaquinariaById = async (id: number): Promise<Maquinaria | null> => {
    const { data, error } = await supabase
        .from('maquinaria')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error al obtener maquinaria:', error);
        return null;
    }
    const [conNombre] = await resolverNombresOperadores([data]);
    return transformMaquinariaData(conNombre);
};

// Operadores disponibles para vincular como Operador o Responsable
export const fetchOperadoresParaMaquinaria = async (): Promise<{ id: number; nombre: string }[]> => {
    const { data, error } = await supabase
        .from('operador')
        .select('id, nombre')
        .order('nombre', { ascending: true });

    if (error) {
        console.error('Error al obtener operadores:', error);
        throw new Error(error.message);
    }
    return data || [];
};

// Quita del payload las columnas que solo existen en la vista fetch_maquinaria
// (operador_nombre/responsable_nombre), ya que la tabla base "maquinaria" no las tiene.
const toMaquinariaRow = (maquinaria: Partial<Maquinaria>) => {
    const { id, created_at, updated_at, operador_nombre, responsable_nombre, ...row } = maquinaria;
    return row;
};

// Crear nueva maquinaria
export const createMaquinaria = async (maquinaria: Omit<Maquinaria, 'id' | 'created_at' | 'updated_at' | 'operador_nombre' | 'responsable_nombre'>): Promise<Maquinaria> => {
    const { data, error } = await supabase
        .from('maquinaria')
        .insert([toMaquinariaRow(maquinaria)])
        .select()
        .single();

    if (error) {
        console.error('Error al crear maquinaria:', error);
        throw new Error(error.message);
    }
    return transformMaquinariaData(data);
};

// Actualizar maquinaria
export const updateMaquinaria = async (id: number, maquinaria: Partial<Maquinaria>): Promise<Maquinaria> => {
    const { data, error } = await supabase
        .from('maquinaria')
        .update(toMaquinariaRow(maquinaria))
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error al actualizar maquinaria:', error);
        throw new Error(error.message);
    }
    return transformMaquinariaData(data);
};

// Eliminar maquinaria
export const deleteMaquinaria = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('maquinaria')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error al eliminar maquinaria:', error);
        throw new Error(error.message);
    }
};
