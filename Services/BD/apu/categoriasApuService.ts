import { supabase } from '../../superbase.service';

export interface CategoriaApu {
    id?: number;
    nombre: string;
    grupo: string;
    status?: boolean;
}

const transformCategoriaApuData = (data: any): CategoriaApu => ({
    id: data.id,
    nombre: data.nombre,
    grupo: data.grupo,
    status: data.status ?? true,
});

export const fetchCategoriasApu = async (): Promise<CategoriaApu[]> => {
    const { data, error } = await supabase
        .from('apu_categorias')
        .select('*')
        .order('grupo')
        .order('nombre');

    if (error) {
        console.error('Error fetching Categorias APU:', error);
        throw error;
    }

    return data?.map(transformCategoriaApuData) || [];
};

export const fetchCategoriasApuActivas = async (): Promise<CategoriaApu[]> => {
    const { data, error } = await supabase
        .from('apu_categorias')
        .select('*')
        .eq('status', true)
        .order('grupo')
        .order('nombre');

    if (error) {
        console.error('Error fetching Categorias APU activas:', error);
        throw error;
    }

    return data?.map(transformCategoriaApuData) || [];
};

export const createCategoriaApu = async (categoria: Omit<CategoriaApu, 'id'>): Promise<CategoriaApu> => {
    const { data, error } = await supabase
        .from('apu_categorias')
        .insert([{
            nombre: categoria.nombre,
            grupo: categoria.grupo,
            status: categoria.status ?? true
        }])
        .select('*')
        .single();

    if (error) {
        console.error('Error creating Categoria APU:', error);
        throw error;
    }

    return transformCategoriaApuData(data);
};

export const updateCategoriaApu = async (categoria: CategoriaApu): Promise<CategoriaApu> => {
    const { data, error } = await supabase
        .from('apu_categorias')
        .update({
            nombre: categoria.nombre,
            grupo: categoria.grupo,
            status: categoria.status ?? true
        })
        .eq('id', categoria.id)
        .select('*')
        .single();

    if (error) {
        console.error('Error updating Categoria APU:', error);
        throw error;
    }

    return transformCategoriaApuData(data);
};

export const deleteCategoriaApu = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('apu_categorias')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting Categoria APU:', error);
        throw error;
    }
};
