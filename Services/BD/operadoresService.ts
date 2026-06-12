import { supabase } from '../superbase.service';

export interface Operador {
    id?: number;
    nombre: string;
    puesto: string;
    salario_base: number;
    fecha_contratacion?: string;
    estatus: boolean;
    telefono?: string;
    direccion?: string;
    descripcion?: string;
    created_at?: string;
}

export const fetchOperadores = async (): Promise<Operador[]> => {
    const { data, error } = await supabase
        .from('operador')
        .select('*')
        .order('nombre', { ascending: true });

    if (error) throw error;
    return data || [];
};

export const fetchOperadoresActivos = async (): Promise<Operador[]> => {
    const { data, error } = await supabase
        .from('operador')
        .select('*')
        .eq('estatus', true)
        .order('nombre', { ascending: true });

    if (error) throw error;
    return data || [];
};

export const createOperador = async (operador: Omit<Operador, 'id'>): Promise<Operador> => {
    const { data, error } = await supabase
        .from('operador')
        .insert([{
            ...operador,
            created_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateOperador = async (operador: Operador): Promise<Operador> => {
    const { data, error } = await supabase
        .from('operador')
        .update(operador)
        .eq('id', operador.id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteOperador = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('operador')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const toggleEstatusOperador = async (id: number, estatus: boolean): Promise<boolean> => {
    const { error } = await supabase
        .from('operador')
        .update({ estatus: !estatus })
        .eq('id', id);

    if (error) throw error;
    return !estatus;
};