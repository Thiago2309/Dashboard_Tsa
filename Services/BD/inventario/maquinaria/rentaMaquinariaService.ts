import { supabase } from '../../../superbase.service';

export interface RentaMaquinaria {
    id?: number;
    estimacion: string | null;
    fecha: string;
    folio: string | null;
    id_cliente: number | null;
    id_invitado: number | null;
    obra: string | null;
    id_maquina: number | null;
    maquina_manual: string | null; // nombre de la máquina cuando es de un invitado (no está en el catálogo)
    id_operador: number | null;
    operador_manual: string | null; // nombre del operador cuando es de un invitado (no está en el catálogo)
    hrs: number | null;
    precio: number | null; // precio por hora al CLIENTE (alimenta su CxC)
    total: number | null; // total a cobrar al CLIENTE
    precio_invitado: number | null; // precio por hora que se le PAGA al invitado (alimenta su CxP)
    total_invitado: number | null; // total a pagar al invitado
    observaciones: string | null;
    cliente_nombre?: string;
    invitado_nombre?: string;
    maquina_nombre?: string; // catálogo o maquina_manual, lo que aplique (viene resuelto de la vista)
    operador_nombre?: string;
    created_at?: string;
    updated_at?: string;
}

// Helper para normalizar el resultado de la vista fetch_renta_maquinaria
const transformRentaMaquinariaData = (data: any): RentaMaquinaria => ({
    id: data.id,
    estimacion: data.estimacion,
    fecha: data.fecha,
    folio: data.folio,
    id_cliente: data.id_cliente,
    id_invitado: data.id_invitado,
    obra: data.obra,
    id_maquina: data.id_maquina,
    maquina_manual: data.maquina_manual,
    id_operador: data.id_operador,
    operador_manual: data.operador_manual,
    hrs: data.hrs,
    precio: data.precio,
    total: data.total,
    precio_invitado: data.precio_invitado,
    total_invitado: data.total_invitado,
    observaciones: data.observaciones,
    cliente_nombre: data.cliente_nombre || '',
    invitado_nombre: data.invitado_nombre || '',
    maquina_nombre: data.maquina_nombre || '',
    operador_nombre: data.operador_nombre || '',
    created_at: data.created_at,
    updated_at: data.updated_at
});

// Obtener todos los registros de renta de maquinaria (incluye nombres via vista)
export const fetchRentaMaquinaria = async (): Promise<RentaMaquinaria[]> => {
    const { data, error } = await supabase
        .from('fetch_renta_maquinaria')
        .select('*')
        .order('fecha', { ascending: false });

    if (error) {
        console.error('Error al obtener renta de maquinaria:', error);
        throw new Error(error.message);
    }
    return (data || []).map(transformRentaMaquinariaData);
};

// Quita del payload las columnas que solo existen en la vista fetch_renta_maquinaria
const toRentaMaquinariaRow = (renta: Partial<RentaMaquinaria>) => {
    const { id, cliente_nombre, invitado_nombre, maquina_nombre, operador_nombre, created_at, updated_at, ...row } = renta;
    return row;
};

// Crear nueva renta de maquinaria
export const createRentaMaquinaria = async (
    renta: Omit<RentaMaquinaria, 'id' | 'created_at' | 'updated_at' | 'cliente_nombre' | 'invitado_nombre' | 'maquina_nombre' | 'operador_nombre'>
): Promise<RentaMaquinaria> => {
    const { data, error } = await supabase
        .from('renta_maquinaria')
        .insert([toRentaMaquinariaRow(renta)])
        .select()
        .single();

    if (error) {
        console.error('Error al crear renta de maquinaria:', error);
        throw new Error(error.message);
    }
    return transformRentaMaquinariaData(data);
};

// Actualizar renta de maquinaria
export const updateRentaMaquinaria = async (id: number, renta: Partial<RentaMaquinaria>): Promise<RentaMaquinaria> => {
    const { data, error } = await supabase
        .from('renta_maquinaria')
        .update(toRentaMaquinariaRow(renta))
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error al actualizar renta de maquinaria:', error);
        throw new Error(error.message);
    }
    return transformRentaMaquinariaData(data);
};

// Obtener las rentas de maquinaria de un cliente específico (para CxC)
export const fetchRentaMaquinariaPorCliente = async (id_cliente: number): Promise<RentaMaquinaria[]> => {
    const { data, error } = await supabase
        .from('fetch_renta_maquinaria')
        .select('*')
        .eq('id_cliente', id_cliente)
        .order('fecha', { ascending: false });

    if (error) {
        console.error('Error al obtener renta de maquinaria del cliente:', error);
        throw new Error(error.message);
    }
    return (data || []).map(transformRentaMaquinariaData);
};

// Obtener las rentas de maquinaria de un invitado específico (para CxP)
export const fetchRentaMaquinariaPorInvitado = async (id_invitado: number): Promise<RentaMaquinaria[]> => {
    const { data, error } = await supabase
        .from('fetch_renta_maquinaria')
        .select('*')
        .eq('id_invitado', id_invitado)
        .order('fecha', { ascending: false });

    if (error) {
        console.error('Error al obtener renta de maquinaria del invitado:', error);
        throw new Error(error.message);
    }
    return (data || []).map(transformRentaMaquinariaData);
};

// Eliminar renta de maquinaria
export const deleteRentaMaquinaria = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('renta_maquinaria')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error al eliminar renta de maquinaria:', error);
        throw new Error(error.message);
    }
};
