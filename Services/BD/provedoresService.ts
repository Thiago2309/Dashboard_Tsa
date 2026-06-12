import { supabase } from '../superbase.service';

export interface Proveedor {
    id?: number;
    nombre: string;
    descripcion?: string;
    created_at?: string;
}

export const fetchProveedores = async (): Promise<Proveedor[]> => {
    const { data, error } = await supabase
        .from('proveedor')
        .select('*')
        .order('nombre', { ascending: true });

    if (error) throw error;
    return data || [];
};

export const createProveedor = async (proveedor: Omit<Proveedor, 'id'>): Promise<Proveedor> => {
    const { data, error } = await supabase
        .from('proveedor')
        .insert([{
            ...proveedor,
            created_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateProveedor = async (proveedor: Proveedor): Promise<Proveedor> => {
    const { data, error } = await supabase
        .from('proveedor')
        .update(proveedor)
        .eq('id', proveedor.id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteProveedor = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('proveedor')
        .delete()
        .eq('id', id);

    if (error) throw error;
};