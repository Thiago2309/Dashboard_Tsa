// Services/BD/Checador/checadorService.ts
import { supabase } from '../../superbase.service';

export type TipoChecada = 'entrada' | 'salida';
export type EstatusChecada = 'a_tiempo' | 'tarde' | 'salida_anticipada';

export interface OperadorActual {
    id: number;
    nombre: string;
    puesto: string;
    departamento_nombre?: string;
}

export interface RegistroChecador {
    id?: number;
    operador_id: number;
    tipo: TipoChecada;
    hora_real: string;
    fecha: string;
    latitud: number;
    longitud: number;
    precision_metros?: number;
    foto_url?: string;
    dentro_de_zona: boolean;
    estatus: EstatusChecada;
}

export interface RegistroConNombre extends RegistroChecador {
    operador_nombre: string;
    puesto?: string;
    departamento_nombre?: string;
}

export interface ZonaChecador {
    id: number;
    nombre: string;
    latitud: number;
    longitud: number;
    radio_metros: number;
}

// Resuelve el operador (empleado) ligado al usuario logeado actualmente
export const obtenerOperadorActual = async (): Promise<OperadorActual | null> => {
    const userId = sessionStorage.getItem('userId');
    if (!userId) return null;

    const { data, error } = await supabase
        .from('operador')
        .select('id, nombre, puesto, departamento_id')
        .eq('user_id', parseInt(userId, 10))
        .maybeSingle();

    if (error || !data) {
        if (error) console.error('Error obteniendo operador actual:', error);
        return null;
    }

    let departamento_nombre: string | undefined;
    if (data.departamento_id) {
        const { data: depto } = await supabase
            .from('departamento')
            .select('nombre')
            .eq('id', data.departamento_id)
            .maybeSingle();
        departamento_nombre = depto?.nombre;
    }

    return { id: data.id, nombre: data.nombre, puesto: data.puesto, departamento_nombre };
};

export const fetchZonasActivas = async (): Promise<ZonaChecador[]> => {
    const { data, error } = await supabase
        .from('checador_zona')
        .select('id, nombre, latitud, longitud, radio_metros')
        .eq('activo', true);

    if (error) {
        console.error('Error obteniendo zonas del checador:', error);
        return [];
    }
    return data || [];
};

// Misma fórmula que usa el trigger en la base de datos, solo para dar feedback inmediato en el cliente
export const distanciaMetros = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const val =
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2) - toRad(lon1)) +
        Math.sin(toRad(lat1)) * Math.sin(toRad(lat2));
    return R * Math.acos(Math.min(1, Math.max(-1, val)));
};

export interface UbicacionActual {
    latitud: number;
    longitud: number;
    precision_metros: number;
}

export const obtenerUbicacionActual = (): Promise<UbicacionActual> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Este dispositivo no soporta geolocalización'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    latitud: pos.coords.latitude,
                    longitud: pos.coords.longitude,
                    precision_metros: pos.coords.accuracy
                });
            },
            (err) => reject(new Error(`No se pudo obtener tu ubicación: ${err.message}`)),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    });
};

// Sube la selfie capturada al bucket privado, dentro de una carpeta por operador
export const subirFotoChecador = async (operadorId: number, foto: Blob): Promise<string> => {
    const nombreArchivo = `${operadorId}/${Date.now()}.jpg`;

    const { error } = await supabase.storage
        .from('checador-fotos')
        .upload(nombreArchivo, foto, { contentType: 'image/jpeg' });

    if (error) {
        console.error('Error subiendo foto del checador:', error);
        throw error;
    }

    return nombreArchivo;
};

export const obtenerUrlFirmadaFoto = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
        .from('checador-fotos')
        .createSignedUrl(path, 3600);

    if (error) {
        console.error('Error generando URL de la foto:', error);
        return null;
    }
    return data?.signedUrl || null;
};

// La hora, fecha, estatus y validación de zona las calcula el trigger en la base de datos (checador_before_insert)
export const registrarChecada = async (payload: {
    operador_id: number;
    tipo: TipoChecada;
    latitud: number;
    longitud: number;
    precision_metros?: number;
    foto_url?: string;
}): Promise<RegistroChecador> => {
    const { data, error } = await supabase
        .from('checador_registro')
        .insert([payload])
        .select()
        .single();

    if (error) {
        console.error('Error registrando checada:', error);
        throw error;
    }

    return data;
};

export const fetchRegistrosDeHoy = async (operadorId: number): Promise<RegistroChecador[]> => {
    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
        .from('checador_registro')
        .select('*')
        .eq('operador_id', operadorId)
        .eq('fecha', hoyStr);

    if (error) {
        console.error('Error obteniendo registros de hoy:', error);
        return [];
    }
    return data || [];
};

// Trae todos los registros de una semana (fechaInicio a fechaInicio+6), para el listado de asistencia
export const fetchRegistrosSemana = async (fechaInicio: string): Promise<RegistroChecador[]> => {
    const inicio = new Date(fechaInicio + 'T00:00:00');
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);
    const finStr = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
        .from('checador_registro')
        .select('*')
        .gte('fecha', fechaInicio)
        .lte('fecha', finStr);

    if (error) {
        console.error('Error obteniendo registros de la semana:', error);
        return [];
    }
    return data || [];
};

export const fetchRegistrosPorOperadorYFecha = async (operadorId: number, fecha: string): Promise<RegistroChecador[]> => {
    const { data, error } = await supabase
        .from('checador_registro')
        .select('*')
        .eq('operador_id', operadorId)
        .eq('fecha', fecha)
        .order('hora_real', { ascending: true });

    if (error) {
        console.error('Error obteniendo registros del día:', error);
        return [];
    }
    return data || [];
};
