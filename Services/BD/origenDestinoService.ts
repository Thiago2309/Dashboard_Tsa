import { supabase } from '../superbase.service';
import { fetchAllRows } from './supabasePagination';
import { calcularImporteFlete } from './viajeService';
import { FECHA_BASE_HISTORIAL, fetchHistorialDeRuta, hoyIso, PrecioVigente, registrarPrecioEnHistorial, siguienteCambioDePrecio } from './precioHistorialService';

export interface OrigenDestino {
    id?: number;
    nombreorigen: string;
    nombredestino: string;
    precio_unidad: number;   // Precio Flete
    precio_materia: number;  // Precio Material
    status?: boolean;
}

// Helper function to transform Supabase response to OrigenDestino interface
const transformOrigenDestinoData = (data: any): OrigenDestino => ({
    id: data.id,
    nombreorigen: data.nombreorigen,
    nombredestino: data.nombredestino,
    precio_unidad: data.precio_unidad,
    precio_materia: data.precio_materia ?? 0,
    status: data.status ?? true,
});

// Obtener todos los registros de Origen Destino
export const fetchOrigenDestino = async (): Promise<OrigenDestino[]> => {
    const { data, error } = await supabase
        .from('fetch_origen_destino') // Nombre de la tabla
        .select('*')
        .order('status', { ascending: false })  // Mostrar activos primero
        .order('nombreorigen');

    if (error) {
        console.error('Error fetching Origen Destino:', error);
        throw error;
    }

    return data?.map(transformOrigenDestinoData) || [];
};

// Obtener solo los registros activos (status = true)
export const fetchOrigenDestinoActivos = async (): Promise<OrigenDestino[]> => {
    const { data, error } = await supabase
        .from('fetch_origen_destino')  // Usa la vista
        .select('*')
        .eq('status', true)  // Solo activos
        .order('nombreorigen');

    if (error) {
        console.error('Error fetching Origen Destino activos:', error);
        throw error;
    }

    return data?.map(transformOrigenDestinoData) || [];
};

// Crear un nuevo registro de Origen Destino
export const createOrigenDestino = async (origenDestino: Omit<OrigenDestino, 'id'>): Promise<OrigenDestino> => {
    const { data, error } = await supabase
        .from('fetch_origen_destino')
        .insert([{
            nombreorigen: origenDestino.nombreorigen,
            nombredestino: origenDestino.nombredestino,
            precio_unidad: origenDestino.precio_unidad,
            precio_materia: origenDestino.precio_materia ?? 0,
            status: origenDestino.status ?? true
        }])
        .select('*')
        .single();

    if (error) {
        console.error('Error creating Origen Destino:', error);
        throw error;
    }

    // Precio base de la ruta en el historial ("desde siempre").
    await registrarPrecioEnHistorial(data.id, { precio_unidad: data.precio_unidad, precio_materia: data.precio_materia ?? 0 }, FECHA_BASE_HISTORIAL);

    return transformOrigenDestinoData(data);
};

// Actualizar un registro de Origen Destino
export const updateOrigenDestino = async (origenDestino: OrigenDestino): Promise<OrigenDestino> => {
    const { data: anterior } = await supabase.from('precio_origen_destino').select('precio_unidad, precio_materia').eq('id', origenDestino.id).maybeSingle();

    const { data, error } = await supabase
        .from('fetch_origen_destino')
        .update({
            nombreorigen: origenDestino.nombreorigen,
            nombredestino: origenDestino.nombredestino,
            precio_unidad: origenDestino.precio_unidad,
            precio_materia: origenDestino.precio_materia ?? 0,
            status: origenDestino.status ?? true
        })
        .eq('id', origenDestino.id)
        .select('*')
        .single();

    if (error) {
        console.error('Error updating Origen Destino:', error);
        throw error;
    }

    // Cambiar el precio desde el lápiz aplica a partir de HOY (sin recalcular viajes ya capturados):
    // se registra en el historial para que los viajes con fecha anterior sigan tomando el precio anterior.
    const cambioPrecio = anterior && (Number(anterior.precio_unidad) !== origenDestino.precio_unidad || Number(anterior.precio_materia ?? 0) !== (origenDestino.precio_materia ?? 0));
    if (cambioPrecio) {
        await registrarPrecioEnHistorial(origenDestino.id!, { precio_unidad: origenDestino.precio_unidad, precio_materia: origenDestino.precio_materia ?? 0 }, hoyIso());
    }

    return transformOrigenDestinoData(data);
};

// Alternar estado (status)
export const toggleStatusOrigenDestino = async (id: number, status: boolean): Promise<OrigenDestino> => {
    const { data, error } = await supabase
        .from('fetch_origen_destino')
        .update({ status })
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        console.error('Error toggling status:', error);
        throw error;
    }

    return transformOrigenDestinoData(data);
};

// Eliminar un registro de Origen Destino
export const deleteOrigenDestino = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('fetch_origen_destino')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting Origen Destino:', error);
        throw error;
    }
};

// ─── INC-0025 · Cambio de precio a partir de una fecha (con historial de precios) ────────────────

// Estatus que ya no se recalculan: lo facturado o pagado se respeta tal cual quedó.
const ESTATUS_PROTEGIDOS = ['facturado', 'pagado'];

export interface ResultadoCambioPrecio {
    viajesActualizados: number;
    viajesProtegidos: number; // facturados/pagados dentro del rango, que se dejaron igual
    fechaHasta: string | null; // fecha (exclusiva) donde empieza el siguiente precio, si existe
}

interface ViajeParaRecalcular {
    id: number;
    id_m3: number | null;
    en_renta: boolean | null;
    horas_renta: number | null;
    cantidad_viajes: number | null;
    caphrsviajes: number | null;
    total_materia: number | null;
    precio_unidad_viaje: number | null;
    precio_materia_viaje: number | null;
    estatus: string | null;
}

// Deja en el catálogo el precio vigente HOY según el historial (es el que se muestra en la lista y se
// usa como respaldo). Si el cambio es a futuro, el catálogo sigue con el precio actual hasta esa fecha.
const sincronizarPrecioCatalogo = async (id: number): Promise<PrecioVigente | null> => {
    const historial = await fetchHistorialDeRuta(id);
    const hoy = hoyIso();
    const vigente = historial.find((h) => h.vigente_desde <= hoy);
    if (!vigente) return null;

    const { error } = await supabase.from('precio_origen_destino').update({ precio_unidad: vigente.precio_unidad, precio_materia: vigente.precio_materia }).eq('id', id);
    if (error) {
        console.error('Error actualizando el precio de la ruta:', error);
        throw error;
    }
    return { precio_unidad: vigente.precio_unidad, precio_materia: vigente.precio_materia };
};

// Registra el nuevo precio de la ruta a partir de `fechaDesde` (YYYY-MM-DD) en el historial y recalcula,
// en su mismo registro, los viajes de esa ruta desde esa fecha y hasta donde empieza el siguiente cambio
// de precio (si hay uno posterior ya registrado). Los viajes anteriores y los facturados/pagados no se
// tocan. No se borra ni se mueve ningún viaje: solo se actualizan sus importes y su precio guardado.
export const actualizarPrecioOrigenDestinoDesdeFecha = async (
    id: number,
    nuevoPrecioUnidad: number,
    nuevoPrecioMateria: number,
    fechaDesde: string
): Promise<ResultadoCambioPrecio & { precioCatalogo: PrecioVigente | null }> => {
    await registrarPrecioEnHistorial(id, { precio_unidad: nuevoPrecioUnidad, precio_materia: nuevoPrecioMateria }, fechaDesde);
    const fechaHasta = await siguienteCambioDePrecio(id, fechaDesde);

    const [viajes, { data: m3Data, error: errorM3 }] = await Promise.all([
        fetchAllRows<ViajeParaRecalcular>((sb, from, to) => {
            let q = sb
                .from('viajes')
                .select('id, id_m3, en_renta, horas_renta, cantidad_viajes, caphrsviajes, total_materia, precio_unidad_viaje, precio_materia_viaje, estatus')
                .eq('id_precio_origen_destino', id)
                .gte('fecha', fechaDesde);
            if (fechaHasta) q = q.lt('fecha', fechaHasta);
            return q.order('id').range(from, to);
        }),
        supabase.from('m3').select('id, metros_cubicos')
    ]);
    if (errorM3) {
        console.error('Error leyendo M3:', errorM3);
        throw errorM3;
    }

    const m3PorId = new Map((m3Data || []).map((m: any) => [m.id, Number(m.metros_cubicos) || 0]));
    const aRecalcular = viajes.filter((v) => !ESTATUS_PROTEGIDOS.includes((v.estatus || '').toLowerCase()));

    const cambios = aRecalcular.map((v) => {
        const metrosCubicos = v.id_m3 ? m3PorId.get(v.id_m3) || 0 : 0;
        const cambio: Record<string, number | null> = { precio_unidad_viaje: nuevoPrecioUnidad };

        if (metrosCubicos > 0) {
            cambio.caphrsviajes = calcularImporteFlete(nuevoPrecioUnidad, metrosCubicos, v);
        } else if (v.caphrsviajes && v.precio_unidad_viaje) {
            // Viaje con M3 manual (camión externo, sin M3 de catálogo): se escala en proporción al precio.
            cambio.caphrsviajes = (v.caphrsviajes * nuevoPrecioUnidad) / v.precio_unidad_viaje;
        }

        // El material solo se recalcula si el viaje ya traía material y su precio es distinto: así no se le
        // agrega material a viajes que nunca lo cobraron.
        if ((v.total_materia || 0) > 0 && Number(v.precio_materia_viaje ?? -1) !== nuevoPrecioMateria) {
            cambio.precio_materia_viaje = nuevoPrecioMateria;
            if (metrosCubicos > 0) {
                cambio.total_materia = nuevoPrecioMateria > 0 ? nuevoPrecioMateria * metrosCubicos : 0; // NOT NULL en la BD
            } else if (v.total_materia && v.precio_materia_viaje) {
                cambio.total_materia = (v.total_materia * nuevoPrecioMateria) / v.precio_materia_viaje;
            }
        }

        return { id: v.id, cambio };
    });

    const precioCatalogo = await sincronizarPrecioCatalogo(id);

    const TANDA = 25;
    for (let i = 0; i < cambios.length; i += TANDA) {
        const resultados = await Promise.all(cambios.slice(i, i + TANDA).map(({ id: idViaje, cambio }) => supabase.from('viajes').update(cambio).eq('id', idViaje)));
        const fallo = resultados.find((r) => r.error);
        if (fallo?.error) {
            console.error('Error recalculando viajes con el nuevo precio:', fallo.error);
            throw fallo.error;
        }
    }

    return { viajesActualizados: cambios.length, viajesProtegidos: viajes.length - aRecalcular.length, fechaHasta, precioCatalogo };
};

// Vista previa para el diálogo: cuántos viajes de la ruta se recalcularían (desde la fecha y hasta el
// siguiente cambio de precio, si lo hay) y cuántos se respetan por estar facturados/pagados.
export const contarViajesAfectadosPorCambioPrecio = async (id: number, fechaDesde: string): Promise<ResultadoCambioPrecio> => {
    const fechaHasta = await siguienteCambioDePrecio(id, fechaDesde);
    const base = () => {
        let q = supabase.from('viajes').select('id', { count: 'exact', head: true }).eq('id_precio_origen_destino', id).gte('fecha', fechaDesde);
        if (fechaHasta) q = q.lt('fecha', fechaHasta);
        return q;
    };

    const [{ count: total, error: errorTotal }, { count: protegidos, error: errorProtegidos }] = await Promise.all([base(), base().in('estatus', ESTATUS_PROTEGIDOS)]);
    if (errorTotal || errorProtegidos) {
        console.error('Error contando viajes afectados:', errorTotal || errorProtegidos);
        throw errorTotal || errorProtegidos;
    }

    return { viajesActualizados: (total || 0) - (protegidos || 0), viajesProtegidos: protegidos || 0, fechaHasta };
};
