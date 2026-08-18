import { supabase } from '../../superbase.service';
import { TipoInsumoApu } from './insumosApuService';

export interface TarjetaInsumoApu {
    id?: number;
    id_tarjeta?: number;
    id_insumo: number;
    tipo: TipoInsumoApu;
    insumo_clave?: string;
    insumo_descripcion?: string;
    insumo_unidad?: string;
    cantidad: number;
    precio_unitario: number;
    importe?: number;
}

export interface TarjetaApu {
    id?: number;
    id_concepto: number;
    concepto_clave?: string;
    concepto_descripcion?: string;
    concepto_unidad?: string;
    categoria_nombre?: string;
    rendimiento: number;
    jornada_horas: number;
    pct_herramienta: number;
    pct_indirectos: number;
    pct_financiamiento: number;
    pct_utilidad: number;
    pct_cargos_adicionales: number;
    costo_materiales?: number;
    costo_mano_obra?: number;
    costo_maquinaria?: number;
    costo_herramienta?: number;
    costo_directo?: number;
    pct_material?: number;
    pct_mano_obra?: number;
    pct_maquinaria?: number;
    monto_indirectos?: number;
    monto_financiamiento?: number;
    monto_utilidad?: number;
    monto_cargos_adicionales?: number;
    precio_unitario?: number;
    notas?: string;
    status?: boolean;
    insumos?: TarjetaInsumoApu[];
}

export interface TotalesTarjetaApu {
    costo_materiales: number;
    costo_mano_obra: number;
    costo_maquinaria: number;
    costo_herramienta: number;
    costo_directo: number;
    pct_material: number;
    pct_mano_obra: number;
    pct_maquinaria: number;
    monto_indirectos: number;
    monto_financiamiento: number;
    monto_utilidad: number;
    monto_cargos_adicionales: number;
    precio_unitario: number;
}

// Cantidad sugerida (horas-hombre u horas-máquina por unidad de concepto) a partir del rendimiento capturado
export const calcularCantidadSugerida = (jornada_horas: number, rendimiento: number): number => {
    if (!rendimiento || rendimiento <= 0) return 0;
    return jornada_horas / rendimiento;
};

// Calcula los totales de la tarjeta (costos directos, % material/mano de obra/maquinaria, indirectos/financiamiento/utilidad y precio unitario final)
export const calcularTotalesTarjeta = (
    insumos: TarjetaInsumoApu[],
    porcentajes: Pick<TarjetaApu, 'pct_herramienta' | 'pct_indirectos' | 'pct_financiamiento' | 'pct_utilidad' | 'pct_cargos_adicionales'>
): TotalesTarjetaApu => {
    const sumaPorTipo = (tipo: TipoInsumoApu) =>
        insumos.filter((i) => i.tipo === tipo).reduce((acc, i) => acc + (i.cantidad || 0) * (i.precio_unitario || 0), 0);

    const costo_materiales = sumaPorTipo('MATERIAL');
    const costo_mano_obra = sumaPorTipo('MANO_OBRA');
    const costo_maquinaria = sumaPorTipo('MAQUINARIA');
    const costo_herramienta = costo_mano_obra * ((porcentajes.pct_herramienta || 0) / 100);

    const costo_directo = costo_materiales + costo_mano_obra + costo_maquinaria + costo_herramienta;

    const pct_material = costo_directo > 0 ? (costo_materiales / costo_directo) * 100 : 0;
    const pct_mano_obra = costo_directo > 0 ? (costo_mano_obra / costo_directo) * 100 : 0;
    const pct_maquinaria = costo_directo > 0 ? (costo_maquinaria / costo_directo) * 100 : 0;

    const monto_indirectos = costo_directo * ((porcentajes.pct_indirectos || 0) / 100);
    const monto_financiamiento = costo_directo * ((porcentajes.pct_financiamiento || 0) / 100);
    const monto_utilidad = costo_directo * ((porcentajes.pct_utilidad || 0) / 100);
    const monto_cargos_adicionales = costo_directo * ((porcentajes.pct_cargos_adicionales || 0) / 100);

    const precio_unitario = costo_directo + monto_indirectos + monto_financiamiento + monto_utilidad + monto_cargos_adicionales;

    return {
        costo_materiales,
        costo_mano_obra,
        costo_maquinaria,
        costo_herramienta,
        costo_directo,
        pct_material,
        pct_mano_obra,
        pct_maquinaria,
        monto_indirectos,
        monto_financiamiento,
        monto_utilidad,
        monto_cargos_adicionales,
        precio_unitario
    };
};

const transformTarjetaApuData = (data: any): TarjetaApu => ({
    id: data.id,
    id_concepto: data.id_concepto,
    concepto_clave: data.concepto_clave ?? '',
    concepto_descripcion: data.concepto_descripcion ?? '',
    concepto_unidad: data.concepto_unidad ?? '',
    categoria_nombre: data.categoria_nombre ?? '',
    rendimiento: data.rendimiento ?? 1,
    jornada_horas: data.jornada_horas ?? 8,
    pct_herramienta: data.pct_herramienta ?? 0,
    pct_indirectos: data.pct_indirectos ?? 0,
    pct_financiamiento: data.pct_financiamiento ?? 0,
    pct_utilidad: data.pct_utilidad ?? 0,
    pct_cargos_adicionales: data.pct_cargos_adicionales ?? 0,
    costo_materiales: data.costo_materiales ?? 0,
    costo_mano_obra: data.costo_mano_obra ?? 0,
    costo_maquinaria: data.costo_maquinaria ?? 0,
    costo_herramienta: data.costo_herramienta ?? 0,
    costo_directo: data.costo_directo ?? 0,
    pct_material: data.pct_material ?? 0,
    pct_mano_obra: data.pct_mano_obra ?? 0,
    pct_maquinaria: data.pct_maquinaria ?? 0,
    monto_indirectos: data.monto_indirectos ?? 0,
    monto_financiamiento: data.monto_financiamiento ?? 0,
    monto_utilidad: data.monto_utilidad ?? 0,
    monto_cargos_adicionales: data.monto_cargos_adicionales ?? 0,
    precio_unitario: data.precio_unitario ?? 0,
    notas: data.notas ?? '',
    status: data.status ?? true,
});

const transformTarjetaInsumoApuData = (data: any): TarjetaInsumoApu => ({
    id: data.id,
    id_tarjeta: data.id_tarjeta,
    id_insumo: data.id_insumo,
    tipo: data.tipo,
    insumo_clave: data.insumo_clave ?? '',
    insumo_descripcion: data.insumo_descripcion ?? '',
    insumo_unidad: data.insumo_unidad ?? '',
    cantidad: data.cantidad ?? 0,
    precio_unitario: data.precio_unitario ?? 0,
    importe: data.importe ?? 0,
});

export const fetchTarjetasApu = async (): Promise<TarjetaApu[]> => {
    const { data, error } = await supabase
        .from('fetch_apu_tarjetas')
        .select('*')
        .order('concepto_clave');

    if (error) {
        console.error('Error fetching Tarjetas APU:', error);
        throw error;
    }

    return data?.map(transformTarjetaApuData) || [];
};

export const fetchInsumosDeTarjetaApu = async (id_tarjeta: number): Promise<TarjetaInsumoApu[]> => {
    const { data, error } = await supabase
        .from('fetch_apu_tarjeta_insumos')
        .select('*')
        .eq('id_tarjeta', id_tarjeta)
        .order('id');

    if (error) {
        console.error('Error fetching insumos de Tarjeta APU:', error);
        throw error;
    }

    return data?.map(transformTarjetaInsumoApuData) || [];
};

// Trae los % (herramienta/indirectos/financiamiento/utilidad/cargos) de la última tarjeta guardada, para usarlos como default reutilizable
export const fetchDefaultsTarjetaApu = async (): Promise<Pick<TarjetaApu, 'pct_herramienta' | 'pct_indirectos' | 'pct_financiamiento' | 'pct_utilidad' | 'pct_cargos_adicionales'>> => {
    const defaults = { pct_herramienta: 3, pct_indirectos: 15, pct_financiamiento: 2, pct_utilidad: 10, pct_cargos_adicionales: 0 };

    const { data, error } = await supabase
        .from('apu_tarjetas')
        .select('pct_herramienta, pct_indirectos, pct_financiamiento, pct_utilidad, pct_cargos_adicionales')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching defaults de Tarjeta APU:', error);
        return defaults;
    }

    return data ? { ...defaults, ...data } : defaults;
};

// Crea la tarjeta (cabecera) y su detalle de insumos. No existe soporte de transacciones en este proyecto,
// así que si falla el detalle se elimina la cabecera recién creada para no dejar una tarjeta huérfana.
export const createTarjetaApu = async (tarjeta: TarjetaApu): Promise<TarjetaApu> => {
    const totales = calcularTotalesTarjeta(tarjeta.insumos || [], tarjeta);

    const { data, error } = await supabase
        .from('apu_tarjetas')
        .insert([{
            id_concepto: tarjeta.id_concepto,
            rendimiento: tarjeta.rendimiento ?? 1,
            jornada_horas: tarjeta.jornada_horas ?? 8,
            pct_herramienta: tarjeta.pct_herramienta ?? 0,
            pct_indirectos: tarjeta.pct_indirectos ?? 0,
            pct_financiamiento: tarjeta.pct_financiamiento ?? 0,
            pct_utilidad: tarjeta.pct_utilidad ?? 0,
            pct_cargos_adicionales: tarjeta.pct_cargos_adicionales ?? 0,
            notas: tarjeta.notas ?? '',
            status: tarjeta.status ?? true,
            ...totales
        }])
        .select('id')
        .single();

    if (error) {
        console.error('Error creating Tarjeta APU:', error);
        throw error;
    }

    try {
        await guardarInsumosTarjetaApu(data.id, tarjeta.insumos || []);
    } catch (errorDetalle) {
        await supabase.from('apu_tarjetas').delete().eq('id', data.id);
        throw errorDetalle;
    }

    return fetchTarjetaApuPorId(data.id);
};

export const updateTarjetaApu = async (tarjeta: TarjetaApu): Promise<TarjetaApu> => {
    const totales = calcularTotalesTarjeta(tarjeta.insumos || [], tarjeta);

    const { error } = await supabase
        .from('apu_tarjetas')
        .update({
            id_concepto: tarjeta.id_concepto,
            rendimiento: tarjeta.rendimiento ?? 1,
            jornada_horas: tarjeta.jornada_horas ?? 8,
            pct_herramienta: tarjeta.pct_herramienta ?? 0,
            pct_indirectos: tarjeta.pct_indirectos ?? 0,
            pct_financiamiento: tarjeta.pct_financiamiento ?? 0,
            pct_utilidad: tarjeta.pct_utilidad ?? 0,
            pct_cargos_adicionales: tarjeta.pct_cargos_adicionales ?? 0,
            notas: tarjeta.notas ?? '',
            status: tarjeta.status ?? true,
            updated_at: new Date().toISOString(),
            ...totales
        })
        .eq('id', tarjeta.id);

    if (error) {
        console.error('Error updating Tarjeta APU:', error);
        throw error;
    }

    await guardarInsumosTarjetaApu(tarjeta.id!, tarjeta.insumos || []);

    return fetchTarjetaApuPorId(tarjeta.id!);
};

// Reemplaza el detalle de insumos de la tarjeta (borra lo anterior e inserta el nuevo conjunto)
const guardarInsumosTarjetaApu = async (id_tarjeta: number, insumos: TarjetaInsumoApu[]): Promise<void> => {
    const { error: errorDelete } = await supabase.from('apu_tarjeta_insumos').delete().eq('id_tarjeta', id_tarjeta);
    if (errorDelete) {
        console.error('Error limpiando insumos de Tarjeta APU:', errorDelete);
        throw errorDelete;
    }

    if (insumos.length === 0) return;

    const { error: errorInsert } = await supabase.from('apu_tarjeta_insumos').insert(
        insumos.map((i) => ({
            id_tarjeta,
            id_insumo: i.id_insumo,
            tipo: i.tipo,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
            importe: (i.cantidad || 0) * (i.precio_unitario || 0)
        }))
    );

    if (errorInsert) {
        console.error('Error guardando insumos de Tarjeta APU:', errorInsert);
        throw errorInsert;
    }
};

export const fetchTarjetaApuPorId = async (id: number): Promise<TarjetaApu> => {
    const { data, error } = await supabase.from('fetch_apu_tarjetas').select('*').eq('id', id).single();

    if (error) {
        console.error('Error fetching Tarjeta APU por id:', error);
        throw error;
    }

    const insumos = await fetchInsumosDeTarjetaApu(id);

    return { ...transformTarjetaApuData(data), insumos };
};

export const deleteTarjetaApu = async (id: number): Promise<void> => {
    const { error } = await supabase.from('apu_tarjetas').delete().eq('id', id);

    if (error) {
        console.error('Error deleting Tarjeta APU:', error);
        throw error;
    }
};
