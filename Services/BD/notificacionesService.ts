// Services/BD/notificacionesService.ts
import { supabase } from '../superbase.service';
import { getProductosStockBajo } from './inventario/inventarioService';

export type TipoNotificacion = 'stock_bajo' | 'mantenimiento' | 'combustible';

export interface Notificacion {
    id: string;
    tipo: TipoNotificacion;
    titulo: string;
    detalle: string;
    link: string;
}

// Ventana de tiempo para "quién está gastando más" — sin esto, un gasto viejo
// de hace un año seguiría apareciendo como el "más caro" para siempre.
const DIAS_VENTANA = 30;

const formatoMoneda = (monto: number) => `$${monto.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

const fetchNotificacionesStockBajo = async (): Promise<Notificacion[]> => {
    const productos = await getProductosStockBajo();
    return productos.map((p) => ({
        id: `stock-${p.id}`,
        tipo: 'stock_bajo',
        titulo: 'Stock bajo',
        detalle: `${p.nombre} — quedan ${p.stock_actual} ${p.unidad} (mínimo ${p.stock_minimo})`,
        link: '/inventario'
    }));
};

// Unidad (camión o maquinaria) con más gasto de mano de obra en bitácoras de
// taller en los últimos DIAS_VENTANA días. No incluye costo de refacciones
// (viven en orden_trabajo_detalle, ligadas por bitácora) — si más adelante se
// quiere el gasto total exacto, se puede sumar esa parte aquí también.
const fetchTopMantenimiento = async (): Promise<Notificacion | null> => {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - DIAS_VENTANA);

    const { data, error } = await supabase
        .from('fetch_bitacora_taller')
        .select('camion_id, maquinaria_id, camion_nombre, maquinaria_eco, maquinaria_equipo, costo_mano_obra, fecha_reporte')
        .gte('fecha_reporte', fechaLimite.toISOString());

    if (error) {
        console.error('Error obteniendo bitácoras para notificaciones:', error);
        return null;
    }

    const totales = new Map<string, { label: string; total: number }>();
    (data || []).forEach((b: any) => {
        const key = b.camion_id ? `camion-${b.camion_id}` : b.maquinaria_id ? `maquinaria-${b.maquinaria_id}` : null;
        if (!key) return;
        const label = b.camion_nombre || [b.maquinaria_eco, b.maquinaria_equipo].filter(Boolean).join(' - ') || 'Unidad';
        const actual = totales.get(key) || { label, total: 0 };
        actual.total += b.costo_mano_obra || 0;
        totales.set(key, actual);
    });

    const top = Array.from(totales.values()).sort((a, b) => b.total - a.total)[0];
    if (!top || top.total <= 0) return null;

    return {
        id: 'mantenimiento-top',
        tipo: 'mantenimiento',
        titulo: 'Mayor gasto en mantenimiento',
        detalle: `${top.label} — ${formatoMoneda(top.total)} en los últimos ${DIAS_VENTANA} días`,
        link: '/taller/rendimiento'
    };
};

// Unidad (camión o maquinaria) con más gasto en combustible en los últimos
// DIAS_VENTANA días.
const fetchTopCombustible = async (): Promise<Notificacion | null> => {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - DIAS_VENTANA);

    const { data, error } = await supabase
        .from('combustible')
        .select('camion_id, maquinaria_id, importe, m3(nombre), maquinaria(eco, equipo)')
        .gte('fecha', fechaLimite.toISOString().slice(0, 10));

    if (error) {
        console.error('Error obteniendo combustible para notificaciones:', error);
        return null;
    }

    const totales = new Map<string, { label: string; total: number }>();
    (data || []).forEach((c: any) => {
        const key = c.camion_id ? `camion-${c.camion_id}` : c.maquinaria_id ? `maquinaria-${c.maquinaria_id}` : null;
        if (!key) return;
        const label = c.m3?.nombre || [c.maquinaria?.eco, c.maquinaria?.equipo].filter(Boolean).join(' - ') || 'Unidad';
        const actual = totales.get(key) || { label, total: 0 };
        actual.total += c.importe || 0;
        totales.set(key, actual);
    });

    const top = Array.from(totales.values()).sort((a, b) => b.total - a.total)[0];
    if (!top || top.total <= 0) return null;

    return {
        id: 'combustible-top',
        tipo: 'combustible',
        titulo: 'Mayor gasto en combustible',
        detalle: `${top.label} — ${formatoMoneda(top.total)} en los últimos ${DIAS_VENTANA} días`,
        link: '/combustible'
    };
};

// Todas se calculan al momento (no se guardan en una tabla) — reflejan el
// estado actual cada vez que se llama, ideal para revisarlas al abrir el
// sistema en vez de necesitar un aviso en tiempo real.
export const fetchNotificaciones = async (): Promise<Notificacion[]> => {
    const [stockBajo, mantenimiento, combustible] = await Promise.all([
        fetchNotificacionesStockBajo().catch((error) => {
            console.error('Error obteniendo notificaciones de stock bajo:', error);
            return [] as Notificacion[];
        }),
        fetchTopMantenimiento(),
        fetchTopCombustible()
    ]);

    return [...stockBajo, ...(mantenimiento ? [mantenimiento] : []), ...(combustible ? [combustible] : [])];
};
