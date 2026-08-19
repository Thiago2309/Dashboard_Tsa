import ExcelJS from 'exceljs';
import { convertirImporteALetras } from './numeroALetrasApu';
import { TipoInsumoApu } from './insumosApuService';
import { fetchInsumosDeTarjetaApu, fetchTarjetasApu, TarjetaApu, TarjetaInsumoApu } from './tarjetasApuService';

// La Matriz de Precios Unitarios es un reporte de solo lectura sobre las tarjetas ya calculadas:
// reutiliza fetchTarjetasApu (misma fuente que la lista de Tarjetas).
export const fetchMatrizApu = async (): Promise<TarjetaApu[]> => {
    return fetchTarjetasApu();
};

const MONEY_FORMAT = '"$"#,##0.00';
const BORDER_BOTTOM_MEDIUM: Partial<ExcelJS.Borders> = { bottom: { style: 'medium' } };
const BORDER_TOP_THIN: Partial<ExcelJS.Borders> = { top: { style: 'thin' } };

const SECCIONES: { tipo: TipoInsumoApu; titulo: string }[] = [
    { tipo: 'MATERIAL', titulo: 'MATERIALES' },
    { tipo: 'MANO_OBRA', titulo: 'MANO DE OBRA' },
    { tipo: 'MAQUINARIA', titulo: 'MAQUINARIA Y EQUIPO' }
];

// Nombre de hoja válido para Excel: máx. 31 caracteres, sin \ / ? * [ ] :
const sanitizarNombreHoja = (texto: string): string =>
    texto
        .replace(/[\\/?*[\]:]/g, ' ')
        .trim()
        .substring(0, 31) || 'Concepto';

const agregarHojaTarjeta = (workbook: ExcelJS.Workbook, tarjeta: TarjetaApu, insumos: TarjetaInsumoApu[], nombreHoja: string): void => {
    const worksheet = workbook.addWorksheet(nombreHoja);
    worksheet.columns = [{ width: 14 }, { width: 42 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 10 }];

    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = 'ANÁLISIS DE PRECIOS UNITARIOS';
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    worksheet.getRow(1).height = 22;

    const headerRow = worksheet.addRow(['Código', 'Concepto', 'Unidad', 'Costo', 'Cantidad', 'Importe', '%']);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };
    headerRow.eachCell((cell) => (cell.border = BORDER_BOTTOM_MEDIUM));

    const filaAnalisis = worksheet.addRow([`Análisis: ${tarjeta.concepto_clave}    Unidad: ${tarjeta.concepto_unidad}.`]);
    worksheet.mergeCells(filaAnalisis.number, 1, filaAnalisis.number, 7);
    filaAnalisis.font = { bold: true };

    const filaDescripcion = worksheet.addRow([tarjeta.concepto_descripcion]);
    worksheet.mergeCells(filaDescripcion.number, 1, filaDescripcion.number, 7);
    filaDescripcion.alignment = { wrapText: true };

    worksheet.addRow([]);

    const costoDirecto = tarjeta.costo_directo || 0;
    const pctDe = (importe: number) => (costoDirecto > 0 ? importe / costoDirecto : 0);

    const agregarFilaInsumo = (i: TarjetaInsumoApu) => {
        const importe = (i.cantidad || 0) * (i.precio_unitario || 0);
        const fila = worksheet.addRow([i.insumo_clave, i.insumo_descripcion, i.insumo_unidad, i.precio_unitario, i.cantidad, importe, pctDe(importe)]);
        fila.getCell(4).numFmt = MONEY_FORMAT;
        fila.getCell(5).numFmt = '#,##0.0000';
        fila.getCell(6).numFmt = MONEY_FORMAT;
        fila.getCell(7).numFmt = '0.00%';
    };

    const agregarFilaResumen = (etiqueta: string, monto: number, pct?: number, destacado = false) => {
        const fila = worksheet.addRow([null, etiqueta, null, null, null, monto, pct]);
        fila.getCell(6).numFmt = MONEY_FORMAT;
        if (pct !== undefined) fila.getCell(7).numFmt = '0.00%';
        if (destacado) {
            fila.font = { bold: true };
            fila.eachCell((cell) => (cell.border = BORDER_TOP_THIN));
        }
        return fila;
    };

    SECCIONES.forEach(({ tipo, titulo }) => {
        const filas = insumos.filter((i) => i.tipo === tipo);
        if (filas.length === 0) return;

        const subtotal = tipo === 'MATERIAL' ? tarjeta.costo_materiales || 0 : tipo === 'MANO_OBRA' ? tarjeta.costo_mano_obra || 0 : tarjeta.costo_maquinaria || 0;

        const filaTitulo = worksheet.addRow([titulo]);
        filaTitulo.font = { bold: true, underline: true };

        filas.forEach(agregarFilaInsumo);
        agregarFilaResumen(`Subtotal: ${titulo}`, subtotal, pctDe(subtotal), true);
    });

    if ((tarjeta.costo_herramienta || 0) > 0) {
        agregarFilaResumen(`Herramienta Menor (${tarjeta.pct_herramienta || 0}% de Mano de Obra)`, tarjeta.costo_herramienta || 0);
    }

    agregarFilaResumen('Costo Directo', costoDirecto, 1, true);
    agregarFilaResumen('Indirectos', tarjeta.monto_indirectos || 0, (tarjeta.pct_indirectos || 0) / 100);

    if ((tarjeta.pct_financiamiento || 0) > 0) {
        agregarFilaResumen('Financiamiento', tarjeta.monto_financiamiento || 0, (tarjeta.pct_financiamiento || 0) / 100);
    }

    agregarFilaResumen('Subtotal', costoDirecto + (tarjeta.monto_indirectos || 0) + (tarjeta.monto_financiamiento || 0), undefined, true);
    agregarFilaResumen('Utilidad', tarjeta.monto_utilidad || 0, (tarjeta.pct_utilidad || 0) / 100);

    if ((tarjeta.pct_cargos_adicionales || 0) > 0) {
        agregarFilaResumen('Cargos Adicionales', tarjeta.monto_cargos_adicionales || 0, (tarjeta.pct_cargos_adicionales || 0) / 100);
    }

    agregarFilaResumen('PRECIO UNITARIO', tarjeta.precio_unitario || 0, undefined, true);

    const filaLetra = worksheet.addRow([`( * ${convertirImporteALetras(tarjeta.precio_unitario || 0)} * )`]);
    worksheet.mergeCells(filaLetra.number, 1, filaLetra.number, 7);
    filaLetra.font = { italic: true };
    filaLetra.alignment = { horizontal: 'center' };
};

// Genera un libro de Excel con una hoja por concepto, cada una con el desglose completo
// de materiales/mano de obra/maquinaria, herramienta, indirectos, utilidad y precio unitario.
export const exportarMatrizApuExcelDetallado = async (tarjetas: TarjetaApu[]): Promise<void> => {
    if (tarjetas.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema APU - Tsa';
    workbook.created = new Date();

    const nombresUsados = new Set<string>();

    const insumosPorTarjeta = await Promise.all(tarjetas.map((t) => fetchInsumosDeTarjetaApu(t.id!)));

    tarjetas.forEach((tarjeta, index) => {
        let nombreHoja = sanitizarNombreHoja(tarjeta.concepto_clave || `Concepto ${index + 1}`);
        let sufijo = 2;
        while (nombresUsados.has(nombreHoja)) {
            nombreHoja = sanitizarNombreHoja(`${tarjeta.concepto_clave} (${sufijo})`);
            sufijo += 1;
        }
        nombresUsados.add(nombreHoja);

        agregarHojaTarjeta(workbook, tarjeta, insumosPorTarjeta[index], nombreHoja);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Matriz_Precios_Unitarios_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
