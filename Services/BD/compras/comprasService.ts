import { supabase } from '../../superbase.service';
import { numeroOrden } from '../taller/ordenTrabajoService';

export type EstatusRequisicion = 'Pendiente' | 'Cotizada' | 'Comprada' | 'Cancelada';
export type EstatusOrdenCompra = 'Pendiente' | 'Aprobada' | 'Cancelada';

export interface RequisicionCompra {
    id: number;
    orden_trabajo_id: number;
    orden_trabajo_detalle_id: number | null;
    producto_id: number;
    cantidad_faltante: number;
    estatus: EstatusRequisicion;
    fecha: string;
    // Contexto resuelto en el cliente
    productoCodigo?: string;
    productoNombre?: string;
    productoUnidad?: string;
    precioCompra?: number | null;
    numeroOrdenTrabajo?: string;
    equipoLabel?: string;
    motivoBitacora?: string | null;
}

export interface OrdenCompra {
    id: number;
    requisicion_id: number;
    producto_id: number;
    cantidad: number;
    costo_unitario: number | null;
    proveedor_id: number | null;
    tipo_comprobante: 'nota' | 'factura' | null;
    folio: string | null;
    tipo_pago: 'credito' | 'contado' | null;
    estatus: EstatusOrdenCompra;
    creado_por: string | null;
    fecha_creacion: string;
    fecha_aprobacion: string | null;
    // Contexto resuelto en el cliente
    productoNombre?: string;
    productoUnidad?: string;
    proveedorNombre?: string;
    numeroOrdenTrabajo?: string;
}

const equipoLabelDe = (o: any): string =>
    o?.tipo_equipo === 'camion'
        ? `${o?.bitacora_taller?.m3?.nombre || 'Camión'} (${o?.bitacora_taller?.m3?.placa || 's/placa'})`
        : `${o?.bitacora_taller?.maquinaria?.eco ? o.bitacora_taller.maquinaria.eco + ' - ' : ''}${o?.bitacora_taller?.maquinaria?.equipo || 'Maquinaria'}`;

export const fetchRequisiciones = async (): Promise<RequisicionCompra[]> => {
    const { data, error } = await supabase
        .from('requisicion_compra')
        .select(`
            *,
            inventario(codigo, nombre, unidad, precio_compra),
            orden_trabajo(id, tipo_equipo, bitacora_taller(motivo, m3(nombre, placa), maquinaria(eco, equipo)))
        `)
        .order('fecha', { ascending: false });

    if (error) {
        console.error('Error al obtener requisiciones de compra:', error);
        throw new Error(error.message);
    }

    return (data || []).map((r: any) => ({
        ...r,
        productoCodigo: r.inventario?.codigo,
        productoNombre: r.inventario?.nombre,
        productoUnidad: r.inventario?.unidad,
        precioCompra: r.inventario?.precio_compra ?? null,
        numeroOrdenTrabajo: numeroOrden(r.orden_trabajo_id),
        equipoLabel: equipoLabelDe(r.orden_trabajo),
        motivoBitacora: r.orden_trabajo?.bitacora_taller?.motivo || null
    }));
};

export interface DatosOrdenCompra {
    cantidad: number;
    costo_unitario: number | null;
    proveedor_id: number | null;
    tipo_comprobante: 'nota' | 'factura' | null;
    folio: string | null;
    tipo_pago: 'credito' | 'contado' | null;
    creado_por: string | null;
}

export const generarOrdenCompra = async (requisicion: RequisicionCompra, datos: DatosOrdenCompra): Promise<OrdenCompra> => {
    const { data, error } = await supabase
        .from('orden_compra')
        .insert([{
            requisicion_id: requisicion.id,
            producto_id: requisicion.producto_id,
            cantidad: datos.cantidad,
            costo_unitario: datos.costo_unitario,
            proveedor_id: datos.proveedor_id,
            tipo_comprobante: datos.tipo_comprobante,
            folio: datos.folio,
            tipo_pago: datos.tipo_pago,
            creado_por: datos.creado_por,
            estatus: 'Pendiente'
        }])
        .select()
        .single();

    if (error) {
        console.error('Error al generar orden de compra:', error);
        throw new Error(error.message);
    }

    const { error: errorRequisicion } = await supabase
        .from('requisicion_compra')
        .update({ estatus: 'Cotizada' })
        .eq('id', requisicion.id);

    if (errorRequisicion) console.error('Error al actualizar requisición:', errorRequisicion);

    return data;
};

export const fetchOrdenesCompra = async (): Promise<OrdenCompra[]> => {
    const { data, error } = await supabase
        .from('orden_compra')
        .select('*, inventario(nombre, unidad), proveedor(nombre), requisicion_compra(orden_trabajo_id)')
        .order('fecha_creacion', { ascending: false });

    if (error) {
        console.error('Error al obtener órdenes de compra:', error);
        throw new Error(error.message);
    }

    return (data || []).map((o: any) => ({
        ...o,
        productoNombre: o.inventario?.nombre,
        productoUnidad: o.inventario?.unidad,
        proveedorNombre: o.proveedor?.nombre,
        numeroOrdenTrabajo: o.requisicion_compra?.orden_trabajo_id ? numeroOrden(o.requisicion_compra.orden_trabajo_id) : undefined
    }));
};

// Solo marca la orden de compra como autorizada. NO mueve stock ni surte nada
// automáticamente: quien aprueba avisa a Almacén, y Almacén registra la
// entrada del producto manualmente desde Inventario cuando físicamente llega.
export const aprobarOrdenCompra = async (orden: OrdenCompra): Promise<void> => {
    const { error: errorOrdenCompra } = await supabase
        .from('orden_compra')
        .update({ estatus: 'Aprobada', fecha_aprobacion: new Date().toISOString() })
        .eq('id', orden.id);

    if (errorOrdenCompra) {
        console.error('Error al aprobar orden de compra:', errorOrdenCompra);
        throw new Error(errorOrdenCompra.message);
    }

    const { error: errorRequisicion } = await supabase
        .from('requisicion_compra')
        .update({ estatus: 'Comprada' })
        .eq('id', orden.requisicion_id);

    if (errorRequisicion) console.error('Error al actualizar requisición:', errorRequisicion);
};
