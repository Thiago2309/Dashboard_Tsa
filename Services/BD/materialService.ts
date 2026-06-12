import { supabase } from '../superbase.service';

export interface Material {
    id?: number;
    nombre: string;
    descripcion?: string;
    created_at?: string;
}

export const fetchMateriales = async (): Promise<Material[]> => {
    const { data, error } = await supabase
        .from('material')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error('Error al obtener los materiales');
    return data || [];
};

export const createMaterial = async (material: Omit<Material, 'id'>): Promise<Material> => {
    const materialToInsert = {
        nombre: material.nombre,
        descripcion: material.descripcion,
        created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('material').insert([materialToInsert]).select().single();

    if (error) throw new Error('Error al crear el material');
    return data;
};

export const updateMaterial = async (material: Material): Promise<Material> => {
    if (!material.id) throw new Error('Se requiere ID para actualizar el material');

    const materialToUpdate = {
        nombre: material.nombre,
        descripcion: material.descripcion,
    };

    const { data, error } = await supabase
        .from('material')
        .update(materialToUpdate)
        .eq('id', material.id)
        .select()
        .single();

    if (error) throw new Error('Error al actualizar el material');
    return data;
};

export const deleteMaterial = async (id: number): Promise<void> => {
    const { error } = await supabase.from('material').delete().eq('id', id);

    if (error) throw new Error('Error al eliminar el material');
};
