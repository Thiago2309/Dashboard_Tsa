import * as XLSX from 'xlsx';
import { fetchInsumosDeTarjetaApu, TarjetaInsumoApu } from './tarjetasApuService';

export interface ConceptoCantidadApu {
    id_tarjeta: number;
    concepto_clave: string;
    concepto_descripcion: string;
    cantidad: number;
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
            insumos: await fetchInsumosDeTarjetaApu(c.id_tarjeta)
        }))
    );

    const acumulado = new Map<number, InsumoExplosionApu>();

    detalles.forEach(({ cantidadConcepto, insumos }) => {
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
    });

    return Array.from(acumulado.values()).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.descripcion.localeCompare(b.descripcion));
};

export const exportarExplosionInsumosExcel = (insumos: InsumoExplosionApu[], nombreArchivo = 'Explosion_Insumos'): void => {
    const filas = insumos.map((i) => ({
        Clave: i.clave,
        Descripción: i.descripcion,
        Tipo: i.tipo,
        Unidad: i.unidad,
        'Cantidad Total': Number(i.cantidad_total.toFixed(4)),
        'Precio Unitario': i.precio_unitario,
        'Importe Total': Number(i.importe_total.toFixed(2))
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);
    XLSX.utils.book_append_sheet(wb, ws, 'Explosion Insumos');
    XLSX.writeFile(wb, `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
