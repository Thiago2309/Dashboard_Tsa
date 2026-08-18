import { supabase } from '../../superbase.service';

export type TipoInsumoApu = 'MATERIAL' | 'MANO_OBRA' | 'MAQUINARIA' | 'HERRAMIENTA';

export interface InsumoApu {
    id?: number;
    clave: string;
    descripcion: string;
    tipo: TipoInsumoApu;
    unidad: string;
    precio_unitario: number;
    status?: boolean;
}

const transformInsumoApuData = (data: any): InsumoApu => ({
    id: data.id,
    clave: data.clave,
    descripcion: data.descripcion,
    tipo: data.tipo,
    unidad: data.unidad,
    precio_unitario: data.precio_unitario ?? 0,
    status: data.status ?? true,
});

// Trae todos los insumos (incluye los de tipo MAQUINARIA, generados desde el catálogo de Costo Horario de Maquinaria)
export const fetchInsumosApu = async (): Promise<InsumoApu[]> => {
    const { data, error } = await supabase
        .from('fetch_apu_insumos')
        .select('*')
        .order('tipo')
        .order('descripcion');

    if (error) {
        console.error('Error fetching Insumos APU:', error);
        throw error;
    }

    return data?.map(transformInsumoApuData) || [];
};

// Insumos capturables directamente en el catálogo (materiales y mano de obra); la maquinaria se gestiona desde su propio módulo
export const fetchInsumosApuCapturables = async (): Promise<InsumoApu[]> => {
    const { data, error } = await supabase
        .from('fetch_apu_insumos')
        .select('*')
        .in('tipo', ['MATERIAL', 'MANO_OBRA'])
        .order('tipo')
        .order('descripcion');

    if (error) {
        console.error('Error fetching Insumos APU capturables:', error);
        throw error;
    }

    return data?.map(transformInsumoApuData) || [];
};

export const fetchInsumosApuPorTipo = async (tipo: TipoInsumoApu): Promise<InsumoApu[]> => {
    const { data, error } = await supabase
        .from('fetch_apu_insumos')
        .select('*')
        .eq('tipo', tipo)
        .eq('status', true)
        .order('descripcion');

    if (error) {
        console.error('Error fetching Insumos APU por tipo:', error);
        throw error;
    }

    return data?.map(transformInsumoApuData) || [];
};

export const createInsumoApu = async (insumo: Omit<InsumoApu, 'id'>): Promise<InsumoApu> => {
    const { data, error } = await supabase
        .from('apu_insumos')
        .insert([{
            clave: insumo.clave,
            descripcion: insumo.descripcion,
            tipo: insumo.tipo,
            unidad: insumo.unidad,
            precio_unitario: insumo.precio_unitario ?? 0,
            status: insumo.status ?? true
        }])
        .select('*')
        .single();

    if (error) {
        console.error('Error creating Insumo APU:', error);
        throw error;
    }

    return transformInsumoApuData(data);
};

export const updateInsumoApu = async (insumo: InsumoApu): Promise<InsumoApu> => {
    const { data, error } = await supabase
        .from('apu_insumos')
        .update({
            clave: insumo.clave,
            descripcion: insumo.descripcion,
            tipo: insumo.tipo,
            unidad: insumo.unidad,
            precio_unitario: insumo.precio_unitario ?? 0,
            status: insumo.status ?? true
        })
        .eq('id', insumo.id)
        .select('*')
        .single();

    if (error) {
        console.error('Error updating Insumo APU:', error);
        throw error;
    }

    return transformInsumoApuData(data);
};

export const deleteInsumoApu = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('apu_insumos')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting Insumo APU:', error);
        throw error;
    }
};
