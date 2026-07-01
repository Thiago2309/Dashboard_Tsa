// Services/BD/Nomina/descuentosService.ts
import { supabase } from '../../superbase.service';

export interface Descuento {
    id?: number;
    id_operador: number;
    monto: number;
    tipo: 'infonavit' | 'fonacot' | 'viaticos' | 'prestamo' | 'otros';
    descripcion: string;
    fecha_inicio: string;
    fecha_fin?: string;
    activo: boolean;
    created_at?: string;
    updated_at?: string;

    // Campos relacionales
    operador_nombre?: string;
}

export const fetchDescuentos = async (): Promise<Descuento[]> => {
    const { data, error } = await supabase
        .from('descuentos')
        .select(
            `
      *,
      operador:id_operador(nombre)
    `
        )
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (
        data?.map((item) => ({
            ...item,
            operador_nombre: item.operador?.nombre
        })) || []
    );
};

export const fetchDescuentosActivos = async (): Promise<Descuento[]> => {
    const { data, error } = await supabase
        .from('descuentos')
        .select(
            `
      *,
      operador:id_operador(nombre)
    `
        )
        .eq('activo', true)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (
        data?.map((item) => ({
            ...item,
            operador_nombre: item.operador?.nombre
        })) || []
    );
};

export const fetchDescuentosByOperador = async (idOperador: number): Promise<Descuento[]> => {
    const { data, error } = await supabase
        .from('descuentos')
        .select(
            `
      *,
      operador:id_operador(nombre)
    `
        )
        .eq('id_operador', idOperador)
        .eq('activo', true)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (
        data?.map((item) => ({
            ...item,
            operador_nombre: item.operador?.nombre
        })) || []
    );
};

export const fetchDescuentoById = async (id: number): Promise<Descuento | null> => {
    const { data, error } = await supabase
        .from('descuentos')
        .select(
            `
      *,
      operador:id_operador(nombre)
    `
        )
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }

    return {
        ...data,
        operador_nombre: data.operador?.nombre
    };
};

export const createDescuento = async (descuento: Omit<Descuento, 'id' | 'created_at' | 'updated_at' | 'operador_nombre'>): Promise<Descuento> => {
    // Insertar sin esperar retorno del ID
    const { error } = await supabase.from('descuentos').insert([
        {
            ...descuento,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    ]);

    if (error) throw error;

    // Buscar el descuento recién creado por otros campos
    const { data, error: fetchError } = await supabase
        .from('descuentos')
        .select(
            `
      *,
      operador:id_operador(nombre)
    `
        )
        .eq('id_operador', descuento.id_operador)
        .eq('monto', descuento.monto)
        .eq('descripcion', descuento.descripcion)
        .eq('tipo', descuento.tipo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (fetchError) throw fetchError;

    return {
        ...data,
        operador_nombre: data.operador?.nombre
    };
};

export const updateDescuento = async (descuento: Descuento): Promise<Descuento> => {
    const { data, error } = await supabase
        .from('descuentos')
        .update({
            id_operador: descuento.id_operador,
            monto: descuento.monto,
            tipo: descuento.tipo,
            descripcion: descuento.descripcion,
            fecha_inicio: descuento.fecha_inicio,
            fecha_fin: descuento.fecha_fin,
            activo: descuento.activo,
            updated_at: new Date().toISOString()
        })
        .eq('id', descuento.id)
        .select(
            `
      *,
      operador:id_operador(nombre)
    `
        )
        .single();

    if (error) throw error;

    return {
        ...data,
        operador_nombre: data.operador?.nombre
    };
};

export const deleteDescuento = async (id: number): Promise<void> => {
    const { error } = await supabase.from('descuentos').delete().eq('id', id);

    if (error) throw error;
};
