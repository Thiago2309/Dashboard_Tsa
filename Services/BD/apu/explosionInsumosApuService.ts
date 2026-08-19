import ExcelJS from 'exceljs';
import { fetchInsumosDeTarjetaApu, TarjetaInsumoApu } from './tarjetasApuService';

export interface ConceptoCantidadApu {
    id_tarjeta: number;
    concepto_clave: string;
    concepto_descripcion: string;
    cantidad: number;
    // Costo de herramienta menor por unidad del concepto (tarjeta.costo_herramienta):
    // no se guarda como renglón de insumo, así que se agrega aparte para no perderlo en la explosión.
    costo_herramienta: number;
}

export interface InsumoExplosionApu {
    id_insumo: number;
    clave: string;
    descripcion: string;
    tipo: string;
    unidad: string;
    cantidad_total: number;
    precio_unitario: number;
    importe_total: number;
}

const ID_HERRAMIENTA_MENOR = -1;

// Explosión de insumos de UNA tarjeta (equivale a su detalle de materiales/mano de obra/maquinaria)
export const fetchExplosionInsumosTarjeta = async (id_tarjeta: number): Promise<TarjetaInsumoApu[]> => {
    return fetchInsumosDeTarjetaApu(id_tarjeta);
};

// Toma de cantidades: combina el detalle de insumos de varios conceptos, multiplicado por la cantidad
// de obra capturada para cada uno, y agrega el total requerido por insumo. No se persiste en BD.
export const calcularTomaDeCantidades = async (conceptos: ConceptoCantidadApu[]): Promise<InsumoExplosionApu[]> => {
    const detalles = await Promise.all(
        conceptos.map(async (c) => ({
            cantidadConcepto: c.cantidad,
            costoHerramienta: c.costo_herramienta,
            insumos: await fetchInsumosDeTarjetaApu(c.id_tarjeta)
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

        const importeHerramienta = (costoHerramienta || 0) * cantidadConcepto;
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
const BORDER_TOP_THIN: Partial<ExcelJS.Borders> = { top: { style: 'thin' } };

const GRUPOS: { tipos: string[]; titulo: string }[] = [
    { tipos: ['MATERIAL'], titulo: 'MATERIALES' },
    { tipos: ['MANO_OBRA'], titulo: 'MANO DE OBRA' },
    { tipos: ['MAQUINARIA', 'HERRAMIENTA'], titulo: 'EQUIPO Y HERRAMIENTA' }
];

// Exporta el listado de insumos agrupado por Materiales / Mano de Obra / Equipo y Herramienta,
// con subtotales por grupo y el bloque de Totales de Insumos, igual al formato que se ve en pantalla.
export const exportarExplosionInsumosExcel = async (insumos: InsumoExplosionApu[], nombreArchivo = 'Explosion_Insumos'): Promise<void> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema APU - Tsa';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Listado de Insumos');
    worksheet.columns = [{ width: 16 }, { width: 42 }, { width: 10 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 10 }];

    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = 'LISTADO DE INSUMOS QUE INTERVIENE EN LA INTEGRACIÓN DE LA PROPUESTA';
    worksheet.getCell('A1').font = { bold: true, size: 13 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    worksheet.getRow(1).height = 22;

    const headerRow = worksheet.addRow(['Código', 'Concepto', 'Unidad', 'Cantidad', 'Precio', 'Importe', '% Incid.']);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };
    headerRow.eachCell((cell) => (cell.border = BORDER_BOTTOM_MEDIUM));
    worksheet.addRow([]);

    const totalPorGrupo = GRUPOS.map((g) => insumos.filter((i) => g.tipos.includes(i.tipo)).reduce((acc, i) => acc + i.importe_total, 0));
    const granTotal = totalPorGrupo.reduce((a, b) => a + b, 0);
    const pctDe = (v: number) => (granTotal > 0 ? v / granTotal : 0);

    GRUPOS.forEach(({ tipos, titulo }, idx) => {
        const filas = insumos.filter((i) => tipos.includes(i.tipo));
        if (filas.length === 0) return;

        const filaTitulo = worksheet.addRow([null, titulo]);
        filaTitulo.font = { bold: true };

        filas.forEach((i) => {
            const esHerramienta = i.id_insumo === ID_HERRAMIENTA_MENOR;
            const fila = worksheet.addRow([i.clave, i.descripcion, i.unidad, esHerramienta ? null : i.cantidad_total, esHerramienta ? null : i.precio_unitario, i.importe_total, pctDe(i.importe_total)]);
            fila.getCell(4).numFmt = '#,##0.0000';
            fila.getCell(5).numFmt = MONEY_FORMAT;
            fila.getCell(6).numFmt = MONEY_FORMAT;
            fila.getCell(7).numFmt = '0.00%';
        });

        const filaSubtotal = worksheet.addRow([null, `Total ${titulo}`, null, null, null, totalPorGrupo[idx]]);
        filaSubtotal.font = { bold: true };
        filaSubtotal.getCell(6).numFmt = MONEY_FORMAT;
        filaSubtotal.eachCell((cell) => (cell.border = BORDER_TOP_THIN));
        worksheet.addRow([]);
    });

    worksheet.addRow([]);
    const filaTitTotales = worksheet.addRow(['TOTALES DE INSUMOS']);
    filaTitTotales.font = { bold: true, size: 12 };

    const filaEncTotales = worksheet.addRow([null, null, null, null, null, 'Importe', '%']);
    filaEncTotales.font = { bold: true };

    const etiquetas = ['Materiales', 'Mano de obra', 'Equipo'];
    etiquetas.forEach((etiqueta, idx) => {
        const fila = worksheet.addRow([null, etiqueta, null, null, null, totalPorGrupo[idx], pctDe(totalPorGrupo[idx])]);
        fila.getCell(6).numFmt = MONEY_FORMAT;
        fila.getCell(7).numFmt = '0.00%';
    });

    const filaTotal = worksheet.addRow([null, 'Total', null, null, null, granTotal, 1]);
    filaTotal.font = { bold: true };
    filaTotal.getCell(6).numFmt = MONEY_FORMAT;
    filaTotal.getCell(7).numFmt = '0.00%';
    filaTotal.eachCell((cell) => (cell.border = BORDER_TOP_THIN));

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
