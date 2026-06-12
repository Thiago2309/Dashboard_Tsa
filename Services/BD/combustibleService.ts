import { supabase } from '../superbase.service';
import { CajaChica, createCajaChica } from './cajaChicaService';

export interface Combustible {
    id?: number;
    id_viaje: number | null;
    fecha: string;
    id_operador: number | null;
    litros: number | null;
    importe: number | null;
    viaje_folio?: string;
    operador_nombre?: string;
}

// Helper function to transform Supabase response to Combustible interface
const transformCombustibleData = (data: any): Combustible => ({
    id: data.id,
    id_viaje: data.id_viaje,
    fecha: data.fecha,
    id_operador: data.id_operador,
    litros: data.litros,
    importe: data.importe,
    viaje_folio: data.viajes?.folio || '',
    operador_nombre: data.operadores?.nombre || ''
});

export const fetchCombustible = async (): Promise<Combustible[]> => {
    const { data, error } = await supabase
        .from('fetch_combustible')
        .select('*');

    if (error) {
        console.error('Error fetching combustibles:', error);
        throw error;
    }

    return data || [];
};

export const createCombustible = async (combustible: Omit<Combustible, 'id' | 'created_at' | 'viaje_folio' | 'operador_nombre'>): Promise<Combustible> => {
    console.log("Datos enviados a Supabase:", combustible);
    
    // Primero creamos el combustible
    const { data, error } = await supabase
        .from('combustible')
        .insert([combustible])
        .select('*')
        .single();

    if (error) {
        console.error('Error creating combustible:', error);
        throw error;
    }

    const combustibleCreado = transformCombustibleData(data);

    // Luego creamos el registro en caja chica
    try {
        const registroCajaChica: Omit<CajaChica, 'id'> = {
            fecha: combustible.fecha, // Usa la misma fecha del combustible
            descripcion: 'COMBUSTIBLE',
            ingreso: null,
            egreso: combustible.importe // El importe del combustible como egreso
        };

        await createCajaChica(registroCajaChica);
        console.log('Registro de caja chica creado automáticamente');
    } catch (error) {
        console.error('Error creando registro en caja chica:', error);
        // Puedes decidir si quieres lanzar el error o solo loggearlo
    }

    return combustibleCreado;
};

export const updateCombustible = async (combustible: Combustible): Promise<Combustible> => {
    // Primero obtenemos el combustible actual para comparar
    const { data: combustibleActual, error: errorActual } = await supabase
        .from('combustible')
        .select('*')
        .eq('id', combustible.id)
        .single();

    if (errorActual) {
        console.error('Error fetching current combustible:', errorActual);
        throw errorActual;
    }

    // Actualizamos el combustible
    const { data, error } = await supabase
        .from('combustible')
        .update({
            id_viaje: combustible.id_viaje,
            fecha: combustible.fecha,
            id_operador: combustible.id_operador,
            litros: combustible.litros,
            importe: combustible.importe
        })
        .eq('id', combustible.id)
        .select('*')
        .single();

    if (error) {
        console.error('Error updating combustible:', error);
        throw error;
    }

    const combustibleActualizado = transformCombustibleData(data);

    // Actualizamos el registro en caja chica
    try {
        // Buscamos el registro en caja chica relacionado con este combustible
        const { data: registrosCajaChica, error: errorBusqueda } = await supabase
            .from('cajachica')
            .select('*')
            .eq('descripcion', 'COMBUSTIBLE')
            .eq('egreso', combustibleActual.importe) // Buscamos por el importe original
            .eq('fecha', combustibleActual.fecha) // Y por la fecha original
            .limit(1);

        if (errorBusqueda) {
            console.error('Error searching caja chica record:', errorBusqueda);
            throw errorBusqueda;
        }

        if (registrosCajaChica && registrosCajaChica.length > 0) {
            const registroCajaChica = registrosCajaChica[0];
            
            // Actualizamos el registro encontrado
            const { error: errorUpdateCaja } = await supabase
                .from('cajachica')
                .update({
                    fecha: combustible.fecha,
                    egreso: combustible.importe
                    // La descripción se mantiene como 'COMBUSTIBLE'
                })
                .eq('id', registroCajaChica.id);

            if (errorUpdateCaja) {
                console.error('Error updating caja chica:', errorUpdateCaja);
                throw errorUpdateCaja;
            }

            console.log('Registro de caja chica actualizado automáticamente');
        } else {
            console.warn('No se encontró registro en caja chica para actualizar');
            
            // Opcional: Crear un nuevo registro si no se encuentra
            const nuevoRegistroCajaChica: Omit<CajaChica, 'id'> = {
                fecha: combustible.fecha,
                descripcion: 'COMBUSTIBLE',
                ingreso: null,
                egreso: combustible.importe
            };

            await createCajaChica(nuevoRegistroCajaChica);
            console.log('Nuevo registro de caja chica creado');
        }
    } catch (error) {
        console.error('Error actualizando registro en caja chica:', error);
        // Puedes decidir si quieres lanzar el error o solo loggearlo
    }

    return combustibleActualizado;
};

export const deleteCombustible = async (id: number): Promise<void> => {
    // Primero obtenemos el combustible para buscar en caja chica
    const { data: combustible, error: errorCombustible } = await supabase
        .from('combustible')
        .select('*')
        .eq('id', id)
        .single();

    if (errorCombustible) {
        console.error('Error fetching combustible:', errorCombustible);
        throw errorCombustible;
    }

    // Eliminamos el combustible
    const { error } = await supabase
        .from('combustible')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting combustible:', error);
        throw error;
    }

    // Eliminamos el registro correspondiente en caja chica
    try {
        const { error: errorDeleteCaja } = await supabase
            .from('cajachica')
            .delete()
            .eq('descripcion', 'COMBUSTIBLE')
            .eq('egreso', combustible.importe)
            .eq('fecha', combustible.fecha);

        if (errorDeleteCaja) {
            console.error('Error deleting caja chica record:', errorDeleteCaja);
            // No lanzamos error para no afectar la eliminación del combustible
        } else {
            console.log('Registro de caja chica eliminado automáticamente para combustible');
        }
    } catch (error) {
        console.error('Error eliminando registro en caja chica para combustible:', error);
    }
};

// New helper functions to fetch dropdown options
export const fetchViajes = async (): Promise<{ id: number; folio: string }[]> => {
    const { data, error } = await supabase.from('viajes').select('id, folio');
    if (error) throw error;
    return data || [];
};

export const fetchOperadores = async (): Promise<{ id: number; nombre: string }[]> => {
    const { data, error } = await supabase.from('operador').select('id, nombre');
    if (error) throw error;
    return data || [];
};