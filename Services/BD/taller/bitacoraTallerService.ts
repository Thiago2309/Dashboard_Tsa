import { supabase } from '../../superbase.service';

export type TipoEquipoBitacora = 'camion' | 'maquinaria';
export type EstatusBitacora = 'Abierta' | 'En Proceso' | 'Resuelta';

export interface BitacoraTaller {
    id?: number;
    tipo_equipo: TipoEquipoBitacora;
    camion_id: number | null;
    maquinaria_id: number | null;
    fecha_reporte?: string;
    reportado_por: string | null;
    tecnico_asignado: string | null;
    es_taller_externo: boolean;
    costo_mano_obra: number;
    motivo: string | null;
    estatus_refaccion: string | null;
    observaciones: string | null;
    estatus_bitacora: EstatusBitacora;
    fecha_resuelto?: string | null;
    camion_nombre?: string;
    camion_placa?: string;
    maquinaria_eco?: string;
    maquinaria_equipo?: string;
    created_at?: string;
    updated_at?: string;
}

// Quita del payload las columnas que solo existen en la vista fetch_bitacora_taller
const toBitacoraRow = (b: Partial<BitacoraTaller>) => {
    const { id, created_at, updated_at, camion_nombre, camion_placa, maquinaria_eco, maquinaria_equipo, ...row } = b;
    return row;
};

// Todas las bitácoras (camiones y maquinaria), con datos del equipo ya unidos
export const fetchBitacoras = async (): Promise<BitacoraTaller[]> => {
    const { data, error } = await supabase
        .from('fetch_bitacora_taller')
        .select('*');

    if (error) {
        console.error('Error al obtener bitácoras:', error);
        throw new Error(error.message);
    }
    return data || [];
};

// Historial de bitácoras de un equipo específico (para el detalle visual)
export const fetchBitacorasPorEquipo = async (tipo: TipoEquipoBitacora, equipoId: number): Promise<BitacoraTaller[]> => {
    const campo = tipo === 'camion' ? 'camion_id' : 'maquinaria_id';
    const { data, error } = await supabase
        .from('fetch_bitacora_taller')
        .select('*')
        .eq(campo, equipoId);

    if (error) {
        console.error('Error al obtener bitácoras del equipo:', error);
        throw new Error(error.message);
    }
    return data || [];
};

// Se llama automáticamente cuando un camión/maquinaria pasa a estatus "Mantenimiento".
// Si ya existe una bitácora abierta para ese equipo, no duplica.
export const crearBitacoraPorMantenimiento = async (
    tipo: TipoEquipoBitacora,
    equipoId: number,
    reportadoPor: string | null
): Promise<BitacoraTaller> => {
    const campo = tipo === 'camion' ? 'camion_id' : 'maquinaria_id';

    const { data: abiertas, error: errorBusqueda } = await supabase
        .from('bitacora_taller')
        .select('*')
        .eq(campo, equipoId)
        .eq('estatus_bitacora', 'Abierta')
        .limit(1);

    if (errorBusqueda) {
        console.error('Error al buscar bitácora abierta:', errorBusqueda);
        throw new Error(errorBusqueda.message);
    }

    if (abiertas && abiertas.length > 0) {
        return abiertas[0];
    }

    const { data, error } = await supabase
        .from('bitacora_taller')
        .insert([{
            tipo_equipo: tipo,
            camion_id: tipo === 'camion' ? equipoId : null,
            maquinaria_id: tipo === 'maquinaria' ? equipoId : null,
            reportado_por: reportadoPor,
            estatus_bitacora: 'Abierta'
        }])
        .select()
        .single();

    if (error) {
        console.error('Error al crear bitácora de mantenimiento:', error);
        throw new Error(error.message);
    }
    return data;
};

// Actualizar el detalle de una bitácora (motivo, estatus de refacción, observaciones, etc.)
export const updateBitacora = async (id: number, bitacora: Partial<BitacoraTaller>): Promise<BitacoraTaller> => {
    const { data, error } = await supabase
        .from('bitacora_taller')
        .update(toBitacoraRow(bitacora))
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error al actualizar bitácora:', error);
        throw new Error(error.message);
    }
    return data;
};

// Marca la bitácora como Resuelta y regresa el equipo a estatus "Activo"
export const resolverBitacora = async (bitacora: BitacoraTaller): Promise<void> => {
    const { error } = await supabase
        .from('bitacora_taller')
        .update({ estatus_bitacora: 'Resuelta', fecha_resuelto: new Date().toISOString() })
        .eq('id', bitacora.id);

    if (error) {
        console.error('Error al resolver bitácora:', error);
        throw new Error(error.message);
    }

    if (bitacora.tipo_equipo === 'camion' && bitacora.camion_id) {
        const { error: errorCamion } = await supabase.from('m3').update({ estatus: 'Activo' }).eq('id', bitacora.camion_id);
        if (errorCamion) console.error('Error al reactivar camión:', errorCamion);
    } else if (bitacora.tipo_equipo === 'maquinaria' && bitacora.maquinaria_id) {
        const { error: errorMaquinaria } = await supabase.from('maquinaria').update({ estatus: 'Activo' }).eq('id', bitacora.maquinaria_id);
        if (errorMaquinaria) console.error('Error al reactivar maquinaria:', errorMaquinaria);
    }
};

export const deleteBitacora = async (id: number): Promise<void> => {
    const { error } = await supabase.from('bitacora_taller').delete().eq('id', id);
    if (error) {
        console.error('Error al eliminar bitácora:', error);
        throw new Error(error.message);
    }
};
