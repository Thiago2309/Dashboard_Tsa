import { supabase } from '../../superbase.service';
import QRCode from 'qrcode';
import { crearCuentaPorPagar } from '../CxPService';

export interface Inventario {
    id: number;
    codigo_barras: string | null;
    codigo: string;
    nombre: string;
    categoria: string | null;
    descripcion: string | null;
    stock_actual: number;
    stock_minimo: number;
    stock_maximo: number | null;
    unidad: string;
    ubicacion: string | null;
    precio_compra: number | null;
    created_at: string;
    updated_at: string;
}

export interface MovimientoInventario {
    id: number;
    producto_id: number;
    tipo: 'entrada' | 'salida';
    cantidad: number;
    motivo: string | null;
    camion_id: number | null;
    usuario_id: string | null;
    fecha: string;
    costo_unitario?: number | null;
    orden_trabajo?: string | null;
    tipo_comprobante?: 'nota' | 'factura' | null;
    folio?: string | null;
    tipo_pago?: 'credito' | 'contado' | null;
    proveedor_id?: number | null;
    proveedor?: { nombre: string } | null;
    inventario?: { codigo: string; nombre: string; unidad: string } | null;
}

export interface Camion {
    id: number;
    nombre: string;
    placa: string;
    tipo: string;
    marca: string | null;
    modelo: string | null;
    estatus: string;
}

// Estatus de camiones
// 'Activo', 'Mantenimiento', 'Inactivo', 'Dado de Baja'

// ============================================
// PRODUCTOS CRUD
// ============================================

// Obtener todos los productos
export const getProductos = async (): Promise<Inventario[]> => {
    const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error al obtener productos:', error);
        throw new Error(error.message);
    }
    return data || [];
};

// Buscar productos por código o nombre
export const buscarProductos = async (termino: string): Promise<Inventario[]> => {
    const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .or(`codigo.ilike.%${termino}%,nombre.ilike.%${termino}%`)
        .order('id', { ascending: true });

    if (error) {
        console.error('Error al buscar productos:', error);
        throw new Error(error.message);
    }
    return data || [];
};

// Obtener camiones activos para dropdown
export const getCamionesActivos = async (): Promise<Camion[]> => {
    const { data, error } = await supabase
        .from('m3')
        .select('id, nombre, placa, tipo, marca, modelo, estatus')
        // .eq('estatus', 'Mantenimiento') // Solo mostrar camiones en mantenimiento para asignar salidas
        .order('nombre', { ascending: true });

    if (error) {
        console.error('Error al obtener camiones:', error);
        throw new Error(error.message);
    }
    return data || [];
};

// Filtrar productos por categoría
export const filtrarPorCategoria = async (categoria: string): Promise<Inventario[]> => {
    const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .eq('categoria', categoria)
        .order('id', { ascending: true });

    if (error) {
        console.error('Error al filtrar productos:', error);
        throw new Error(error.message);
    }
    return data || [];
};

// Obtener productos con stock bajo (stock_actual <= stock_minimo)
export const getProductosStockBajo = async (): Promise<Inventario[]> => {
    const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .order('stock_actual', { ascending: true });

    if (error) {
        console.error('Error al obtener productos con stock bajo:', error);
        throw new Error(error.message);
    }

    return (data || []).filter((item) => item.stock_actual <= item.stock_minimo);
};

// Obtener un producto por ID
export const getProductoById = async (id: number): Promise<Inventario | null> => {
    const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error al obtener producto:', error);
        return null;
    }
    return data;
};

// Crear producto con Codigo de Barras generado automáticamente basado en el ID del producto. El código de barras se genera como un número de 8 dígitos, rellenando con ceros a la izquierda si es necesario. Por ejemplo, si el ID del producto es 5, el código de barras será "00000005".
export const crearProducto = async (producto: Omit<Inventario, 'id' | 'created_at' | 'updated_at'>): Promise<Inventario> => {
    // 1. Crear el producto
    const { data, error } = await supabase
        .from('inventario')
        .insert([producto])
        .select()
        .single();

    if (error) {
        console.error('Error al crear producto:', error);
        throw new Error(error.message);
    }

    // 2. Generar código de barras (usando el ID o código del producto)
    const codigoBarras = `${data.id}`.padStart(8, '0'); // Ej: "00000005"
    // O usar el código del producto: data.codigo

    // 3. Guardar el código de barras
    const { data: updatedData, error: updateError } = await supabase
        .from('inventario')
        .update({ codigo_barras: codigoBarras })
        .eq('id', data.id)
        .select()
        .single();

    if (updateError) {
        console.error('Error al actualizar código de barras:', updateError);
        throw new Error(updateError.message);
    }

    return updatedData;
};

// Obtener producto por código de barras
export const getProductoByBarcode = async (codigoBarras: string): Promise<Inventario | null> => {
    const { data, error } = await supabase
        .from('inventario')
        .select('*')
        .eq('codigo_barras', codigoBarras)
        .single();

    if (error) {
        console.error('Error al obtener producto por código de barras:', error);
        return null;
    }
    return data;
};

// Actualizar producto
export const actualizarProducto = async (id: number, producto: Partial<Inventario>): Promise<Inventario> => {
    const { data, error } = await supabase
        .from('inventario')
        .update(producto)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error al actualizar producto:', error);
        throw new Error(error.message);
    }
    return data;
};

// Eliminar producto
export const eliminarProducto = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('inventario')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error al eliminar producto:', error);
        throw new Error(error.message);
    }
};

// ============================================
// MOVIMIENTOS (ENTRADAS Y SALIDAS)
// ============================================

export interface RegistrarEntradaParams {
    producto_id: number;
    cantidad: number;
    motivo: string;
    usuario_id?: string;
    costo_unitario?: number | null;
    tipo_comprobante?: 'nota' | 'factura' | null;
    folio?: string | null;
    tipo_pago?: 'credito' | 'contado' | null;
    proveedor_id?: number | null;
}

// Registrar entrada de producto (compra)
export const registrarEntrada = async (params: RegistrarEntradaParams): Promise<void> => {
    const { producto_id, cantidad, motivo, usuario_id, costo_unitario, tipo_comprobante, folio, tipo_pago, proveedor_id } = params;

    // 1. Obtener producto actual
    const producto = await getProductoById(producto_id);
    if (!producto) throw new Error('Producto no encontrado');

    // 2. Actualizar stock (y precio por unidad si se capturó uno nuevo)
    const nuevoStock = producto.stock_actual + cantidad;
    const actualizacion: Partial<Inventario> = { stock_actual: nuevoStock };
    if (costo_unitario != null) actualizacion.precio_compra = costo_unitario;
    await actualizarProducto(producto_id, actualizacion);

    // 3. Registrar movimiento
    const { error } = await supabase
        .from('movimientos_inventario')
        .insert([{
            producto_id,
            tipo: 'entrada',
            cantidad,
            motivo,
            usuario_id: usuario_id || null,
            camion_id: null,
            fecha: new Date().toISOString(),
            costo_unitario: costo_unitario ?? null,
            tipo_comprobante: tipo_comprobante ?? null,
            folio: folio ?? null,
            tipo_pago: tipo_pago ?? null,
            proveedor_id: proveedor_id ?? null
        }]);

    if (error) {
        console.error('Error al registrar entrada:', error);
        throw new Error(error.message);
    }

    // 4. Si la compra fue a crédito y hay proveedor, generar la cuenta por pagar
    if (tipo_pago === 'credito' && proveedor_id && costo_unitario) {
        await crearCuentaPorPagar({
            id_entidad: proveedor_id,
            tipo_entidad: 'Proveedor',
            id_compra: null,
            fecha: new Date().toISOString(),
            monto: 0,
            saldo: costo_unitario * cantidad,
            estatus: 'Pendiente',
            notas: `Compra de inventario: ${producto.nombre} (${cantidad} ${producto.unidad})${folio ? ` - Folio ${folio}` : ''}`
        });
    }
};

export interface RegistrarSalidaParams {
    producto_id: number;
    cantidad: number;
    motivo: string;
    orden_trabajo: string;
    camion_id?: number;
    usuario_id?: string;
    costo_unitario?: number | null;
}

// Registrar salida de producto
export const registrarSalida = async (params: RegistrarSalidaParams): Promise<void> => {
    const { producto_id, cantidad, motivo, orden_trabajo, camion_id, usuario_id, costo_unitario } = params;

    // 1. Obtener producto actual
    const producto = await getProductoById(producto_id);
    if (!producto) throw new Error('Producto no encontrado');

    // 2. Verificar stock suficiente
    if (producto.stock_actual < cantidad) {
        throw new Error(`Stock insuficiente. Disponible: ${producto.stock_actual} ${producto.unidad}`);
    }

    // 3. Actualizar stock
    const nuevoStock = producto.stock_actual - cantidad;
    await actualizarProducto(producto_id, { stock_actual: nuevoStock });

    // 4. Registrar movimiento (el costo por unidad respeta el que tenía el producto si no se especifica otro)
    const { error } = await supabase
        .from('movimientos_inventario')
        .insert([{
            producto_id,
            tipo: 'salida',
            cantidad,
            motivo,
            orden_trabajo,
            camion_id: camion_id || null,
            usuario_id: usuario_id || null,
            fecha: new Date().toISOString(),
            costo_unitario: costo_unitario ?? producto.precio_compra ?? null
        }]);

    if (error) {
        console.error('Error al registrar salida:', error);
        throw new Error(error.message);
    }
};

// Obtener movimientos de un producto
export const getMovimientosByProducto = async (producto_id: number): Promise<MovimientoInventario[]> => {
    const { data, error } = await supabase
        .from('movimientos_inventario')
        .select('*, inventario(codigo, nombre, unidad), proveedor(nombre)')
        .eq('producto_id', producto_id)
        .order('fecha', { ascending: false });

    if (error) {
        console.error('Error al obtener movimientos:', error);
        throw new Error(error.message);
    }
    return data || [];
};

// Obtener todos los movimientos (historial general)
export const getAllMovimientos = async (): Promise<MovimientoInventario[]> => {
    const { data, error } = await supabase
        .from('movimientos_inventario')
        .select('*, inventario(codigo, nombre, unidad), proveedor(nombre)')
        .order('fecha', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Error al obtener movimientos:', error);
        throw new Error(error.message);
    }
    return data || [];
};

// ============================================
// ESTADÍSTICAS DE ROTACIÓN (PARA SABER QUÉ COMPRAR)
// ============================================

export type RecomendacionCompra = 'Comprar más' | 'Mantener' | 'Comprar menos' | 'Sin movimiento';

export interface EstadisticaProducto {
    producto_id: number;
    codigo: string;
    nombre: string;
    categoria: string | null;
    unidad: string;
    stock_actual: number;
    stock_minimo: number;
    cantidad_salida: number;
    num_movimientos: number;
    costo_total_salida: number;
    recomendacion: RecomendacionCompra;
}

// Analiza las salidas de los últimos `dias` para saber qué producto se mueve más (comprar más)
// y cuál se mueve menos (comprar menos), para orientar las compras de almacén.
export const getEstadisticasMovimientos = async (dias: number = 30): Promise<EstadisticaProducto[]> => {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);

    const [productos, salidas] = await Promise.all([
        getProductos(),
        (async () => {
            const { data, error } = await supabase
                .from('movimientos_inventario')
                .select('producto_id, cantidad, costo_unitario')
                .eq('tipo', 'salida')
                .gte('fecha', fechaLimite.toISOString());

            if (error) {
                console.error('Error al obtener salidas para estadísticas:', error);
                throw new Error(error.message);
            }
            return data || [];
        })()
    ]);

    // Agrupar salidas por producto
    const salidasPorProducto = new Map<number, { cantidad: number; movimientos: number; costo: number }>();
    salidas.forEach((mov: any) => {
        const actual = salidasPorProducto.get(mov.producto_id) || { cantidad: 0, movimientos: 0, costo: 0 };
        actual.cantidad += mov.cantidad || 0;
        actual.movimientos += 1;
        actual.costo += (mov.costo_unitario || 0) * (mov.cantidad || 0);
        salidasPorProducto.set(mov.producto_id, actual);
    });

    const estadisticas: EstadisticaProducto[] = productos.map((producto) => {
        const agregado = salidasPorProducto.get(producto.id) || { cantidad: 0, movimientos: 0, costo: 0 };
        return {
            producto_id: producto.id,
            codigo: producto.codigo,
            nombre: producto.nombre,
            categoria: producto.categoria,
            unidad: producto.unidad,
            stock_actual: producto.stock_actual,
            stock_minimo: producto.stock_minimo,
            cantidad_salida: agregado.cantidad,
            num_movimientos: agregado.movimientos,
            costo_total_salida: agregado.costo,
            recomendacion: 'Mantener' // se ajusta abajo con el ranking
        };
    });

    // Solo se rankean los productos que sí tuvieron movimiento en el periodo
    const conMovimiento = estadisticas.filter((e) => e.cantidad_salida > 0).sort((a, b) => b.cantidad_salida - a.cantidad_salida);

    const top30 = Math.max(1, Math.ceil(conMovimiento.length * 0.3));
    const bottom30 = Math.max(1, Math.ceil(conMovimiento.length * 0.3));

    conMovimiento.forEach((estadistica, index) => {
        if (index < top30) {
            estadistica.recomendacion = 'Comprar más';
        } else if (index >= conMovimiento.length - bottom30) {
            estadistica.recomendacion = 'Comprar menos';
        } else {
            estadistica.recomendacion = 'Mantener';
        }
    });

    estadisticas.forEach((estadistica) => {
        if (estadistica.cantidad_salida === 0) {
            estadistica.recomendacion = 'Sin movimiento';
        }
    });

    return estadisticas.sort((a, b) => b.cantidad_salida - a.cantidad_salida);
};

// Obtener categorías únicas
export const getCategorias = async (): Promise<string[]> => {
    const { data, error } = await supabase
        .from('inventario')
        .select('categoria')
        .not('categoria', 'is', null);

    if (error) {
        console.error('Error al obtener categorías:', error);
        throw new Error(error.message);
    }

    const categorias = Array.from(new Set(data.map(item => item.categoria).filter(Boolean)));
    return categorias as string[];
};