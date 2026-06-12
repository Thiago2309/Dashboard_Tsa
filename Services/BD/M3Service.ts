import { supabase } from '../superbase.service';

export interface M3 {
    id?: number;
    nombre: string;
    metros_cubicos: number;
    descripcion?: string;
    status?: boolean;
    created_at?: string;
}

export const fetchM3List = async (): Promise<M3[]> => {
    const { data, error } = await supabase
        .from('m3')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error('Error al obtener los metros cúbicos');
    return data || [];
};

export const createM3 = async (m3: Omit<M3, 'id'>): Promise<M3> => {
    const m3ToInsert = {
        nombre: m3.nombre,
        metros_cubicos: m3.metros_cubicos,
        descripcion: m3.descripcion,
        status: m3.status !== undefined ? m3.status : true, 
        created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('m3').insert([m3ToInsert]).select().single();

    if (error) throw new Error('Error al crear el registro de metros cúbicos');
    return data;
};

export const updateM3 = async (m3: M3): Promise<M3> => {
    if (!m3.id) throw new Error('Se requiere ID para actualizar');

    const m3ToUpdate = {
        nombre: m3.nombre,
        metros_cubicos: m3.metros_cubicos,
        descripcion: m3.descripcion,
        status: m3.status !== undefined ? m3.status : true,
    };

    const { data, error } = await supabase
        .from('m3')
        .update(m3ToUpdate)
        .eq('id', m3.id)
        .select()
        .single();

    if (error) throw new Error('Error al actualizar el registro');
    return data;
};

export const deleteM3 = async (id: number): Promise<void> => {
    const { error } = await supabase.from('m3').delete().eq('id', id);

    if (error) throw new Error('Error al eliminar el registro');
};