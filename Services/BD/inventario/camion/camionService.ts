import { supabase } from '../../../superbase.service';

export interface Camion {
    id?: number;
    nombre: string;
    placa: string;
    tipo: 'Camión' | 'Tractor' | 'Remolque' | 'Otro';
    marca: string | null;
    modelo: string | null;
    año: number | null;
    serie: string | null;
    metros_cubicos: number | null;
    numero_motor: string | null;
    numero_cilindros: number | null;
    color: string | null;
    estatus: 'Activo' | 'Mantenimiento' | 'Inactivo' | 'Dado de Baja';
    fecha_registro?: string;
    ultimo_servicio: string | null;
    kilometraje_actual: number | null;
    observaciones: string | null;
    created_at?: string;
    updated_at?: string;
}

// Obtener todos los camiones
export const fetchCamiones = async (): Promise<Camion[]> => {
    const { data, error } = await supabase
        .from('m3')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error al obtener camiones:', error);
        throw new Error(error.message);
    }
    return data || [];
};

// Obtener camiones activos
export const fetchCamionesActivos = async (): Promise<Camion[]> => {
    const { data, error } = await supabase
        .from('m3')
        .select('*')
        // .eq('estatus', 'Activo')
        .order('nombre', { ascending: true });

    if (error) {
        console.error('Error al obtener camiones activos:', error);
        throw new Error(error.message);
    }
    return data || [];
};

// Obtener un camión por ID
export const fetchCamionById = async (id: number): Promise<Camion | null> => {
    const { data, error } = await supabase
        .from('m3')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error al obtener camión:', error);
        return null;
    }
    return data;
};

// Crear nuevo camión
export const createCamion = async (camion: Omit<Camion, 'id' | 'created_at' | 'updated_at'>): Promise<Camion> => {
    const { data, error } = await supabase
        .from('m3')
        .insert([camion])
        .select()
        .single();

    if (error) {
        console.error('Error al crear camión:', error);
        throw new Error(error.message);
    }
    return data;
};

// Actualizar camión
export const updateCamion = async (id: number, camion: Partial<Camion>): Promise<Camion> => {
    const { data, error } = await supabase
        .from('m3')
        .update(camion)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error al actualizar camión:', error);
        throw new Error(error.message);
    }
    return data;
};

// Eliminar camión
export const deleteCamion = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('m3')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error al eliminar camión:', error);
        throw new Error(error.message);
    }
};