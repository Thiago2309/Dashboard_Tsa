import { supabase } from '../../superbase.service';
import { getProductos } from './inventarioService';

export type EstatusValidacion = 'En Proceso' | 'Finalizada';
export type EstatusDetalleValidacion = 'Pendiente' | 'Conforme' | 'Discrepancia';

export interface ValidacionInventario {
    id: number;
    fecha: string;
    fecha_finalizacion: string | null;
    usuario_id: string | null;
    estatus: EstatusValidacion;
    total_productos: number;
    total_conformes: number;
    total_discrepancias: number;
    notas: string | null;
}

export interface DetalleValidacionInventario {
    id: number;
    id_validacion: number;
    producto_id: number;
    stock_sistema: number;
    stock_fisico: number | null;
    diferencia: number | null;
    estatus: EstatusDetalleValidacion;
    observacion: string | null;
    // Relación con inventario
    inventario?: { codigo: string; nombre: string; categoria: string | null; unidad: string } | null;
}

// Buscar si ya hay una validación abierta (para poder retomarla si se recarga la página)
export const fetchValidacionEnProceso = async (): Promise<ValidacionInventario | null> => {
    const { data, error } = await supabase
        .from('validaciones_inventario')
        .select('*')
        .eq('estatus', 'En Proceso')
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error al buscar validación en proceso:', error);
        throw new Error(error.message);
    }
    return data || null;
};

// Iniciar una nueva validación: toma una foto del stock actual de cada producto
export const iniciarValidacionInventario = async (usuario_id?: string): Promise<ValidacionInventario> => {
    const productos = await getProductos();

    const { data: validacion, error } = await supabase
        .from('validaciones_inventario')
        .insert([{
            usuario_id: usuario_id || null,
            estatus: 'En Proceso',
            total_productos: productos.length,
            total_conformes: 0,
            total_discrepancias: 0
        }])
        .select()
        .single();

    if (error) {
        console.error('Error al iniciar validación de inventario:', error);
        throw new Error(error.message);
    }

    const detalles = productos.map((producto) => ({
        id_validacion: validacion.id,
        producto_id: producto.id,
        stock_sistema: producto.stock_actual,
        stock_fisico: null,
        diferencia: null,
        estatus: 'Pendiente' as EstatusDetalleValidacion,
        observacion: null
    }));

    if (detalles.length > 0) {
        const { error: errorDetalle } = await supabase.from('validaciones_inventario_detalle').insert(detalles);
        if (errorDetalle) {
            console.error('Error al crear el detalle de la validación:', errorDetalle);
            throw new Error(errorDetalle.message);
        }
    }

    return validacion;
};

// Obtener el detalle (lista de productos a pasar lista) de una validación
export const fetchDetalleValidacion = async (id_validacion: number): Promise<DetalleValidacionInventario[]> => {
    const { data, error } = await supabase
        .from('validaciones_inventario_detalle')
        .select('*, inventario(codigo, nombre, categoria, unidad)')
        .eq('id_validacion', id_validacion)
        .order('id', { ascending: true });

    if (error) {
        console.error('Error al obtener el detalle de la validación:', error);
        throw new Error(error.message);
    }
    return data || [];
};

// Marcar un producto como conforme (el físico coincide con el sistema)
export const marcarProductoConforme = async (id_detalle: number, stock_sistema: number): Promise<void> => {
    const { error } = await supabase
        .from('validaciones_inventario_detalle')
        .update({
            stock_fisico: stock_sistema,
            diferencia: 0,
            estatus: 'Conforme',
            observacion: null
        })
        .eq('id', id_detalle);

    if (error) {
        console.error('Error al marcar producto conforme:', error);
        throw new Error(error.message);
    }
};

// Marcar un producto con discrepancia (el físico contado no coincide con el sistema)
export const marcarProductoDiscrepancia = async (id_detalle: number, stock_sistema: number, stock_fisico: number, observacion?: string): Promise<void> => {
    const { error } = await supabase
        .from('validaciones_inventario_detalle')
        .update({
            stock_fisico,
            diferencia: stock_sistema - stock_fisico,
            estatus: 'Discrepancia',
            observacion: observacion || null
        })
        .eq('id', id_detalle);

    if (error) {
        console.error('Error al marcar producto con discrepancia:', error);
        throw new Error(error.message);
    }
};

// Finalizar la validación: calcula los totales y regresa el detalle con discrepancias para el reporte
export const finalizarValidacionInventario = async (id_validacion: number): Promise<{ validacion: ValidacionInventario; discrepancias: DetalleValidacionInventario[] }> => {
    const detalles = await fetchDetalleValidacion(id_validacion);

    const totalConformes = detalles.filter((d) => d.estatus === 'Conforme').length;
    const discrepancias = detalles.filter((d) => d.estatus === 'Discrepancia');

    const { data: validacion, error } = await supabase
        .from('validaciones_inventario')
        .update({
            estatus: 'Finalizada',
            fecha_finalizacion: new Date().toISOString(),
            total_conformes: totalConformes,
            total_discrepancias: discrepancias.length
        })
        .eq('id', id_validacion)
        .select()
        .single();

    if (error) {
        console.error('Error al finalizar la validación de inventario:', error);
        throw new Error(error.message);
    }

    return { validacion, discrepancias };
};

// Historial de validaciones finalizadas
export const fetchHistorialValidaciones = async (): Promise<ValidacionInventario[]> => {
    const { data, error } = await supabase
        .from('validaciones_inventario')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error al obtener el historial de validaciones:', error);
        throw new Error(error.message);
    }
    return data || [];
};
