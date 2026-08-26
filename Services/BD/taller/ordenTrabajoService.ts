import { supabase } from '../../superbase.service';
import { registrarSalida } from '../inventario/inventarioService';
import { BitacoraTaller } from './bitacoraTallerService';

export type EstatusOrdenTrabajo = 'Pendiente' | 'Parcialmente Surtida' | 'Surtida' | 'Cancelada';

export interface OrdenTrabajo {
    id: number;
    bitacora_id: number;
    tipo_equipo: 'camion' | 'maquinaria';
    camion_id: number | null;
    maquinaria_id: number | null;
    estatus: EstatusOrdenTrabajo;
    creado_por: string | null;
    fecha_creacion: string;
    fecha_surtido: string | null;
    // Datos de contexto, resueltos en el cliente (no columnas reales)
    numero?: string;
    equipoLabel?: string;
    motivoBitacora?: string | null;
}

export interface OrdenTrabajoDetalle {
    id: number;
    orden_trabajo_id: number;
    producto_id: number;
    cantidad_solicitada: number;
    stock_al_solicitar: number;
    excede_stock: boolean;
    costo_unitario: number | null;
    surtido: boolean;
    cantidad_surtida: number;
    created_at?: string;
    producto_codigo?: string;
    producto_nombre?: string;
    producto_unidad?: string;
    stock_actual?: number;
}

export const numeroOrden = (id: number) => `OT-${String(id).padStart(6, '0')}`;

// Genera (o recupera, si ya existe) la orden de trabajo de una bitácora
export const generarOrGetOrdenTrabajo = async (bitacora: BitacoraTaller, creadoPor: string | null): Promise<OrdenTrabajo> => {
    const existente = await fetchOrdenTrabajoPorBitacora(bitacora.id!);
    if (existente) return existente;

    const { data, error } = await supabase
        .from('orden_trabajo')
        .insert([{
            bitacora_id: bitacora.id,
            tipo_equipo: bitacora.tipo_equipo,
            camion_id: bitacora.camion_id,
            maquinaria_id: bitacora.maquinaria_id,
            creado_por: creadoPor,
            estatus: 'Pendiente'
        }])
        .select()
        .single();

    if (error) {
        console.error('Error al generar orden de trabajo:', error);
        throw new Error(error.message);
    }
    return { ...data, numero: numeroOrden(data.id) };
};

export const fetchOrdenTrabajoPorBitacora = async (bitacoraId: number): Promise<OrdenTrabajo | null> => {
    const { data, error } = await supabase
        .from('orden_trabajo')
        .select('*')
        .eq('bitacora_id', bitacoraId)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error al buscar orden de trabajo:', error);
        throw new Error(error.message);
    }
    return data ? { ...data, numero: numeroOrden(data.id) } : null;
};

export const fetchOrdenesTrabajo = async (): Promise<OrdenTrabajo[]> => {
    const { data, error } = await supabase
        .from('orden_trabajo')
        .select('*, bitacora_taller(motivo, m3(nombre, placa), maquinaria(eco, equipo))')
        .order('fecha_creacion', { ascending: false });

    if (error) {
        console.error('Error al obtener órdenes de trabajo:', error);
        throw new Error(error.message);
    }

    return (data || []).map((o: any) => ({
        ...o,
        numero: numeroOrden(o.id),
        motivoBitacora: o.bitacora_taller?.motivo || null,
        equipoLabel: o.tipo_equipo === 'camion'
            ? `${o.bitacora_taller?.m3?.nombre || 'Camión'} (${o.bitacora_taller?.m3?.placa || 's/placa'})`
            : `${o.bitacora_taller?.maquinaria?.eco ? o.bitacora_taller.maquinaria.eco + ' - ' : ''}${o.bitacora_taller?.maquinaria?.equipo || 'Maquinaria'}`
    }));
};

export const fetchDetalleOrden = async (ordenTrabajoId: number): Promise<OrdenTrabajoDetalle[]> => {
    const { data, error } = await supabase
        .from('orden_trabajo_detalle')
        .select('*, inventario(codigo, nombre, unidad, stock_actual)')
        .eq('orden_trabajo_id', ordenTrabajoId)
        .order('id', { ascending: true });

    if (error) {
        console.error('Error al obtener detalle de la orden:', error);
        throw new Error(error.message);
    }

    return (data || []).map((d: any) => ({
        ...d,
        producto_codigo: d.inventario?.codigo,
        producto_nombre: d.inventario?.nombre,
        producto_unidad: d.inventario?.unidad,
        stock_actual: d.inventario?.stock_actual
    }));
};

export interface AgregarProductoResultado {
    detalle: OrdenTrabajoDetalle;
    excedeStock: boolean;
    requisicionCreada: boolean;
}

// Agrega un producto a la orden. Si la cantidad excede el stock disponible,
// marca la línea y crea automáticamente una requisición de compra por la diferencia.
export const agregarProductoAOrden = async (
    ordenTrabajoId: number,
    producto: { id: number; stock_actual: number; precio_compra: number | null },
    cantidad: number
): Promise<AgregarProductoResultado> => {
    const excedeStock = cantidad > producto.stock_actual;

    const { data, error } = await supabase
        .from('orden_trabajo_detalle')
        .insert([{
            orden_trabajo_id: ordenTrabajoId,
            producto_id: producto.id,
            cantidad_solicitada: cantidad,
            stock_al_solicitar: producto.stock_actual,
            excede_stock: excedeStock,
            costo_unitario: producto.precio_compra
        }])
        .select()
        .single();

    if (error) {
        console.error('Error al agregar producto a la orden:', error);
        throw new Error(error.message);
    }

    let requisicionCreada = false;
    if (excedeStock) {
        const { error: errorRequisicion } = await supabase
            .from('requisicion_compra')
            .insert([{
                orden_trabajo_id: ordenTrabajoId,
                orden_trabajo_detalle_id: data.id,
                producto_id: producto.id,
                cantidad_faltante: cantidad - producto.stock_actual
            }]);

        if (errorRequisicion) {
            console.error('Error al crear requisición de compra:', errorRequisicion);
        } else {
            requisicionCreada = true;
        }
    }

    return { detalle: data, excedeStock, requisicionCreada };
};

export const eliminarProductoDeOrden = async (detalleId: number): Promise<void> => {
    const { error } = await supabase.from('orden_trabajo_detalle').delete().eq('id', detalleId);
    if (error) {
        console.error('Error al eliminar producto de la orden:', error);
        throw new Error(error.message);
    }
};

export interface ResultadoAprobacion {
    surtidas: number;
    fallidas: { producto: string; error: string }[];
}

// Recalcula el estatus de la orden según cuántas líneas ya quedaron surtidas
// (se usa tanto al aprobar salida desde Almacén como al surtir por una compra).
const actualizarEstatusOrdenTrabajo = async (ordenTrabajoId: number): Promise<void> => {
    const detalle = await fetchDetalleOrden(ordenTrabajoId);
    const surtidas = detalle.filter(d => d.surtido).length;
    const nuevoEstatus: EstatusOrdenTrabajo = detalle.length > 0 && surtidas === detalle.length
        ? 'Surtida'
        : surtidas > 0 ? 'Parcialmente Surtida' : 'Pendiente';

    await supabase
        .from('orden_trabajo')
        .update({ estatus: nuevoEstatus, fecha_surtido: nuevoEstatus === 'Surtida' ? new Date().toISOString() : null })
        .eq('id', ordenTrabajoId);
};

// Aprueba la salida de todo lo pedido: descuenta stock real y registra el
// movimiento en Almacén, ligado al camión/maquinaria de la orden.
export const aprobarSalidaOrden = async (orden: OrdenTrabajo, usuarioId: string | null): Promise<ResultadoAprobacion> => {
    const detalle = await fetchDetalleOrden(orden.id);
    const pendientes = detalle.filter(d => !d.surtido);
    const resultado: ResultadoAprobacion = { surtidas: 0, fallidas: [] };

    for (const linea of pendientes) {
        try {
            await registrarSalida({
                producto_id: linea.producto_id,
                cantidad: linea.cantidad_solicitada,
                motivo: `Orden de Trabajo ${numeroOrden(orden.id)}`,
                orden_trabajo: numeroOrden(orden.id),
                camion_id: orden.tipo_equipo === 'camion' ? orden.camion_id || undefined : undefined,
                maquinaria_id: orden.tipo_equipo === 'maquinaria' ? orden.maquinaria_id || undefined : undefined,
                usuario_id: usuarioId || undefined,
                costo_unitario: linea.costo_unitario
            });

            await supabase
                .from('orden_trabajo_detalle')
                .update({ surtido: true, cantidad_surtida: linea.cantidad_solicitada })
                .eq('id', linea.id);

            resultado.surtidas += 1;
        } catch (error: any) {
            resultado.fallidas.push({ producto: linea.producto_nombre || `Producto ${linea.producto_id}`, error: error.message });
        }
    }

    await actualizarEstatusOrdenTrabajo(orden.id);

    return resultado;
};

// Se llama cuando Compras aprueba la orden de compra que cubría el faltante
// de esta línea: ya hay stock, así que se surte automáticamente sin que
// Almacén tenga que hacer nada más.
export const surtirLineaPendientePorCompra = async (detalleId: number, ordenTrabajoId: number, usuarioId: string | null): Promise<void> => {
    const { data: detalle, error: errorDetalle } = await supabase
        .from('orden_trabajo_detalle')
        .select('*')
        .eq('id', detalleId)
        .single();

    if (errorDetalle || !detalle || detalle.surtido) return;

    const { data: orden, error: errorOrden } = await supabase
        .from('orden_trabajo')
        .select('*')
        .eq('id', ordenTrabajoId)
        .single();

    if (errorOrden || !orden) return;

    try {
        await registrarSalida({
            producto_id: detalle.producto_id,
            cantidad: detalle.cantidad_solicitada,
            motivo: `Orden de Trabajo ${numeroOrden(orden.id)} (surtida tras compra)`,
            orden_trabajo: numeroOrden(orden.id),
            camion_id: orden.tipo_equipo === 'camion' ? orden.camion_id || undefined : undefined,
            maquinaria_id: orden.tipo_equipo === 'maquinaria' ? orden.maquinaria_id || undefined : undefined,
            usuario_id: usuarioId || undefined,
            costo_unitario: detalle.costo_unitario
        });

        await supabase
            .from('orden_trabajo_detalle')
            .update({ surtido: true, cantidad_surtida: detalle.cantidad_solicitada })
            .eq('id', detalle.id);

        await actualizarEstatusOrdenTrabajo(orden.id);
    } catch (error) {
        console.error('No se pudo surtir automáticamente tras la compra:', error);
    }
};
