import ExcelJS from 'exceljs';
import { supabase } from '../../superbase.service';
import { fetchCamiones } from '../inventario/camion/camionService';
import { fetchMaquinarias } from '../inventario/maquinaria/maquinariaService';
import { fetchBitacoras } from '../taller/bitacoraTallerService';

export type TipoUnidadCosto = 'camion' | 'maquinaria';

export interface CostoOperativoUnidad {
    tipoEquipo: TipoUnidadCosto;
    tipoLabel: string;
    id: number;
    unidad: string;
    referencia: string;
    refacciones: number;
    manoObra: number;
    combustible: number;
    otros: number;
    total: number;
}

export interface DetalleRefaccion {
    fecha: string;
    producto: string;
    cantidad: number;
    costoUnitario: number;
    total: number;
    ordenTrabajo: string | null;
    motivo: string | null;
}

export interface DetalleManoObra {
    fecha: string;
    motivo: string | null;
    tecnicoAsignado: string | null;
    esTallerExterno: boolean;
    costo: number;
}

export interface DetalleCombustible {
    fecha: string;
    viajeFolio: string | null;
    litros: number | null;
    importe: number;
}

export interface CostoOtro {
    id?: number;
    tipo_equipo: TipoUnidadCosto;
    camion_id: number | null;
    maquinaria_id: number | null;
    concepto: string;
    monto: number;
    fecha: string;
    registrado_por: string | null;
    created_at?: string;
}

const claveUnidad = (tipo: TipoUnidadCosto, id: number) => `${tipo}-${id}`;

// -------- Fuentes de datos crudas --------

const fetchMovimientosSalida = async () => {
    const { data, error } = await supabase
        .from('movimientos_inventario')
        .select('camion_id, maquinaria_id, cantidad, costo_unitario, fecha, motivo, orden_trabajo, inventario(nombre)')
        .eq('tipo', 'salida');

    if (error) {
        console.error('Error al obtener refacciones por unidad:', error);
        throw new Error(error.message);
    }
    return data || [];
};

interface CombustibleUnidadRow {
    tipo: TipoUnidadCosto | null;
    unidadId: number | null;
    fecha: string;
    importe: number;
    litros: number | null;
    folio: string | null;
}

// El combustible ahora se liga directo a camion_id/maquinaria_id. Se conserva el
// fallback por viajes.id_m3 solo por si quedan registros antiguos ligados a un viaje.
const fetchCombustiblePorUnidad = async (): Promise<CombustibleUnidadRow[]> => {
    const { data, error } = await supabase
        .from('combustible')
        .select('fecha, importe, litros, camion_id, maquinaria_id, viajes(id_m3, folio)');

    if (error) {
        console.error('Error al obtener combustible por unidad:', error);
        throw new Error(error.message);
    }

    return (data || []).map((c: any) => {
        let tipo: TipoUnidadCosto | null = null;
        let unidadId: number | null = null;

        if (c.camion_id) {
            tipo = 'camion';
            unidadId = c.camion_id;
        } else if (c.maquinaria_id) {
            tipo = 'maquinaria';
            unidadId = c.maquinaria_id;
        } else if (c.viajes?.id_m3) {
            tipo = 'camion';
            unidadId = c.viajes.id_m3;
        }

        return {
            tipo,
            unidadId,
            fecha: c.fecha,
            importe: c.importe || 0,
            litros: c.litros ?? null,
            folio: c.viajes?.folio ?? null
        };
    });
};

const toCostoOtroRow = (o: Partial<CostoOtro>) => {
    const { id, created_at, ...row } = o;
    return row;
};

export const fetchCostosOtros = async (): Promise<CostoOtro[]> => {
    const { data, error } = await supabase
        .from('costo_operativo_otros')
        .select('*')
        .order('fecha', { ascending: false });

    if (error) {
        console.error('Error al obtener otros costos:', error);
        throw new Error(error.message);
    }
    return data || [];
};

export const crearCostoOtro = async (costo: Omit<CostoOtro, 'id' | 'created_at'>): Promise<CostoOtro> => {
    const { data, error } = await supabase
        .from('costo_operativo_otros')
        .insert([toCostoOtroRow(costo)])
        .select()
        .single();

    if (error) {
        console.error('Error al registrar otro costo:', error);
        throw new Error(error.message);
    }
    return data;
};

export const eliminarCostoOtro = async (id: number): Promise<void> => {
    const { error } = await supabase.from('costo_operativo_otros').delete().eq('id', id);
    if (error) {
        console.error('Error al eliminar otro costo:', error);
        throw new Error(error.message);
    }
};

// -------- Tabla principal: costo agregado por unidad --------

export const fetchCostoOperativoUnidades = async (): Promise<CostoOperativoUnidad[]> => {
    const [camiones, maquinarias, movimientos, bitacoras, combustible, otros] = await Promise.all([
        fetchCamiones(),
        fetchMaquinarias(),
        fetchMovimientosSalida(),
        fetchBitacoras(),
        fetchCombustiblePorUnidad(),
        fetchCostosOtros()
    ]);

    const refaccionesPorUnidad = new Map<string, number>();
    movimientos.forEach((m: any) => {
        const clave = m.camion_id ? claveUnidad('camion', m.camion_id) : m.maquinaria_id ? claveUnidad('maquinaria', m.maquinaria_id) : null;
        if (!clave) return;
        const total = (m.costo_unitario || 0) * (m.cantidad || 0);
        refaccionesPorUnidad.set(clave, (refaccionesPorUnidad.get(clave) || 0) + total);
    });

    const manoObraPorUnidad = new Map<string, number>();
    bitacoras.forEach(b => {
        const clave = b.camion_id ? claveUnidad('camion', b.camion_id) : b.maquinaria_id ? claveUnidad('maquinaria', b.maquinaria_id) : null;
        if (!clave) return;
        manoObraPorUnidad.set(clave, (manoObraPorUnidad.get(clave) || 0) + (b.costo_mano_obra || 0));
    });

    const combustiblePorUnidad = new Map<string, number>();
    combustible.forEach(c => {
        if (!c.tipo || !c.unidadId) return;
        const clave = claveUnidad(c.tipo, c.unidadId);
        combustiblePorUnidad.set(clave, (combustiblePorUnidad.get(clave) || 0) + (c.importe || 0));
    });

    const otrosPorUnidad = new Map<string, number>();
    otros.forEach(o => {
        const clave = o.tipo_equipo === 'camion' && o.camion_id ? claveUnidad('camion', o.camion_id)
            : o.tipo_equipo === 'maquinaria' && o.maquinaria_id ? claveUnidad('maquinaria', o.maquinaria_id)
            : null;
        if (!clave) return;
        otrosPorUnidad.set(clave, (otrosPorUnidad.get(clave) || 0) + (o.monto || 0));
    });

    const filasCamiones: CostoOperativoUnidad[] = camiones.map(c => {
        const clave = claveUnidad('camion', c.id!);
        const refacciones = refaccionesPorUnidad.get(clave) || 0;
        const manoObra = manoObraPorUnidad.get(clave) || 0;
        const combustibleMonto = combustiblePorUnidad.get(clave) || 0;
        const otrosMonto = otrosPorUnidad.get(clave) || 0;
        return {
            tipoEquipo: 'camion',
            tipoLabel: 'Camión',
            id: c.id!,
            unidad: `${c.nombre} (${c.placa})`,
            referencia: c.placa,
            refacciones,
            manoObra,
            combustible: combustibleMonto,
            otros: otrosMonto,
            total: refacciones + manoObra + combustibleMonto + otrosMonto
        };
    });

    const filasMaquinaria: CostoOperativoUnidad[] = maquinarias.map(m => {
        const clave = claveUnidad('maquinaria', m.id!);
        const refacciones = refaccionesPorUnidad.get(clave) || 0;
        const manoObra = manoObraPorUnidad.get(clave) || 0;
        const combustibleMonto = combustiblePorUnidad.get(clave) || 0;
        const otrosMonto = otrosPorUnidad.get(clave) || 0;
        return {
            tipoEquipo: 'maquinaria',
            tipoLabel: 'Maquinaria',
            id: m.id!,
            unidad: `${m.eco} - ${m.equipo}`,
            referencia: m.no_serie || '-',
            refacciones,
            manoObra,
            combustible: combustibleMonto,
            otros: otrosMonto,
            total: refacciones + manoObra + combustibleMonto + otrosMonto
        };
    });

    return [...filasCamiones, ...filasMaquinaria];
};

// -------- Detalle por unidad (para el diálogo de "Detalles") --------

export const fetchDetalleUnidad = async (tipo: TipoUnidadCosto, unidadId: number): Promise<{
    refacciones: DetalleRefaccion[];
    manoObra: DetalleManoObra[];
    combustible: DetalleCombustible[];
    otros: CostoOtro[];
}> => {
    const [movimientos, bitacoras, combustible, otros] = await Promise.all([
        fetchMovimientosSalida(),
        fetchBitacoras(),
        fetchCombustiblePorUnidad(),
        fetchCostosOtros()
    ]);

    const campo = tipo === 'camion' ? 'camion_id' : 'maquinaria_id';

    const refacciones: DetalleRefaccion[] = movimientos
        .filter((m: any) => m[campo] === unidadId)
        .map((m: any) => ({
            fecha: m.fecha,
            producto: m.inventario?.nombre || 'Producto',
            cantidad: m.cantidad || 0,
            costoUnitario: m.costo_unitario || 0,
            total: (m.costo_unitario || 0) * (m.cantidad || 0),
            ordenTrabajo: m.orden_trabajo || null,
            motivo: m.motivo || null
        }));

    const manoObra: DetalleManoObra[] = bitacoras
        .filter(b => (tipo === 'camion' ? b.camion_id === unidadId : b.maquinaria_id === unidadId) && (b.costo_mano_obra || 0) > 0)
        .map(b => ({
            fecha: b.fecha_reporte || '',
            motivo: b.motivo,
            tecnicoAsignado: b.tecnico_asignado,
            esTallerExterno: b.es_taller_externo,
            costo: b.costo_mano_obra || 0
        }));

    const combustibleDetalle: DetalleCombustible[] = combustible
        .filter(c => c.tipo === tipo && c.unidadId === unidadId)
        .map(c => ({ fecha: c.fecha, viajeFolio: c.folio, litros: c.litros, importe: c.importe }));

    const otrosDetalle: CostoOtro[] = otros.filter(o => (tipo === 'camion' ? o.camion_id === unidadId : o.maquinaria_id === unidadId));

    return { refacciones, manoObra, combustible: combustibleDetalle, otros: otrosDetalle };
};

// -------- Exportar la hoja de vida (costos) de una unidad a Excel --------

const formatearMoneda = (valor: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valor || 0);
const formatearFecha = (fecha: string) => (fecha ? new Date(fecha).toLocaleDateString('es-MX') : '-');

export interface DetalleCostoUnidad {
    refacciones: DetalleRefaccion[];
    manoObra: DetalleManoObra[];
    combustible: DetalleCombustible[];
    otros: CostoOtro[];
}

export const exportarHojaDeVidaExcel = async (
    unidad: CostoOperativoUnidad,
    detalle: DetalleCostoUnidad,
    etiquetaPeriodo: string = 'Todo el historial'
): Promise<void> => {
    const totalRefacciones = detalle.refacciones.reduce((acc, r) => acc + r.total, 0);
    const totalManoObra = detalle.manoObra.reduce((acc, m) => acc + m.costo, 0);
    const totalCombustible = detalle.combustible.reduce((acc, c) => acc + c.importe, 0);
    const totalOtros = detalle.otros.reduce((acc, o) => acc + o.monto, 0);
    const totalPeriodo = totalRefacciones + totalManoObra + totalCombustible + totalOtros;

    const workbook = new ExcelJS.Workbook();

    const wsResumen = workbook.addWorksheet('Resumen');
    wsResumen.addRow(['Hoja de Vida - Costo Operativo']);
    wsResumen.addRow(['Unidad', unidad.unidad]);
    wsResumen.addRow(['Tipo', unidad.tipoLabel]);
    wsResumen.addRow(['Referencia', unidad.referencia]);
    wsResumen.addRow(['Periodo exportado', etiquetaPeriodo]);
    wsResumen.addRow([]);
    wsResumen.addRow(['Concepto', 'Monto']);
    wsResumen.addRow(['Refacciones', formatearMoneda(totalRefacciones)]);
    wsResumen.addRow(['Mano de Obra', formatearMoneda(totalManoObra)]);
    wsResumen.addRow(['Combustible', formatearMoneda(totalCombustible)]);
    wsResumen.addRow(['Otros', formatearMoneda(totalOtros)]);
    wsResumen.addRow(['Total del periodo', formatearMoneda(totalPeriodo)]);
    wsResumen.getRow(1).font = { bold: true, size: 14 };
    wsResumen.getRow(7).font = { bold: true };
    wsResumen.getRow(11).font = { bold: true };
    wsResumen.columns = [{ width: 20 }, { width: 25 }];

    const wsRefacciones = workbook.addWorksheet('Refacciones');
    wsRefacciones.addRow(['Fecha', 'Producto', 'Cantidad', 'Costo Unitario', 'Total', 'Orden de Trabajo', 'Motivo']).font = { bold: true };
    detalle.refacciones.forEach(r => {
        wsRefacciones.addRow([formatearFecha(r.fecha), r.producto, r.cantidad, formatearMoneda(r.costoUnitario), formatearMoneda(r.total), r.ordenTrabajo || '-', r.motivo || '-']);
    });
    wsRefacciones.columns = [{ width: 14 }, { width: 25 }, { width: 10 }, { width: 15 }, { width: 15 }, { width: 18 }, { width: 30 }];

    const wsManoObra = workbook.addWorksheet('Mano de Obra');
    wsManoObra.addRow(['Fecha', 'Motivo', 'Técnico Asignado', 'Taller Externo', 'Costo']).font = { bold: true };
    detalle.manoObra.forEach(m => {
        wsManoObra.addRow([formatearFecha(m.fecha), m.motivo || '-', m.tecnicoAsignado || '-', m.esTallerExterno ? 'Sí' : 'No', formatearMoneda(m.costo)]);
    });
    wsManoObra.columns = [{ width: 14 }, { width: 35 }, { width: 20 }, { width: 15 }, { width: 15 }];

    const wsCombustible = workbook.addWorksheet('Combustible');
    wsCombustible.addRow(['Fecha', 'Litros', 'Importe']).font = { bold: true };
    detalle.combustible.forEach(c => {
        wsCombustible.addRow([formatearFecha(c.fecha), c.litros ?? '-', formatearMoneda(c.importe)]);
    });
    wsCombustible.columns = [{ width: 14 }, { width: 10 }, { width: 15 }];

    const wsOtros = workbook.addWorksheet('Otros');
    wsOtros.addRow(['Fecha', 'Concepto', 'Registrado por', 'Monto']).font = { bold: true };
    detalle.otros.forEach(o => {
        wsOtros.addRow([formatearFecha(o.fecha), o.concepto, o.registrado_por || '-', formatearMoneda(o.monto)]);
    });
    wsOtros.columns = [{ width: 14 }, { width: 35 }, { width: 20 }, { width: 15 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const etiquetaArchivo = etiquetaPeriodo.replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `Hoja_Vida_${unidad.unidad.replace(/[^a-zA-Z0-9]/g, '_')}_${etiquetaArchivo}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
