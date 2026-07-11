// Services/BD/logisticaService.ts
import { supabase } from '../../superbase.service';

export interface LogisticaViaje {
    id?: number;
    folio: string;
    folio_bco?: string | null;
    id_cliente: number | null;
    id_operador: number | null;
    id_precio_origen_destino: number | null;
    id_material: number | null;
    id_m3: number | null;
    id_invitado: number | null;
    estado: 'pendiente' | 'asignado' | 'en_curso' | 'completado' | 'cancelado';
    observaciones: string | null;
    fecha_asignacion: string | null;
    horario: string;
    numero_viaje: string | null;
    en_renta: boolean;
    horas_renta: number | null;
    cantidad_viajes?: number | null; // ← NUEVO CAMPO
    
    // Campos de la vista (relaciones)
    cliente_nombre?: string;
    operador_nombre?: string;
    material_nombre?: string;
    m3_nombre?: string;
    origen?: string;
    destino?: string;
    invitado_nombre?: string;
    user_id?: number | null;
}

// Helper function to transform Supabase response
const transformLogisticaData = (data: any): LogisticaViaje => ({
    id: data.id,
    folio: data.folio,
    folio_bco: data.folio_bco || null,
    id_cliente: data.id_cliente,
    cliente_nombre: data.cliente_nombre || '',
    id_operador: data.id_operador,
    operador_nombre: data.operador_nombre || '',
    id_precio_origen_destino: data.id_precio_origen_destino,
    id_material: data.id_material,
    material_nombre: data.material_nombre || '',
    id_m3: data.id_m3,
    m3_nombre: data.m3_nombre || '',
    id_invitado: data.id_invitado || null,
    invitado_nombre: data.invitado_nombre || '',
    estado: data.estado || 'pendiente',
    observaciones: data.observaciones || null,
    fecha_asignacion: data.fecha_asignacion || null,
    horario: data.horario || 'D',
    numero_viaje: data.numero_viaje || null,
    en_renta: data.en_renta || false,
    horas_renta: data.horas_renta || null,
    origen: data.origen || '',
    destino: data.destino || '',
    user_id: data.user_id || null,
    cantidad_viajes: data.cantidad_viajes || null
});

// Obtener todos los viajes logísticos
export const fetchViajesLogistica = async (): Promise<LogisticaViaje[]> => {
    const { data, error } = await supabase
        .from('fetch_logistica')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error fetching logistica viajes:', error);
        throw error;
    }

    return data?.map(transformLogisticaData) || [];
};

// Crear un nuevo viaje logístico
export const createViajeLogistica = async (viaje: Omit<LogisticaViaje, 'id'>): Promise<LogisticaViaje> => {
    // Preparar datos para insertar
    const datosInsertar = {
        folio: viaje.folio,
        id_cliente: viaje.id_cliente,
        id_operador: viaje.id_operador,
        id_precio_origen_destino: viaje.id_precio_origen_destino,
        id_material: viaje.id_material,
        id_m3: viaje.id_m3,
        id_invitado: viaje.id_invitado,
        estado: viaje.estado || 'pendiente',
        observaciones: viaje.observaciones,
        fecha_asignacion: viaje.fecha_asignacion || null,
        horario: viaje.horario || 'D',
        numero_viaje: viaje.numero_viaje,
        en_renta: viaje.en_renta || false,
        horas_renta: viaje.horas_renta,
        cantidad_viajes: viaje.cantidad_viajes || null 
    };

    const { data, error } = await supabase
        .from('logistica')
        .insert([datosInsertar])
        .select('*')
        .single();

    if (error) {
        console.error('Error creating viaje logistica:', error);
        throw error;
    }

    // Obtener los datos completos con la vista
    const { data: dataCompleta, error: errorCompleta } = await supabase
        .from('fetch_logistica')
        .select('*')
        .eq('id', data.id)
        .single();

    if (errorCompleta) {
        console.error('Error fetching complete logistica data:', errorCompleta);
        return transformLogisticaData(data);
    }

    return transformLogisticaData(dataCompleta);
};

// Actualizar viaje logístico
export const updateViajeLogistica = async (viaje: LogisticaViaje): Promise<LogisticaViaje> => {
    // Preparar datos para actualizar
    const datosActualizar = {
        id_cliente: viaje.id_cliente,
        folio: viaje.folio,
        folio_bco: viaje.folio_bco || null,
        id_operador: viaje.id_operador,
        id_precio_origen_destino: viaje.id_precio_origen_destino,
        id_material: viaje.id_material,
        id_m3: viaje.id_m3,
        id_invitado: viaje.id_invitado,
        estado: viaje.estado,
        observaciones: viaje.observaciones,
        fecha_asignacion: viaje.fecha_asignacion,
        horario: viaje.horario,
        numero_viaje: viaje.numero_viaje,
        en_renta: viaje.en_renta,
        horas_renta: viaje.horas_renta,
        cantidad_viajes: viaje.cantidad_viajes || null 
    };

    const { data, error } = await supabase
        .from('logistica')
        .update(datosActualizar)
        .eq('id', viaje.id)
        .select('*')
        .single();

    if (error) {
        console.error('Error updating viaje logistica:', error);
        throw error;
    }

    // Obtener los datos completos con la vista
    const { data: dataCompleta, error: errorCompleta } = await supabase
        .from('fetch_logistica')
        .select('*')
        .eq('id', data.id)
        .single();

    if (errorCompleta) {
        console.error('Error fetching complete logistica data:', errorCompleta);
        return transformLogisticaData(data);
    }

    return transformLogisticaData(dataCompleta);
};

// Eliminar viaje logístico
export const deleteViajeLogistica = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('logistica')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting viaje logistica:', error);
        throw error;
    }
};

// Obtener estadísticas de logística
export const fetchEstadisticasLogistica = async () => {
    const { data: viajes, error } = await supabase
        .from('logistica')
        .select('estado');

    if (error) {
        console.error('Error fetching estadisticas:', error);
        throw error;
    }

    const total = viajes?.length || 0;
    const pendientes = viajes?.filter(v => v.estado === 'pendiente').length || 0;
    const asignados = viajes?.filter(v => v.estado === 'asignado').length || 0;
    const enCurso = viajes?.filter(v => v.estado === 'en_curso').length || 0;
    const completados = viajes?.filter(v => v.estado === 'completado').length || 0;
    const cancelados = viajes?.filter(v => v.estado === 'cancelado').length || 0;

    return {
        total,
        pendientes,
        asignados,
        enCurso,
        completados,
        cancelados
    };
};

// Obtener opciones para filtros
export const fetchOpcionesFiltrosLogistica = async () => {
    const [operadores, materiales, origenes, destinos, estados] = await Promise.all([
        supabase.from('operador').select('nombre').eq('activo', true),
        supabase.from('material').select('nombre'),
        supabase.from('precio_origen_destino').select('nombreorigen').eq('status', true),
        supabase.from('precio_origen_destino').select('nombredestino').eq('status', true),
        supabase.from('logistica').select('estado')
    ]);

    return {
        operadores: Array.from(new Set(operadores.data?.map(o => o.nombre) || [])),
        materiales: Array.from(new Set(materiales.data?.map(m => m.nombre) || [])),
        origenes: Array.from(new Set(origenes.data?.map(o => o.nombreorigen) || [])),
        destinos: Array.from(new Set(destinos.data?.map(d => d.nombredestino) || [])),
        estados: Array.from(new Set(estados.data?.map(e => e.estado) || []))
    };
};

// Obtener clientes
export const fetchClientes = async (): Promise<{ id: number; empresa: string }[]> => {
    const { data, error } = await supabase
        .from('clientes')
        .select('id, empresa')
        .eq('estatus', 1);

    if (error) {
        console.error('Error fetching clientes:', error);
        throw error;
    }

    return data || [];
};

// Obtener operadores
export const fetchOperadores = async (): Promise<{ id: number; nombre: string;}[]> => {
    const { data, error } = await supabase
        .from('operador')
        .select('id, nombre')
        .eq('estatus', true)
        .order('nombre');

    if (error) {
        console.error('Error fetching operadores:', error);
        throw error;
    }

    return data || [];
};

// Obtener materiales
export const fetchMateriales = async (): Promise<{ id: number; nombre: string }[]> => {
    const { data, error } = await supabase
        .from('material')
        .select('id, nombre');

    if (error) {
        console.error('Error fetching materiales:', error);
        throw error;
    }

    return data || [];
};

// Obtener M3
export const fetchM3 = async (): Promise<{ id: number; nombre: string; metros_cubicos: number }[]> => {
    const { data, error } = await supabase
        .from('m3')
        .select('id, nombre, metros_cubicos');

    if (error) {
        console.error('Error fetching m3:', error);
        throw error;
    }

    return data || [];
};

// Obtener precios origen-destino
export const fetchPreciosOrigenDestino = async (): Promise<{ id: number; label: string; precio_unidad: number; precio_materia?: number; origen: string; destino: string }[]> => {
    const { data, error } = await supabase
        .from('precio_origen_destino')
        .select('id, nombreorigen, nombredestino, precio_unidad, precio_materia')
        .eq('status', true);

    if (error) {
        console.error('Error fetching precios origen-destino:', error);
        throw error;
    }

    return data?.map(item => ({
        id: item.id,
        label: `${item.nombreorigen} - ${item.nombredestino}`,
        precio_unidad: item.precio_unidad,
        precio_materia: item.precio_materia ?? 0,
        origen: item.nombreorigen,
        destino: item.nombredestino
    })) || [];
};

// Obtener invitados
export const fetchInvitados = async (): Promise<{ id: number; empresa: string }[]> => {
    const { data, error } = await supabase
        .from('invitados')
        .select('id, empresa')
        .eq('estatus', 1);

    if (error) {
        console.error('Error fetching invitados:', error);
        throw error;
    }

    return data || [];
};

// Verificar si un folio existe
export const checkFolioExists = async (folio: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('logistica')
            .select('id')
            .eq('folio', folio)
            .maybeSingle();

        if (error) {
            console.error('Error al verificar folio:', error);
            return false;
        }

        return data !== null;
    } catch (error) {
        console.error('Error al verificar folio:', error);
        return false;
    }
};

export const fetchViajesPorOperadorLogueado = async (): Promise<LogisticaViaje[]> => {
    try {
        // 1. Obtener el userId de la sesión
        const userId = sessionStorage.getItem('userId');
        if (!userId) {
            console.warn('No hay usuario logueado');
            return [];
        }

        // 2. Buscar el operador asociado al user_id
        const { data: operador, error: operadorError } = await supabase
            .from('operador')
            .select('id')
            .eq('user_id', parseInt(userId))
            .maybeSingle();

        if (operadorError) {
            console.error('Error obteniendo operador:', operadorError);
            return [];
        }

        if (!operador) {
            console.warn('No se encontró operador asociado al usuario');
            return [];
        }

        // 3. Obtener los viajes del operador con estados específicos (asignado, en_curso, completado)
        const { data, error } = await supabase
            .from('fetch_logistica')
            .select('*')
            .eq('id_operador', operador.id)
            .in('estado', ['asignado', 'en_curso', 'completado'])
            .order('id', { ascending: false });

        if (error) {
            console.error('Error fetching viajes del operador:', error);
            throw error;
        }

        return data?.map(transformLogisticaData) || [];
    } catch (error) {
        console.error('Error en fetchViajesPorOperadorLogueado:', error);
        return [];
    }
};

// Función para obtener solo viajes asignados (pendientes de completar)
export const fetchViajesAsignadosPorOperador = async (): Promise<LogisticaViaje[]> => {
    try {
        const userId = sessionStorage.getItem('userId');
        if (!userId) return [];

        const { data: operador } = await supabase
            .from('operador')
            .select('id')
            .eq('user_id', parseInt(userId))
            .maybeSingle();

        if (!operador) return [];

        const { data, error } = await supabase
            .from('fetch_logistica')
            .select('*')
            .eq('id_operador', operador.id)
            .in('estado', ['asignado', 'en_curso'])
            .order('fecha_asignacion', { ascending: true })
            .order('id', { ascending: true });

        if (error) {
            console.error('Error fetching viajes asignados:', error);
            throw error;
        }

        return data?.map(transformLogisticaData) || [];
    } catch (error) {
        console.error('Error en fetchViajesAsignadosPorOperador:', error);
        return [];
    }
};