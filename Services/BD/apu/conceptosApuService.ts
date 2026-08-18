import { supabase } from '../../superbase.service';

export interface ConceptoApu {
    id?: number;
    clave: string;
    descripcion: string;
    unidad: string;
    id_categoria?: number | null;
    categoria_nombre?: string;
    categoria_grupo?: string;
    tiene_tarjeta?: boolean;
    status?: boolean;
}

const transformConceptoApuData = (data: any): ConceptoApu => ({
    id: data.id,
    clave: data.clave,
    descripcion: data.descripcion,
    unidad: data.unidad,
    id_categoria: data.id_categoria ?? null,
    categoria_nombre: data.categoria_nombre ?? '',
    categoria_grupo: data.categoria_grupo ?? '',
    tiene_tarjeta: data.tiene_tarjeta ?? false,
    status: data.status ?? true,
});

export const fetchConceptosApu = async (): Promise<ConceptoApu[]> => {
    const { data, error } = await supabase
        .from('fetch_apu_conceptos')
        .select('*')
        .order('clave');

    if (error) {
        console.error('Error fetching Catálogo de Conceptos APU:', error);
        throw error;
    }

    return data?.map(transformConceptoApuData) || [];
};

export const fetchConceptosApuActivos = async (): Promise<ConceptoApu[]> => {
    const { data, error } = await supabase
        .from('fetch_apu_conceptos')
        .select('*')
        .eq('status', true)
        .order('clave');

    if (error) {
        console.error('Error fetching Conceptos APU activos:', error);
        throw error;
    }

    return data?.map(transformConceptoApuData) || [];
};

export const createConceptoApu = async (concepto: Omit<ConceptoApu, 'id'>): Promise<ConceptoApu> => {
    const { data, error } = await supabase
        .from('apu_conceptos')
        .insert([{
            clave: concepto.clave,
            descripcion: concepto.descripcion,
            unidad: concepto.unidad,
            id_categoria: concepto.id_categoria ?? null,
            status: concepto.status ?? true
        }])
        .select('*')
        .single();

    if (error) {
        console.error('Error creating Concepto APU:', error);
        throw error;
    }

    return transformConceptoApuData(data);
};

export const updateConceptoApu = async (concepto: ConceptoApu): Promise<ConceptoApu> => {
    const { data, error } = await supabase
        .from('apu_conceptos')
        .update({
            clave: concepto.clave,
            descripcion: concepto.descripcion,
            unidad: concepto.unidad,
            id_categoria: concepto.id_categoria ?? null,
            status: concepto.status ?? true
        })
        .eq('id', concepto.id)
        .select('*')
        .single();

    if (error) {
        console.error('Error updating Concepto APU:', error);
        throw error;
    }

    return transformConceptoApuData(data);
};

export const deleteConceptoApu = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('apu_conceptos')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting Concepto APU:', error);
        throw error;
    }
};
