import { supabase } from '../superbase.service';

// Historial de precios por fecha de cada ruta Origen-Destino (tabla precio_origen_destino_historial).
// Cada renglón es "a partir de vigente_desde, la ruta cuesta precio_unidad / precio_materia". El precio de
// un viaje es el del renglón vigente en la fecha del viaje (INC-0025).

export interface PrecioHistorial {
    id?: number;
    id_precio_origen_destino: number;
    precio_unidad: number;
    precio_materia: number;
    vigente_desde: string; // YYYY-MM-DD
    created_at?: string;
}

export interface PrecioVigente {
    precio_unidad: number;
    precio_materia: number;
}

// Fecha base con la que se cargó el precio inicial de cada ruta ("desde siempre").
export const FECHA_BASE_HISTORIAL = '1900-01-01';

export const hoyIso = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Normaliza la fecha de un viaje (puede venir como 'YYYY-MM-DD', ISO con hora o Date) a 'YYYY-MM-DD'.
export const fechaViajeAIso = (fecha: string | Date | null | undefined): string => {
    if (!fecha) return hoyIso();
    if (fecha instanceof Date) return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
    return String(fecha).slice(0, 10);
};

const transformPrecioHistorialData = (data: any): PrecioHistorial => ({
    id: data.id,
    id_precio_origen_destino: data.id_precio_origen_destino,
    precio_unidad: Number(data.precio_unidad) || 0,
    precio_materia: Number(data.precio_materia) || 0,
    vigente_desde: data.vigente_desde,
    created_at: data.created_at
});

export const fetchHistorialDeRuta = async (id_precio_origen_destino: number): Promise<PrecioHistorial[]> => {
    const { data, error } = await supabase.from('precio_origen_destino_historial').select('*').eq('id_precio_origen_destino', id_precio_origen_destino).order('vigente_desde', { ascending: false });

    if (error) {
        console.error('Error fetching historial de precios:', error);
        throw error;
    }

    return (data || []).map(transformPrecioHistorialData);
};

// Mapa ruta → renglones de historial ordenados del más reciente al más antiguo. Útil cuando hay que
// resolver el precio de muchos viajes a la vez (carga masiva) sin una consulta por viaje.
export type MapaHistorialPrecios = Map<number, PrecioHistorial[]>;

export const cargarMapaHistorialPrecios = async (): Promise<MapaHistorialPrecios> => {
    const { data, error } = await supabase.from('precio_origen_destino_historial').select('*').order('vigente_desde', { ascending: false });

    if (error) {
        // Sin historial se usa el precio del catálogo como respaldo (comportamiento anterior).
        console.error('Error cargando historial de precios, se usará el precio del catálogo:', error);
        return new Map();
    }

    const mapa: MapaHistorialPrecios = new Map();
    (data || []).map(transformPrecioHistorialData).forEach((h) => {
        const lista = mapa.get(h.id_precio_origen_destino) || [];
        lista.push(h);
        mapa.set(h.id_precio_origen_destino, lista);
    });
    return mapa;
};

// Precio vigente de la ruta en la fecha dada, usando el mapa ya cargado. Si la ruta no tiene historial
// (p.ej. se creó antes de correr el script), se usa el precio del catálogo que se pasa como respaldo.
export const precioVigenteDesdeMapa = (mapa: MapaHistorialPrecios, id_precio_origen_destino: number, fecha: string, respaldo: PrecioVigente): PrecioVigente => {
    const vigente = (mapa.get(id_precio_origen_destino) || []).find((h) => h.vigente_desde <= fecha);
    return vigente ? { precio_unidad: vigente.precio_unidad, precio_materia: vigente.precio_materia } : respaldo;
};

// Precio vigente de UNA ruta en una fecha (una sola consulta). Para captura individual de viajes.
export const obtenerPrecioVigente = async (id_precio_origen_destino: number, fecha: string, respaldo: PrecioVigente): Promise<PrecioVigente> => {
    const { data, error } = await supabase
        .from('precio_origen_destino_historial')
        .select('precio_unidad, precio_materia')
        .eq('id_precio_origen_destino', id_precio_origen_destino)
        .lte('vigente_desde', fecha)
        .order('vigente_desde', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error obteniendo precio vigente de la ruta, se usará el precio del catálogo:', error);
        return respaldo;
    }

    return data ? { precio_unidad: Number(data.precio_unidad) || 0, precio_materia: Number(data.precio_materia) || 0 } : respaldo;
};

// Registra (o corrige, si ya hay uno con la misma fecha) el precio de la ruta a partir de una fecha.
export const registrarPrecioEnHistorial = async (id_precio_origen_destino: number, precio: PrecioVigente, vigente_desde: string): Promise<void> => {
    const { error } = await supabase
        .from('precio_origen_destino_historial')
        .upsert([{ id_precio_origen_destino, precio_unidad: precio.precio_unidad, precio_materia: precio.precio_materia, vigente_desde }], { onConflict: 'id_precio_origen_destino,vigente_desde' });

    if (error) {
        console.error('Error registrando precio en el historial:', error);
        throw error;
    }
};

// Fecha del siguiente cambio de precio después de `fecha` (exclusiva), o null si no hay. Un cambio de
// precio con fecha en el pasado solo debe recalcular los viajes hasta donde empieza el siguiente precio.
export const siguienteCambioDePrecio = async (id_precio_origen_destino: number, fecha: string): Promise<string | null> => {
    const { data, error } = await supabase
        .from('precio_origen_destino_historial')
        .select('vigente_desde')
        .eq('id_precio_origen_destino', id_precio_origen_destino)
        .gt('vigente_desde', fecha)
        .order('vigente_desde', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error buscando el siguiente cambio de precio:', error);
        throw error;
    }

    return data?.vigente_desde ?? null;
};
