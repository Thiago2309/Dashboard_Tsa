import { supabase } from '../../superbase.service';
import { TipoInsumoApu } from './insumosApuService';
import { calcularTotalesDesdeConceptos, PresupuestoConceptoApu } from './presupuestosApuService';
import { calcularTotalesTarjeta } from './tarjetasApuService';

export interface PresupuestoTarjetaInsumoApu {
    id?: number;
    id_presupuesto_tarjeta?: number;
    id_insumo: number;
    tipo: TipoInsumoApu;
    insumo_clave?: string;
    insumo_descripcion?: string;
    insumo_unidad?: string;
    cantidad: number;
    precio_unitario: number;
    importe?: number;
}

export interface PresupuestoTarjetaApu {
    id?: number;
    id_presupuesto: number;
    id_presupuesto_concepto: number;
    id_concepto: number;
    concepto_clave?: string;
    concepto_descripcion?: string;
    concepto_unidad?: string;
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
    insumos?: PresupuestoTarjetaInsumoApu[];
}

const transformPresupuestoTarjetaApuData = (data: any): PresupuestoTarjetaApu => ({
    id: data.id,
    id_presupuesto: data.id_presupuesto,
    id_presupuesto_concepto: data.id_presupuesto_concepto,
    id_concepto: data.id_concepto,
    concepto_clave: data.concepto_clave ?? '',
    concepto_descripcion: data.concepto_descripcion ?? '',
    concepto_unidad: data.concepto_unidad ?? '',
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
    notas: data.notas ?? ''
});

const transformPresupuestoTarjetaInsumoApuData = (data: any): PresupuestoTarjetaInsumoApu => ({
    id: data.id,
    id_presupuesto_tarjeta: data.id_presupuesto_tarjeta,
    id_insumo: data.id_insumo,
    tipo: data.tipo,
    insumo_clave: data.insumo_clave ?? '',
    insumo_descripcion: data.insumo_descripcion ?? '',
    insumo_unidad: data.insumo_unidad ?? '',
    cantidad: data.cantidad ?? 0,
    precio_unitario: data.precio_unitario ?? 0,
    importe: data.importe ?? 0
});

// Lista las Tarjetas de Precio Unitario propias de un presupuesto (no toca la tabla maestra apu_tarjetas)
export const fetchPresupuestoTarjetasApu = async (id_presupuesto: number): Promise<PresupuestoTarjetaApu[]> => {
    const { data, error } = await supabase.from('fetch_apu_presupuesto_tarjetas').select('*').eq('id_presupuesto', id_presupuesto).order('concepto_clave');

    if (error) {
        console.error('Error fetching Tarjetas por Presupuesto APU:', error);
        throw error;
    }

    return data?.map(transformPresupuestoTarjetaApuData) || [];
};

const fetchInsumosDePresupuestoTarjetaApu = async (id_presupuesto_tarjeta: number): Promise<PresupuestoTarjetaInsumoApu[]> => {
    const { data, error } = await supabase.from('fetch_apu_presupuesto_tarjeta_insumos').select('*').eq('id_presupuesto_tarjeta', id_presupuesto_tarjeta).order('id');

    if (error) {
        console.error('Error fetching insumos de Tarjeta por Presupuesto APU:', error);
        throw error;
    }

    return data?.map(transformPresupuestoTarjetaInsumoApuData) || [];
};

export const fetchPresupuestoTarjetaApuPorId = async (id: number): Promise<PresupuestoTarjetaApu> => {
    const { data, error } = await supabase.from('fetch_apu_presupuesto_tarjetas').select('*').eq('id', id).single();

    if (error) {
        console.error('Error fetching Tarjeta por Presupuesto APU por id:', error);
        throw error;
    }

    const insumos = await fetchInsumosDePresupuestoTarjetaApu(id);

    return { ...transformPresupuestoTarjetaApuData(data), insumos };
};

// Guarda la Tarjeta propia del presupuesto (sin tocar la tarjeta maestra) y propaga el nuevo precio
// unitario hacia el renglón del presupuesto al que pertenece, recalculando también el Subtotal/IVA/Total
// del presupuesto completo.
export const updatePresupuestoTarjetaApu = async (tarjeta: PresupuestoTarjetaApu): Promise<PresupuestoTarjetaApu> => {
    const totales = calcularTotalesTarjeta(tarjeta.insumos || [], tarjeta);

    const { error: errorTarjeta } = await supabase
        .from('apu_presupuesto_tarjetas')
        .update({
            rendimiento: tarjeta.rendimiento ?? 1,
            jornada_horas: tarjeta.jornada_horas ?? 8,
            pct_herramienta: tarjeta.pct_herramienta ?? 0,
            pct_indirectos: tarjeta.pct_indirectos ?? 0,
            pct_financiamiento: tarjeta.pct_financiamiento ?? 0,
            pct_utilidad: tarjeta.pct_utilidad ?? 0,
            pct_cargos_adicionales: tarjeta.pct_cargos_adicionales ?? 0,
            notas: tarjeta.notas ?? '',
            updated_at: new Date().toISOString(),
            ...totales
        })
        .eq('id', tarjeta.id);

    if (errorTarjeta) {
        console.error('Error updating Tarjeta por Presupuesto APU:', errorTarjeta);
        throw errorTarjeta;
    }

    const { error: errorDelete } = await supabase.from('apu_presupuesto_tarjeta_insumos').delete().eq('id_presupuesto_tarjeta', tarjeta.id);
    if (errorDelete) {
        console.error('Error limpiando insumos de Tarjeta por Presupuesto APU:', errorDelete);
        throw errorDelete;
    }

    if ((tarjeta.insumos || []).length > 0) {
        const { error: errorInsert } = await supabase.from('apu_presupuesto_tarjeta_insumos').insert(
            (tarjeta.insumos || []).map((i) => ({
                id_presupuesto_tarjeta: tarjeta.id,
                id_insumo: i.id_insumo,
                tipo: i.tipo,
                cantidad: i.cantidad,
                precio_unitario: i.precio_unitario,
                importe: (i.cantidad || 0) * (i.precio_unitario || 0)
            }))
        );

        if (errorInsert) {
            console.error('Error guardando insumos de Tarjeta por Presupuesto APU:', errorInsert);
            throw errorInsert;
        }
    }

    await propagarPrecioAlPresupuesto(tarjeta.id_presupuesto, tarjeta.id_presupuesto_concepto, totales.precio_unitario);

    return fetchPresupuestoTarjetaApuPorId(tarjeta.id!);
};

// Actualiza el renglón del presupuesto (precio_unitario/importe) y recalcula el Subtotal/IVA/Total
// de la cabecera del presupuesto, usando el mismo criterio que el resto del módulo de Presupuesto.
const propagarPrecioAlPresupuesto = async (id_presupuesto: number, id_presupuesto_concepto: number, nuevoPrecioUnitario: number): Promise<void> => {
    const { data: conceptoActual, error: errorConcepto } = await supabase.from('apu_presupuesto_conceptos').select('cantidad').eq('id', id_presupuesto_concepto).single();
    if (errorConcepto) {
        console.error('Error leyendo renglón de Presupuesto APU a actualizar:', errorConcepto);
        throw errorConcepto;
    }

    const nuevoImporte = (conceptoActual.cantidad || 0) * nuevoPrecioUnitario;

    const { error: errorUpdateConcepto } = await supabase
        .from('apu_presupuesto_conceptos')
        .update({ precio_unitario: nuevoPrecioUnitario, importe: nuevoImporte })
        .eq('id', id_presupuesto_concepto);

    if (errorUpdateConcepto) {
        console.error('Error propagando precio al renglón de Presupuesto APU:', errorUpdateConcepto);
        throw errorUpdateConcepto;
    }

    const { data: presupuestoActual, error: errorPresupuesto } = await supabase.from('apu_presupuestos').select('pct_iva').eq('id', id_presupuesto).single();
    if (errorPresupuesto) {
        console.error('Error leyendo Presupuesto APU a recalcular:', errorPresupuesto);
        throw errorPresupuesto;
    }

    const { data: todosLosConceptos, error: errorConceptos } = await supabase.from('fetch_apu_presupuesto_conceptos').select('cantidad, precio_unitario, aplica_iva').eq('id_presupuesto', id_presupuesto);
    if (errorConceptos) {
        console.error('Error leyendo conceptos de Presupuesto APU para recalcular:', errorConceptos);
        throw errorConceptos;
    }

    const totalesPresupuesto = calcularTotalesDesdeConceptos((todosLosConceptos || []) as PresupuestoConceptoApu[], presupuestoActual.pct_iva);

    const { error: errorUpdatePresupuesto } = await supabase
        .from('apu_presupuestos')
        .update({ ...totalesPresupuesto, updated_at: new Date().toISOString() })
        .eq('id', id_presupuesto);

    if (errorUpdatePresupuesto) {
        console.error('Error recalculando totales de Presupuesto APU:', errorUpdatePresupuesto);
        throw errorUpdatePresupuesto;
    }
};
