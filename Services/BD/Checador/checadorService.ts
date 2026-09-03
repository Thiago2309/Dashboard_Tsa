// Services/BD/Checador/checadorService.ts
import { supabase } from '../../superbase.service';

export type TipoChecada = 'entrada' | 'salida';
export type EstatusChecada = 'a_tiempo' | 'tarde' | 'salida_anticipada';

export interface OperadorActual {
    id: number;
    nombre: string;
    puesto: string;
    departamento_nombre?: string;
    hora_entrada_prog?: string;
    hora_salida_prog?: string;
    reporte_periodico_activo?: boolean;
    reporte_periodico_intervalo_minutos?: number;
    reporte_periodico_tolerancia_minutos?: number;
}

export type EstatusSlotReporte = 'futuro' | 'pendiente' | 'a_tiempo' | 'tarde' | 'no_reportado';

export interface EstadoSlotReporte {
    slot: string;
    estatus: EstatusSlotReporte;
    reporte?: ReportePeriodico;
}

export interface ReportePeriodico {
    id?: number;
    operador_id: number;
    slot_hora: string;
    hora_real: string;
    fecha: string;
    latitud: number;
    longitud: number;
    precision_metros?: number;
    foto_url?: string;
    dentro_de_zona: boolean;
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
        .select(
            'id, nombre, puesto, departamento_id, hora_entrada_prog, hora_salida_prog, reporte_periodico_activo, reporte_periodico_intervalo_minutos, reporte_periodico_tolerancia_minutos'
        )
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

    return {
        id: data.id,
        nombre: data.nombre,
        puesto: data.puesto,
        departamento_nombre,
        hora_entrada_prog: data.hora_entrada_prog,
        hora_salida_prog: data.hora_salida_prog,
        reporte_periodico_activo: data.reporte_periodico_activo,
        reporte_periodico_intervalo_minutos: data.reporte_periodico_intervalo_minutos,
        reporte_periodico_tolerancia_minutos: data.reporte_periodico_tolerancia_minutos
    };
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

// ===================== Reportes periódicos durante el turno =====================

const minutosDeHHmm = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

// Convierte cualquier instante a "minutos desde medianoche" en hora de Cancún,
// para no depender de la zona horaria del dispositivo del empleado.
const minutosDelDiaCancun = (fecha: Date): number => {
    const str = fecha.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Cancun' });
    return minutosDeHHmm(str);
};

// Calcula las horas ("HH:mm") en las que el empleado debe reportarse durante su turno,
// sin contar la hora de entrada (ya cubierta por el checado normal) ni de salida.
export const calcularSlotsReporte = (horaEntradaProg: string, horaSalidaProg: string, intervaloMinutos: number): string[] => {
    const inicio = minutosDeHHmm(horaEntradaProg);
    const fin = minutosDeHHmm(horaSalidaProg);
    const pasoMin = Math.round(intervaloMinutos);
    if (pasoMin <= 0 || fin <= inicio) return [];

    const slots: string[] = [];
    for (let m = inicio + pasoMin; m < fin; m += pasoMin) {
        const h = Math.floor(m / 60) % 24;
        const mm = m % 60;
        slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    }
    return slots;
};

// Cruza los horarios esperados del día con los reportes realmente registrados,
// determinando si cada uno se cumplió a tiempo, tarde, o no se reportó.
export const calcularEstatusSlots = (
    slots: string[],
    reportes: ReportePeriodico[],
    toleranciaMinutos: number,
    intervaloMinutos: number,
    ahora: Date
): EstadoSlotReporte[] => {
    const ahoraMin = minutosDelDiaCancun(ahora);
    const intervaloMin = Math.round(intervaloMinutos);
    const disponibles = [...reportes].sort((a, b) => new Date(a.hora_real).getTime() - new Date(b.hora_real).getTime());
    const usados = new Set<number>();

    return slots.map((slot) => {
        const slotMin = minutosDeHHmm(slot);

        const idx = disponibles.findIndex((r, i) => {
            if (usados.has(i)) return false;
            const rMin = minutosDelDiaCancun(new Date(r.hora_real));
            return rMin >= slotMin - toleranciaMinutos && rMin < slotMin + intervaloMin;
        });

        if (idx !== -1) {
            usados.add(idx);
            const reporte = disponibles[idx];
            const rMin = minutosDelDiaCancun(new Date(reporte.hora_real));
            return { slot, estatus: rMin <= slotMin + toleranciaMinutos ? 'a_tiempo' : 'tarde', reporte };
        }

        if (ahoraMin < slotMin) return { slot, estatus: 'futuro' };
        if (ahoraMin <= slotMin + toleranciaMinutos) return { slot, estatus: 'pendiente' };
        return { slot, estatus: 'no_reportado' };
    });
};

export const fetchReportesDeHoy = async (operadorId: number): Promise<ReportePeriodico[]> => {
    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    return fetchReportesPorOperadorYFecha(operadorId, hoyStr);
};

// Trae todos los reportes periódicos de una semana (fechaInicio a fechaInicio+6), para el listado de asistencia
export const fetchReportesSemana = async (fechaInicio: string): Promise<ReportePeriodico[]> => {
    const inicio = new Date(fechaInicio + 'T00:00:00');
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);
    const finStr = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
        .from('checador_reporte')
        .select('*')
        .gte('fecha', fechaInicio)
        .lte('fecha', finStr);

    if (error) {
        console.error('Error obteniendo reportes periódicos de la semana:', error);
        return [];
    }
    return data || [];
};

export const fetchReportesPorOperadorYFecha = async (operadorId: number, fecha: string): Promise<ReportePeriodico[]> => {
    const { data, error } = await supabase
        .from('checador_reporte')
        .select('*')
        .eq('operador_id', operadorId)
        .eq('fecha', fecha)
        .order('hora_real', { ascending: true });

    if (error) {
        console.error('Error obteniendo reportes periódicos del día:', error);
        return [];
    }
    return data || [];
};

// La hora la calcula siempre el servidor (trigger checador_reporte_before_insert)
export const registrarReportePeriodico = async (payload: {
    operador_id: number;
    slot_hora: string;
    latitud: number;
    longitud: number;
    precision_metros?: number;
    foto_url?: string;
}): Promise<ReportePeriodico> => {
    const { data, error } = await supabase
        .from('checador_reporte')
        .insert([payload])
        .select()
        .single();

    if (error) {
        console.error('Error registrando reporte periódico:', error);
        throw error;
    }
    return data;
};
