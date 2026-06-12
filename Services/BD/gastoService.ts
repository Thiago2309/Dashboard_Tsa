import { supabase } from '../superbase.service';
import { CajaChica, createCajaChica } from './cajaChicaService';

export interface Gasto {
    id?: number;
    id_viaje?: number | null;
    fecha: string;
    id_proveedor: number | null;
    refaccion: string;
    importe: number | null;
    viaje_folio?: string;
    proveedor_nombre?: string;
    descripcion: string;
}

// Helper function to transform Supabase response to Gasto interface
const transformGastoData = (data: any): Gasto => ({
    id: data.id,
    id_viaje: data.id_viaje,
    fecha: data.fecha,
    id_proveedor: data.id_proveedor,
    refaccion: data.refaccion,
    importe: data.importe,
    descripcion: data.descripcion,
    viaje_folio: data.viajes?.folio || '',
    proveedor_nombre: data.proveedores?.nombre || ''
});

export const fetchGastos = async (): Promise<Gasto[]> => {
    const { data, error } = await supabase
        .from('fetch_gastos')
        .select('*');

    if (error) {
        console.error('Error fetching gastos:', error);
        throw error;
    }

    return data || [];
};

export const createGasto = async (gasto: Omit<Gasto, 'id'>): Promise<Gasto> => {
    console.log("Datos enviados a Supabase:", gasto);

    // Primero creamos el gasto
    const { data, error } = await supabase
        .from('gastos')
        .insert([gasto])
        .select('*')
        .single();

    if (error) {
        console.error('Error creating gasto:', error);
        throw error;
    }

    const gastoCreado = transformGastoData(data);

    // Luego creamos el registro en caja chica
    try {
        const registroCajaChica: Omit<CajaChica, 'id'> = {
            fecha: gasto.fecha,
            descripcion: `GASTO - ${gasto.descripcion || 'Refacción'}`,
            ingreso: null,
            egreso: gasto.importe
        };

        await createCajaChica(registroCajaChica);
        console.log('Registro de caja chica creado automáticamente para gasto');
    } catch (error) {
        console.error('Error creando registro en caja chica para gasto:', error);
        // Puedes decidir si quieres lanzar el error o solo loggearlo
    }

    return gastoCreado;
};

export const updateGasto = async (gasto: Gasto): Promise<Gasto> => {
    // Primero obtenemos el gasto actual para comparar
    const { data: gastoActual, error: errorActual } = await supabase
        .from('gastos')
        .select('*')
        .eq('id', gasto.id)
        .single();

    if (errorActual) {
        console.error('Error fetching current gasto:', errorActual);
        throw errorActual;
    }

    // Actualizamos el gasto
    const { data, error } = await supabase
        .from('gastos')
        .update({
            id_viaje: gasto.id_viaje,
            fecha: gasto.fecha,
            id_proveedor: gasto.id_proveedor,
            refaccion: gasto.refaccion,
            importe: gasto.importe,
            descripcion: gasto.descripcion
        })
        .eq('id', gasto.id)
        .select('*')
        .single();

    if (error) {
        console.error('Error updating gasto:', error);
        throw error;
    }

    const gastoActualizado = transformGastoData(data);

    // Actualizamos el registro en caja chica
    try {
        // Buscamos el registro en caja chica relacionado con este gasto
        const descripcionBuscada = `GASTO - ${gastoActual.descripcion || 'Refacción'}`;
        
        const { data: registrosCajaChica, error: errorBusqueda } = await supabase
            .from('cajachica')
            .select('*')
            .eq('descripcion', descripcionBuscada)
            .eq('egreso', gastoActual.importe)
            .eq('fecha', gastoActual.fecha)
            .limit(1);

        if (errorBusqueda) {
            console.error('Error searching caja chica record:', errorBusqueda);
            throw errorBusqueda;
        }

        if (registrosCajaChica && registrosCajaChica.length > 0) {
            const registroCajaChica = registrosCajaChica[0];
            const nuevaDescripcion = `GASTO - ${gasto.descripcion || 'Refacción'}`;
            
            // Actualizamos el registro encontrado
            const { error: errorUpdateCaja } = await supabase
                .from('cajachica')
                .update({
                    fecha: gasto.fecha,
                    descripcion: nuevaDescripcion,
                    egreso: gasto.importe
                })
                .eq('id', registroCajaChica.id);

            if (errorUpdateCaja) {
                console.error('Error updating caja chica:', errorUpdateCaja);
                throw errorUpdateCaja;
            }

            console.log('Registro de caja chica actualizado automáticamente para gasto');
        } else {
            console.warn('No se encontró registro en caja chica para actualizar');
            
            // Crear un nuevo registro si no se encuentra
            const nuevoRegistroCajaChica: Omit<CajaChica, 'id'> = {
                fecha: gasto.fecha,
                descripcion: `GASTO - ${gasto.descripcion || 'Refacción'}`,
                ingreso: null,
                egreso: gasto.importe
            };

            await createCajaChica(nuevoRegistroCajaChica);
            console.log('Nuevo registro de caja chica creado para gasto');
        }
    } catch (error) {
        console.error('Error actualizando registro en caja chica para gasto:', error);
        // Puedes decidir si quieres lanzar el error o solo loggearlo
    }

    return gastoActualizado;
};

export const deleteGasto = async (id: number): Promise<void> => {
    // Primero obtenemos el gasto para buscar en caja chica
    const { data: gasto, error: errorGasto } = await supabase
        .from('gastos')
        .select('*')
        .eq('id', id)
        .single();

    if (errorGasto) {
        console.error('Error fetching gasto:', errorGasto);
        throw errorGasto;
    }

    // Eliminamos el gasto
    const { error } = await supabase
        .from('gastos')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting gasto:', error);
        throw error;
    }

    // Eliminamos el registro correspondiente en caja chica
    try {
        const descripcionBuscada = `GASTO - ${gasto.descripcion || 'Refacción'}`;
        
        const { error: errorDeleteCaja } = await supabase
            .from('cajachica')
            .delete()
            .eq('descripcion', descripcionBuscada)
            .eq('egreso', gasto.importe)
            .eq('fecha', gasto.fecha);

        if (errorDeleteCaja) {
            console.error('Error deleting caja chica record:', errorDeleteCaja);
            // No lanzamos error para no afectar la eliminación del gasto
        } else {
            console.log('Registro de caja chica eliminado automáticamente para gasto');
        }
    } catch (error) {
        console.error('Error eliminando registro en caja chica para gasto:', error);
    }
};

// New helper functions to fetch dropdown options
export const fetchViajes = async (): Promise<{ id: number; folio: string }[]> => {
    const { data, error } = await supabase.from('viajes').select('id, folio');
    if (error) throw error;
    return data || [];
};

export const fetchProveedores = async (): Promise<{ id: number; nombre: string }[]> => {
    const { data, error } = await supabase.from('proveedor').select('id, nombre');
    if (error) throw error;
    return data || [];
};