import { supabase } from '../superbase.service';

export interface OrigenDestino {
    id?: number; // Opcional para nuevos registros
    nombreorigen: string;
    nombredestino: string;
    precio_unidad: number;
    status?: boolean;
}

// Helper function to transform Supabase response to OrigenDestino interface
const transformOrigenDestinoData = (data: any): OrigenDestino => ({
    id: data.id,
    nombreorigen: data.nombreorigen,
    nombredestino: data.nombredestino,
    precio_unidad: data.precio_unidad,
    status: data.status ?? true,
});

// Obtener todos los registros de Origen Destino
export const fetchOrigenDestino = async (): Promise<OrigenDestino[]> => {
    const { data, error } = await supabase
        .from('fetch_origen_destino') // Nombre de la tabla
        .select('*')
        .order('status', { ascending: false })  // Mostrar activos primero
        .order('nombreorigen');

    if (error) {
        console.error('Error fetching Origen Destino:', error);
        throw error;
    }

    return data || [];
};

// Obtener solo los registros activos (status = true)
export const fetchOrigenDestinoActivos = async (): Promise<OrigenDestino[]> => {
    const { data, error } = await supabase
        .from('fetch_origen_destino')  // Usa la vista
        .select('*')
        .eq('status', true)  // Solo activos
        .order('nombreorigen');

    if (error) {
        console.error('Error fetching Origen Destino activos:', error);
        throw error;
    }

    return data?.map(transformOrigenDestinoData) || [];
};

// Crear un nuevo registro de Origen Destino
export const createOrigenDestino = async (origenDestino: Omit<OrigenDestino, 'id'>): Promise<OrigenDestino> => {
    const { data, error } = await supabase
        .from('fetch_origen_destino')  // Tabla base para INSERT
        .insert([{
            nombreorigen: origenDestino.nombreorigen,
            nombredestino: origenDestino.nombredestino,
            precio_unidad: origenDestino.precio_unidad,
            status: origenDestino.status ?? true  // Nuevo campo
        }])
        .select('*')
        .single();

    if (error) {
        console.error('Error creating Origen Destino:', error);
        throw error;
    }

    return transformOrigenDestinoData(data);
};

// Actualizar un registro de Origen Destino
export const updateOrigenDestino = async (origenDestino: OrigenDestino): Promise<OrigenDestino> => {
    const { data, error } = await supabase
        .from('fetch_origen_destino')
        .update({
            nombreorigen: origenDestino.nombreorigen,
            nombredestino: origenDestino.nombredestino,
            precio_unidad: origenDestino.precio_unidad,
            status: origenDestino.status ?? true 
        })
        .eq('id', origenDestino.id)
        .select('*')
        .single();

    if (error) {
        console.error('Error updating Origen Destino:', error);
        throw error;
    }

    return transformOrigenDestinoData(data);
};

// Alternar estado (status)
export const toggleStatusOrigenDestino = async (id: number, status: boolean): Promise<OrigenDestino> => {
    const { data, error } = await supabase
        .from('fetch_origen_destino')
        .update({ status })
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        console.error('Error toggling status:', error);
        throw error;
    }

    return transformOrigenDestinoData(data);
};

// Eliminar un registro de Origen Destino
export const deleteOrigenDestino = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('fetch_origen_destino')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting Origen Destino:', error);
        throw error;
    }
};