import ExcelJS from 'exceljs';
import { supabase } from '../../superbase.service';
import { calcularCostoMaquinaria, TipoCalculoMaquinariaApu } from './maquinariaApuService';
import { propagarPrecioAConceptoYRecalcular } from './presupuestosApuService';
import { fetchPresupuestoTarjetaApuPorId } from './presupuestoTarjetasApuService';
import { calcularTotalesTarjeta } from './tarjetasApuService';

export interface PresupuestoMaquinariaApu {
    id?: number;
    id_presupuesto: number;
    id_maquinaria: number;
    id_insumo: number;
    clave: string;
    descripcion: string;
    marca_modelo?: string;
    tipo_calculo: TipoCalculoMaquinariaApu;
    valor_adquisicion: number;
    valor_rescate_pct: number;
    vida_util_anios: number;
    horas_uso_anual: number;
    tasa_interes_pct: number;
    tasa_seguros_pct: number;
    factor_mantenimiento_pct: number;
    consumo_combustible_litros_hora: number;
    precio_combustible_litro: number;
    consumo_lubricantes_pct: number;
    costo_llantas_hora: number;
    otros_consumibles_hora: number;
    precio_flete: number;
    abundamiento: number;
    costo_fijo_hora?: number;
    costo_operacion_hora?: number;
    costo_hora_total?: number;
}

const transformPresupuestoMaquinariaApuData = (data: any): PresupuestoMaquinariaApu => ({
    id: data.id,
    id_presupuesto: data.id_presupuesto,
    id_maquinaria: data.id_maquinaria,
    id_insumo: data.id_insumo,
    clave: data.clave,
    descripcion: data.descripcion,
    marca_modelo: data.marca_modelo ?? '',
    tipo_calculo: data.tipo_calculo ?? 'ESTANDAR',
    valor_adquisicion: data.valor_adquisicion ?? 0,
    valor_rescate_pct: data.valor_rescate_pct ?? 0,
    vida_util_anios: data.vida_util_anios ?? 0,
    horas_uso_anual: data.horas_uso_anual ?? 0,
    tasa_interes_pct: data.tasa_interes_pct ?? 0,
    tasa_seguros_pct: data.tasa_seguros_pct ?? 0,
    factor_mantenimiento_pct: data.factor_mantenimiento_pct ?? 0,
    consumo_combustible_litros_hora: data.consumo_combustible_litros_hora ?? 0,
    precio_combustible_litro: data.precio_combustible_litro ?? 0,
    consumo_lubricantes_pct: data.consumo_lubricantes_pct ?? 0,
    costo_llantas_hora: data.costo_llantas_hora ?? 0,
    otros_consumibles_hora: data.otros_consumibles_hora ?? 0,
    precio_flete: data.precio_flete ?? 0,
    abundamiento: data.abundamiento ?? 1,
    costo_fijo_hora: data.costo_fijo_hora ?? 0,
    costo_operacion_hora: data.costo_operacion_hora ?? 0,
    costo_hora_total: data.costo_hora_total ?? 0
});

// Lista la Maquinaria propia de un presupuesto (no toca el catálogo maestro apu_maquinaria)
export const fetchPresupuestoMaquinariaApu = async (id_presupuesto: number): Promise<PresupuestoMaquinariaApu[]> => {
    const { data, error } = await supabase.from('fetch_apu_presupuesto_maquinaria').select('*').eq('id_presupuesto', id_presupuesto).order('descripcion');

    if (error) {
        console.error('Error fetching Maquinaria por Presupuesto APU:', error);
        throw error;
    }

    return data?.map(transformPresupuestoMaquinariaApuData) || [];
};

const fetchPresupuestoMaquinariaApuPorId = async (id: number): Promise<PresupuestoMaquinariaApu> => {
    const { data, error } = await supabase.from('fetch_apu_presupuesto_maquinaria').select('*').eq('id', id).single();

    if (error) {
        console.error('Error fetching Maquinaria por Presupuesto APU por id:', error);
        throw error;
    }

    return transformPresupuestoMaquinariaApuData(data);
};

// Guarda la Maquinaria propia del presupuesto (sin tocar la maquinaria maestra) y propaga el nuevo costo
// por hora hacia TODAS las tarjetas de este mismo presupuesto que usan esta maquinaria (puede repetirse en
// varias), recalculando cada una de ellas y, en cascada, el Subtotal/IVA/Total del presupuesto completo.
export const updatePresupuestoMaquinariaApu = async (maquinaria: PresupuestoMaquinariaApu): Promise<PresupuestoMaquinariaApu> => {
    const costo = calcularCostoMaquinaria(maquinaria);

    const { error } = await supabase
        .from('apu_presupuesto_maquinaria')
        .update({
            clave: maquinaria.clave,
            descripcion: maquinaria.descripcion,
            marca_modelo: maquinaria.marca_modelo ?? '',
            tipo_calculo: maquinaria.tipo_calculo ?? 'ESTANDAR',
            valor_adquisicion: maquinaria.valor_adquisicion ?? 0,
            valor_rescate_pct: maquinaria.valor_rescate_pct ?? 0,
            vida_util_anios: maquinaria.vida_util_anios ?? 0,
            horas_uso_anual: maquinaria.horas_uso_anual ?? 0,
            tasa_interes_pct: maquinaria.tasa_interes_pct ?? 0,
            tasa_seguros_pct: maquinaria.tasa_seguros_pct ?? 0,
            factor_mantenimiento_pct: maquinaria.factor_mantenimiento_pct ?? 0,
            consumo_combustible_litros_hora: maquinaria.consumo_combustible_litros_hora ?? 0,
            precio_combustible_litro: maquinaria.precio_combustible_litro ?? 0,
            consumo_lubricantes_pct: maquinaria.consumo_lubricantes_pct ?? 0,
            costo_llantas_hora: maquinaria.costo_llantas_hora ?? 0,
            otros_consumibles_hora: maquinaria.otros_consumibles_hora ?? 0,
            precio_flete: maquinaria.precio_flete ?? 0,
            abundamiento: maquinaria.abundamiento ?? 1,
            costo_fijo_hora: costo.costo_fijo_hora,
            costo_operacion_hora: costo.costo_operacion_hora,
            costo_hora_total: costo.costo_hora_total,
            updated_at: new Date().toISOString()
        })
        .eq('id', maquinaria.id);

    if (error) {
        console.error('Error updating Maquinaria por Presupuesto APU:', error);
        throw error;
    }

    // Tarjetas de ESTE presupuesto (puede haber varias que usen la misma maquinaria)
    const { data: tarjetasDelPresupuesto, error: errorTarjetas } = await supabase.from('apu_presupuesto_tarjetas').select('id').eq('id_presupuesto', maquinaria.id_presupuesto);
    if (errorTarjetas) {
        console.error('Error leyendo Tarjetas del Presupuesto para propagar Maquinaria:', errorTarjetas);
        throw errorTarjetas;
    }

    const idsTarjetas = (tarjetasDelPresupuesto || []).map((t) => t.id as number);
    if (idsTarjetas.length === 0) return fetchPresupuestoMaquinariaApuPorId(maquinaria.id!);

    // Renglones de insumo (dentro de esas tarjetas) que usan esta misma maquinaria
    const { data: insumosAfectados, error: errorInsumos } = await supabase
        .from('apu_presupuesto_tarjeta_insumos')
        .select('id, id_presupuesto_tarjeta, cantidad')
        .eq('id_insumo', maquinaria.id_insumo)
        .in('id_presupuesto_tarjeta', idsTarjetas);

    if (errorInsumos) {
        console.error('Error leyendo renglones de insumo a actualizar por cambio de Maquinaria:', errorInsumos);
        throw errorInsumos;
    }

    if (!insumosAfectados || insumosAfectados.length === 0) return fetchPresupuestoMaquinariaApuPorId(maquinaria.id!);

    await Promise.all(
        insumosAfectados.map((i) =>
            supabase
                .from('apu_presupuesto_tarjeta_insumos')
                .update({ precio_unitario: costo.costo_hora_total, importe: (i.cantidad || 0) * costo.costo_hora_total })
                .eq('id', i.id)
        )
    );

    const idsTarjetasAfectadas = Array.from(new Set(insumosAfectados.map((i) => i.id_presupuesto_tarjeta as number)));

    for (const idTarjeta of idsTarjetasAfectadas) {
        const tarjeta = await fetchPresupuestoTarjetaApuPorId(idTarjeta);
        const totalesTarjeta = calcularTotalesTarjeta(tarjeta.insumos || [], tarjeta);

        const { error: errorUpdateTarjeta } = await supabase
            .from('apu_presupuesto_tarjetas')
            .update({ ...totalesTarjeta, updated_at: new Date().toISOString() })
            .eq('id', idTarjeta);

        if (errorUpdateTarjeta) {
            console.error('Error recalculando Tarjeta del Presupuesto tras cambio de Maquinaria:', errorUpdateTarjeta);
            throw errorUpdateTarjeta;
        }

        await propagarPrecioAConceptoYRecalcular(maquinaria.id_presupuesto, tarjeta.id_presupuesto_concepto, totalesTarjeta.precio_unitario);
    }

    return fetchPresupuestoMaquinariaApuPorId(maquinaria.id!);
};

const MONEY_FORMAT = '"$"#,##0.00';
const BORDER_BOTTOM_MEDIUM: Partial<ExcelJS.Borders> = { bottom: { style: 'medium' } };

// Exporta la lista de Maquinaria propia del presupuesto (resumen de costo horario)
export const exportarMaquinariaPresupuestoExcel = async (maquinarias: PresupuestoMaquinariaApu[], nombrePresupuesto: string): Promise<void> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema APU - Tsa';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Costo Maquinaria');
    worksheet.columns = [{ width: 14 }, { width: 42 }, { width: 12 }, { width: 14 }, { width: 16 }, { width: 14 }];

    const headerRow = worksheet.addRow(['Clave', 'Descripción', 'Tipo', 'Costo Fijo', 'Costo Operación', 'Costo Total']);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => (cell.border = BORDER_BOTTOM_MEDIUM));

    maquinarias.forEach((m) => {
        const fila = worksheet.addRow([m.clave, m.descripcion, m.tipo_calculo === 'MANUAL' ? 'Manual' : 'Estándar', m.costo_fijo_hora, m.costo_operacion_hora, m.costo_hora_total]);
        [4, 5, 6].forEach((col) => (fila.getCell(col).numFmt = MONEY_FORMAT));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Costo_Maquinaria_${nombrePresupuesto}_${new Date().toISOString().split('T')[0]}.xlsx`.replace(/[^a-zA-Z0-9_.]/g, '_');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
