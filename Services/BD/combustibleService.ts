import { supabase } from '../superbase.service';
import { CajaChica, createCajaChica } from './cajaChicaService';

export type TipoUnidadCombustible = 'camion' | 'maquinaria';

export interface Combustible {
    id?: number;
    fecha: string;
    tipo_equipo?: TipoUnidadCombustible | null;
    camion_id?: number | null;
    maquinaria_id?: number | null;
    id_operador: number | null;
    kilometraje?: number | null;
    horometro?: number | null;
    precio_unitario?: number | null;
    litros: number | null;
    importe: number | null;
    id_viaje?: number | null;
    viaje_folio?: string;
    operador_nombre?: string;
    camion_nombre?: string;
    camion_placa?: string;
    maquinaria_eco?: string;
    maquinaria_equipo?: string;
}

// Helper para normalizar la respuesta de Supabase (embeds anidados) al Combustible plano
const transformCombustibleData = (data: any): Combustible => ({
    id: data.id,
    fecha: data.fecha,
    tipo_equipo: data.tipo_equipo,
    camion_id: data.camion_id,
    maquinaria_id: data.maquinaria_id,
    id_operador: data.id_operador,
    kilometraje: data.kilometraje,
    horometro: data.horometro,
    precio_unitario: data.precio_unitario,
    litros: data.litros,
    importe: data.importe,
    id_viaje: data.id_viaje,
    viaje_folio: data.viajes?.folio || '',
    operador_nombre: data.operador?.nombre || '',
    camion_nombre: data.m3?.nombre || '',
    camion_placa: data.m3?.placa || '',
    maquinaria_eco: data.maquinaria?.eco || '',
    maquinaria_equipo: data.maquinaria?.equipo || ''
});

// Quita del payload las columnas que solo existen resueltas en el cliente (embeds)
const toCombustibleRow = (c: Partial<Combustible>) => {
    const { id, viaje_folio, operador_nombre, camion_nombre, camion_placa, maquinaria_eco, maquinaria_equipo, ...row } = c;
    return row;
};

export const fetchCombustible = async (): Promise<Combustible[]> => {
    const { data, error } = await supabase
        .from('combustible')
        .select('*, viajes(folio), operador(nombre), m3(nombre, placa), maquinaria(eco, equipo)')
        .order('fecha', { ascending: false });

    if (error) {
        console.error('Error fetching combustibles:', error);
        throw error;
    }

    return (data || []).map(transformCombustibleData);
};

export const createCombustible = async (combustible: Omit<Combustible, 'id' | 'viaje_folio' | 'operador_nombre' | 'camion_nombre' | 'camion_placa' | 'maquinaria_eco' | 'maquinaria_equipo'>): Promise<Combustible> => {
    const { data, error } = await supabase
        .from('combustible')
        .insert([toCombustibleRow(combustible)])
        .select('*')
        .single();

    if (error) {
        console.error('Error creating combustible:', error);
        throw error;
    }

    const combustibleCreado = transformCombustibleData(data);

    // Registro automático en caja chica (mismo comportamiento de siempre)
    try {
        const registroCajaChica: Omit<CajaChica, 'id'> = {
            fecha: combustible.fecha,
            descripcion: 'COMBUSTIBLE',
            ingreso: null,
            egreso: combustible.importe
        };
        await createCajaChica(registroCajaChica);
    } catch (error) {
        console.error('Error creando registro en caja chica:', error);
    }

    return combustibleCreado;
};

export const updateCombustible = async (combustible: Combustible): Promise<Combustible> => {
    const { data: combustibleActual, error: errorActual } = await supabase
        .from('combustible')
        .select('*')
        .eq('id', combustible.id)
        .single();

    if (errorActual) {
        console.error('Error fetching current combustible:', errorActual);
        throw errorActual;
    }

    const { data, error } = await supabase
        .from('combustible')
        .update(toCombustibleRow(combustible))
        .eq('id', combustible.id)
        .select('*')
        .single();

    if (error) {
        console.error('Error updating combustible:', error);
        throw error;
    }

    const combustibleActualizado = transformCombustibleData(data);

    // Mantiene sincronizado el registro de caja chica ligado a este combustible
    try {
        const { data: registrosCajaChica, error: errorBusqueda } = await supabase
            .from('cajachica')
            .select('*')
            .eq('descripcion', 'COMBUSTIBLE')
            .eq('egreso', combustibleActual.importe)
            .eq('fecha', combustibleActual.fecha)
            .limit(1);

        if (errorBusqueda) throw errorBusqueda;

        if (registrosCajaChica && registrosCajaChica.length > 0) {
            const { error: errorUpdateCaja } = await supabase
                .from('cajachica')
                .update({ fecha: combustible.fecha, egreso: combustible.importe })
                .eq('id', registrosCajaChica[0].id);

            if (errorUpdateCaja) throw errorUpdateCaja;
        } else {
            await createCajaChica({
                fecha: combustible.fecha,
                descripcion: 'COMBUSTIBLE',
                ingreso: null,
                egreso: combustible.importe
            });
        }
    } catch (error) {
        console.error('Error actualizando registro en caja chica:', error);
    }

    return combustibleActualizado;
};

export const deleteCombustible = async (id: number): Promise<void> => {
    const { data: combustible, error: errorCombustible } = await supabase
        .from('combustible')
        .select('*')
        .eq('id', id)
        .single();

    if (errorCombustible) {
        console.error('Error fetching combustible:', errorCombustible);
        throw errorCombustible;
    }

    const { error } = await supabase
        .from('combustible')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting combustible:', error);
        throw error;
    }

    try {
        const { error: errorDeleteCaja } = await supabase
            .from('cajachica')
            .delete()
            .eq('descripcion', 'COMBUSTIBLE')
            .eq('egreso', combustible.importe)
            .eq('fecha', combustible.fecha);

        if (errorDeleteCaja) console.error('Error deleting caja chica record:', errorDeleteCaja);
    } catch (error) {
        console.error('Error eliminando registro en caja chica para combustible:', error);
    }
};

export const fetchOperadores = async (): Promise<{ id: number; nombre: string }[]> => {
    const { data, error } = await supabase.from('operador').select('id, nombre');
    if (error) throw error;
    return data || [];
};
