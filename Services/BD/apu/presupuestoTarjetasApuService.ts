import ExcelJS from 'exceljs';
import { supabase } from '../../superbase.service';
import { InsumoExplosionApu } from './explosionInsumosApuService';
import { TipoInsumoApu } from './insumosApuService';
import { propagarPrecioAConceptoYRecalcular } from './presupuestosApuService';
import { calcularTotalesTarjeta } from './tarjetasApuService';

const ID_HERRAMIENTA_MENOR = -1;

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

export const fetchInsumosDePresupuestoTarjetaApu = async (id_presupuesto_tarjeta: number): Promise<PresupuestoTarjetaInsumoApu[]> => {
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

    await propagarPrecioAConceptoYRecalcular(tarjeta.id_presupuesto, tarjeta.id_presupuesto_concepto, totales.precio_unitario);

    return fetchPresupuestoTarjetaApuPorId(tarjeta.id!);
};

// Explosión de insumos de TODO el presupuesto: para cada tarjeta clonada, multiplica la cantidad de
// cada insumo (por unidad del concepto) por la cantidad de obra capturada en el presupuesto para ese
// concepto, y agrega el total requerido por insumo. Incluye la Herramienta Menor como renglón aparte,
// ya que no se guarda como insumo individual (es un % sobre la mano de obra de cada tarjeta).
export const fetchExplosionInsumosPresupuesto = async (id_presupuesto: number): Promise<InsumoExplosionApu[]> => {
    const tarjetas = await fetchPresupuestoTarjetasApu(id_presupuesto);
    if (tarjetas.length === 0) return [];

    const { data: conceptosRaw, error } = await supabase
        .from('apu_presupuesto_conceptos')
        .select('id, cantidad')
        .in(
            'id',
            tarjetas.map((t) => t.id_presupuesto_concepto)
        );

    if (error) {
        console.error('Error leyendo cantidades de conceptos para la explosión de insumos del presupuesto:', error);
        throw error;
    }

    const cantidadPorConcepto = new Map((conceptosRaw || []).map((c) => [c.id, c.cantidad as number]));

    const detalles = await Promise.all(
        tarjetas.map(async (t) => ({
            cantidadConcepto: cantidadPorConcepto.get(t.id_presupuesto_concepto) || 0,
            costoHerramienta: t.costo_herramienta || 0,
            insumos: await fetchInsumosDePresupuestoTarjetaApu(t.id!)
        }))
    );

    const acumulado = new Map<number, InsumoExplosionApu>();

    detalles.forEach(({ cantidadConcepto, costoHerramienta, insumos }) => {
        insumos.forEach((insumo) => {
            const cantidadRequerida = (insumo.cantidad || 0) * cantidadConcepto;
            const existente = acumulado.get(insumo.id_insumo);

            if (existente) {
                existente.cantidad_total += cantidadRequerida;
                existente.importe_total += cantidadRequerida * (insumo.precio_unitario || 0);
            } else {
                acumulado.set(insumo.id_insumo, {
                    id_insumo: insumo.id_insumo,
                    clave: insumo.insumo_clave || '',
                    descripcion: insumo.insumo_descripcion || '',
                    tipo: insumo.tipo,
                    unidad: insumo.insumo_unidad || '',
                    cantidad_total: cantidadRequerida,
                    precio_unitario: insumo.precio_unitario || 0,
                    importe_total: cantidadRequerida * (insumo.precio_unitario || 0)
                });
            }
        });

        const importeHerramienta = costoHerramienta * cantidadConcepto;
        if (importeHerramienta > 0) {
            const existente = acumulado.get(ID_HERRAMIENTA_MENOR);
            if (existente) {
                existente.importe_total += importeHerramienta;
            } else {
                acumulado.set(ID_HERRAMIENTA_MENOR, {
                    id_insumo: ID_HERRAMIENTA_MENOR,
                    clave: '%MO',
                    descripcion: 'Herramienta Menor',
                    tipo: 'HERRAMIENTA',
                    unidad: '% M.O.',
                    cantidad_total: 0,
                    precio_unitario: 0,
                    importe_total: importeHerramienta
                });
            }
        }
    });

    return Array.from(acumulado.values()).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.descripcion.localeCompare(b.descripcion));
};

const MONEY_FORMAT = '"$"#,##0.00';
const BORDER_BOTTOM_MEDIUM: Partial<ExcelJS.Borders> = { bottom: { style: 'medium' } };

const descargarWorkbook = async (workbook: ExcelJS.Workbook, nombreArchivo: string): Promise<void> => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

// Exporta la lista de Tarjetas propias del presupuesto (resumen, una fila por concepto)
export const exportarTarjetasPresupuestoExcel = async (tarjetas: PresupuestoTarjetaApu[], nombrePresupuesto: string): Promise<void> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema APU - Tsa';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Tarjetas');
    worksheet.columns = [{ width: 14 }, { width: 42 }, { width: 10 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 16 }];

    const headerRow = worksheet.addRow(['Clave', 'Concepto', 'Unidad', 'Costo Directo', '% Material', '% M.O.', 'Precio Unitario']);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => (cell.border = BORDER_BOTTOM_MEDIUM));

    tarjetas.forEach((t) => {
        const fila = worksheet.addRow([t.concepto_clave, t.concepto_descripcion, t.concepto_unidad, t.costo_directo, (t.pct_material || 0) / 100, (t.pct_mano_obra || 0) / 100, t.precio_unitario]);
        fila.getCell(4).numFmt = MONEY_FORMAT;
        fila.getCell(5).numFmt = '0.00%';
        fila.getCell(6).numFmt = '0.00%';
        fila.getCell(7).numFmt = MONEY_FORMAT;
    });

    await descargarWorkbook(workbook, `Tarjetas_${nombrePresupuesto}`.replace(/[^a-zA-Z0-9_]/g, '_'));
};

// Exporta la Matriz de Precios Unitarios del presupuesto (mismas Tarjetas, con el desglose de costos)
export const exportarMatrizPresupuestoExcel = async (tarjetas: PresupuestoTarjetaApu[], nombrePresupuesto: string): Promise<void> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema APU - Tsa';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Matriz');
    worksheet.columns = [{ width: 14 }, { width: 38 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 16 }];

    const headerRow = worksheet.addRow(['Clave', 'Concepto', 'Unidad', 'Materiales', 'Mano de Obra', 'Maquinaria', '% Material', '% M.O.', '% Maq.', 'Precio Unitario']);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => (cell.border = BORDER_BOTTOM_MEDIUM));

    tarjetas.forEach((t) => {
        const fila = worksheet.addRow([
            t.concepto_clave,
            t.concepto_descripcion,
            t.concepto_unidad,
            t.costo_materiales,
            t.costo_mano_obra,
            t.costo_maquinaria,
            (t.pct_material || 0) / 100,
            (t.pct_mano_obra || 0) / 100,
            (t.pct_maquinaria || 0) / 100,
            t.precio_unitario
        ]);
        [4, 5, 6].forEach((col) => (fila.getCell(col).numFmt = MONEY_FORMAT));
        [7, 8, 9].forEach((col) => (fila.getCell(col).numFmt = '0.00%'));
        fila.getCell(10).numFmt = MONEY_FORMAT;
    });

    await descargarWorkbook(workbook, `Matriz_${nombrePresupuesto}`.replace(/[^a-zA-Z0-9_]/g, '_'));
};
