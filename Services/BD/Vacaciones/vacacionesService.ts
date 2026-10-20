import { supabase } from '../../superbase.service';

export interface PeriodoVacaciones {
    id?: number;
    id_operador: number | null;
    fecha_inicio: string;
    fecha_fin: string;
    dias_otorgados: number;
    dias_disfrutados: number;
    dias_pendientes: number;
    created_at?: string;
    updated_at?: string;
    // Campos de la vista
    operador_nombre?: string;
    // operador_apellidos?: string;
    fecha_contratacion?: string;
    años_antiguedad?: number;
}

export interface OperadorVacaciones {
    id: number;
    nombre: string;
    // apellidos: string;
    fecha_contratacion: string;
    total_dias_otorgados: number;
    total_dias_disfrutados: number;
    total_dias_pendientes: number;
    periodos: PeriodoVacaciones[];
    // Calculados automáticamente según la LFT (Art. 76)
    anios_cumplidos: number;
    meses_cumplidos: number;
    dias_ley: number;                       // días que le corresponden en el periodo actual
    dias_disfrutados_periodo: number;       // días tomados desde el último aniversario
    dias_disponibles: number;               // dias_ley - dias_disfrutados_periodo
    fecha_ultimo_aniversario: Date | null;
    fecha_proximo_aniversario: Date | null;
    dias_proximo_periodo: number;           // días que le tocarán en el próximo aniversario
}

// Convierte 'YYYY-MM-DD' (o timestamp) a fecha local sin desfase de zona horaria.
// new Date('2026-01-01') se interpreta en UTC y en México da 31/12/2025.
export const parseFechaLocal = (fecha: string | null | undefined): Date | null => {
    if (!fecha) return null;
    const [y, m, d] = fecha.substring(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};

export const formatFechaLocal = (fecha: Date): string => {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Años y meses completos entre la fecha de contratación y hoy
export const calcularAntiguedad = (fechaContratacion: Date, hoy: Date = new Date()) => {
    let anios = hoy.getFullYear() - fechaContratacion.getFullYear();
    let meses = hoy.getMonth() - fechaContratacion.getMonth();
    if (hoy.getDate() < fechaContratacion.getDate()) meses--;
    if (meses < 0) {
        anios--;
        meses += 12;
    }
    if (anios < 0) return { anios: 0, meses: 0 };
    return { anios, meses };
};

// Días de vacaciones por años cumplidos (LFT Art. 76, reforma 2023)
// 1→12, 2→14, 3→16, 4→18, 5→20, 6-10→22, 11-15→24, 16-20→26, ... (+2 cada 5 años)
export const diasVacacionesLFT = (anios: number): number => {
    if (anios < 1) return 0;
    if (anios <= 5) return 10 + anios * 2;
    return 22 + Math.floor((anios - 6) / 5) * 2;
};

const sumarAnios = (fecha: Date, anios: number) =>
    new Date(fecha.getFullYear() + anios, fecha.getMonth(), fecha.getDate());

const calcularVacacionesLey = (fechaContratacionStr: string, periodos: PeriodoVacaciones[]) => {
    const fechaContratacion = parseFechaLocal(fechaContratacionStr);
    if (!fechaContratacion) {
        return {
            anios_cumplidos: 0, meses_cumplidos: 0, dias_ley: 0, dias_disfrutados_periodo: 0,
            dias_disponibles: 0, fecha_ultimo_aniversario: null, fecha_proximo_aniversario: null, dias_proximo_periodo: 0
        };
    }

    const { anios, meses } = calcularAntiguedad(fechaContratacion);
    const dias_ley = diasVacacionesLFT(anios);
    const fecha_ultimo_aniversario = anios >= 1 ? sumarAnios(fechaContratacion, anios) : null;
    const fecha_proximo_aniversario = sumarAnios(fechaContratacion, anios + 1);

    // Solo cuentan los días tomados dentro del periodo actual (desde el último aniversario)
    const dias_disfrutados_periodo = fecha_ultimo_aniversario
        ? periodos
            .filter(p => {
                const inicio = parseFechaLocal(p.fecha_inicio);
                return inicio && inicio >= fecha_ultimo_aniversario;
            })
            .reduce((sum, p) => sum + (p.dias_disfrutados || 0), 0)
        : 0;

    return {
        anios_cumplidos: anios,
        meses_cumplidos: meses,
        dias_ley,
        dias_disfrutados_periodo,
        dias_disponibles: Math.max(dias_ley - dias_disfrutados_periodo, 0),
        fecha_ultimo_aniversario,
        fecha_proximo_aniversario,
        dias_proximo_periodo: diasVacacionesLFT(anios + 1)
    };
};

// Obtener todos los periodos de vacaciones
export const fetchPeriodosVacaciones = async (): Promise<PeriodoVacaciones[]> => {
    const { data, error } = await supabase
        .from('fetch_vacaciones')
        .select('*');

    if (error) {
        console.error('Error fetching periodos vacaciones:', error);
        throw error;
    }

    return data || [];
};

// Obtener operadores con sus periodos de vacaciones
export const fetchOperadoresConVacaciones = async (): Promise<OperadorVacaciones[]> => {
    const { data: operadores, error: errorOperadores } = await supabase
        .from('operador')
        .select('id, nombre, fecha_contratacion')
        .eq('estatus', true)
        .order('nombre');

    if (errorOperadores) {
        console.error('Error fetching operadores:', errorOperadores);
        throw errorOperadores;
    }

    const { data: periodos, error: errorPeriodos } = await supabase
        .from('fetch_vacaciones')
        .select('*');

    if (errorPeriodos) {
        console.error('Error fetching periodos:', errorPeriodos);
        throw errorPeriodos;
    }

    // Agrupar periodos por operador
    const operadoresConVacaciones = operadores.map(operador => {
        const periodosOperador = periodos?.filter(p => p.id_operador === operador.id) || [];
        
        const total_dias_otorgados = periodosOperador.reduce((sum, p) => sum + (p.dias_otorgados || 0), 0);
        const total_dias_disfrutados = periodosOperador.reduce((sum, p) => sum + (p.dias_disfrutados || 0), 0);
        const total_dias_pendientes = periodosOperador.reduce((sum, p) => sum + (p.dias_pendientes || 0), 0);

        return {
            ...operador,
            total_dias_otorgados,
            total_dias_disfrutados,
            total_dias_pendientes,
            periodos: periodosOperador,
            ...calcularVacacionesLey(operador.fecha_contratacion, periodosOperador)
        };
    });

    return operadoresConVacaciones;
};

// Crear un nuevo periodo de vacaciones
export const createPeriodoVacaciones = async (periodo: Omit<PeriodoVacaciones, 'id'>): Promise<PeriodoVacaciones> => {
    const { data, error } = await supabase
        .from('vacaciones_periodos')
        .insert([periodo])
        .select('*')
        .single();

    if (error) {
        console.error('Error creating periodo vacaciones:', error);
        throw error;
    }

    return data;
};

// Actualizar un periodo de vacaciones
export const updatePeriodoVacaciones = async (periodo: PeriodoVacaciones): Promise<PeriodoVacaciones> => {
    const { data, error } = await supabase
        .from('vacaciones_periodos')
        .update({
            fecha_inicio: periodo.fecha_inicio,
            fecha_fin: periodo.fecha_fin,
            dias_otorgados: periodo.dias_otorgados,
            dias_disfrutados: periodo.dias_disfrutados,
            dias_pendientes: periodo.dias_pendientes
        })
        .eq('id', periodo.id)
        .select('*')
        .single();

    if (error) {
        console.error('Error updating periodo vacaciones:', error);
        throw error;
    }

    return data;
};

// Eliminar un periodo de vacaciones
export const deletePeriodoVacaciones = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('vacaciones_periodos')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting periodo vacaciones:', error);
        throw error;
    }
};

// Obtener operadores (reutilizamos el existente)
export const fetchOperadores = async (): Promise<{ id: number; nombre: string; fecha_contratacion: string }[]> => {
    const { data, error } = await supabase
        .from('operador')
        .select('id, nombre, fecha_contratacion')
        .eq('estatus', true)
        .order('nombre');

    if (error) {
        console.error('Error fetching operadores:', error);
        throw error;
    }

    return data || [];
};
// ============================================================================
// Solicitudes de vacaciones (tabla vacaciones_solicitudes)
// Ver scripts/vacaciones_solicitudes_setup.sql
// ============================================================================

export type EstatusSolicitudVacaciones = 'pendiente' | 'autorizada' | 'rechazada';

export interface SolicitudVacaciones {
    id?: number;
    id_operador: number | null;
    fecha_solicitud: string;
    fecha_inicio: string;
    fecha_fin: string;
    fecha_regreso: string | null;
    dias_solicitados: number;
    motivo: string | null;
    estatus: EstatusSolicitudVacaciones;
    firma_empleado: string | null;
    firma_jefe: string | null;
    autorizado_por: string | null;
    autorizado_por_userid: number | null;
    fecha_autorizacion: string | null;
    motivo_rechazo: string | null;
    dias_ley: number | null;
    dias_tomados_antes: number | null;
    dias_restantes: number | null;
    id_periodo: number | null;
    creado_por: number | null;
    created_at?: string;
    // Del join con operador
    operador_nombre?: string;
    fecha_contratacion?: string;
}

export interface FirmaAutorizacion {
    firma_jefe: string;
    autorizado_por: string;
    autorizado_por_userid: number | null;
}

// Días de vacaciones entre dos fechas (inclusive), sin contar domingos (día de descanso)
export const contarDiasVacaciones = (inicio: Date, fin: Date): number => {
    let dias = 0;
    const actual = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    while (actual <= fin) {
        if (actual.getDay() !== 0) dias++;
        actual.setDate(actual.getDate() + 1);
    }
    return dias;
};

// Día en que se presenta a trabajar: el siguiente día después de fin, saltando domingo
export const calcularFechaRegreso = (fin: Date): Date => {
    const regreso = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() + 1);
    if (regreso.getDay() === 0) regreso.setDate(regreso.getDate() + 1);
    return regreso;
};

const transformSolicitudData = (row: any): SolicitudVacaciones => {
    const { operador, ...resto } = row;
    return {
        ...resto,
        operador_nombre: operador?.nombre ?? '',
        fecha_contratacion: operador?.fecha_contratacion ?? null
    };
};

export const fetchSolicitudesVacaciones = async (): Promise<SolicitudVacaciones[]> => {
    const { data, error } = await supabase
        .from('vacaciones_solicitudes')
        .select('*, operador:id_operador(nombre, fecha_contratacion)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching solicitudes vacaciones:', error);
        throw error;
    }

    return (data || []).map(transformSolicitudData);
};

export const createSolicitudVacaciones = async (
    solicitud: Omit<SolicitudVacaciones, 'id' | 'operador_nombre' | 'fecha_contratacion'>
): Promise<SolicitudVacaciones> => {
    const { data, error } = await supabase
        .from('vacaciones_solicitudes')
        .insert([solicitud])
        .select('*, operador:id_operador(nombre, fecha_contratacion)')
        .single();

    if (error) {
        console.error('Error creating solicitud vacaciones:', error);
        throw error;
    }

    return transformSolicitudData(data);
};

// Autoriza la solicitud con la firma del jefe y descuenta los días del saldo
// creando el periodo correspondiente en vacaciones_periodos.
export const autorizarSolicitudVacaciones = async (
    solicitud: SolicitudVacaciones,
    operador: OperadorVacaciones,
    firma: FirmaAutorizacion
): Promise<void> => {
    if (solicitud.dias_solicitados > operador.dias_disponibles) {
        throw new Error(
            `${operador.nombre} solo tiene ${operador.dias_disponibles} días disponibles y la solicitud es de ${solicitud.dias_solicitados}.`
        );
    }

    const dias_restantes = operador.dias_disponibles - solicitud.dias_solicitados;

    const periodo = await createPeriodoVacaciones({
        id_operador: solicitud.id_operador,
        fecha_inicio: solicitud.fecha_inicio,
        fecha_fin: solicitud.fecha_fin,
        dias_otorgados: operador.dias_ley,
        dias_disfrutados: solicitud.dias_solicitados,
        dias_pendientes: dias_restantes
    });

    const { error } = await supabase
        .from('vacaciones_solicitudes')
        .update({
            estatus: 'autorizada',
            firma_jefe: firma.firma_jefe,
            autorizado_por: firma.autorizado_por,
            autorizado_por_userid: firma.autorizado_por_userid,
            fecha_autorizacion: new Date().toISOString(),
            motivo_rechazo: null,
            dias_ley: operador.dias_ley,
            dias_tomados_antes: operador.dias_disfrutados_periodo,
            dias_restantes,
            id_periodo: periodo.id
        })
        .eq('id', solicitud.id);

    if (error) {
        console.error('Error autorizando solicitud vacaciones:', error);
        // Revertir el periodo para no descontar días de una solicitud no autorizada
        await deletePeriodoVacaciones(periodo.id!);
        throw error;
    }
};

export const rechazarSolicitudVacaciones = async (
    id: number,
    motivo_rechazo: string,
    autorizado_por: string,
    autorizado_por_userid: number | null
): Promise<void> => {
    const { error } = await supabase
        .from('vacaciones_solicitudes')
        .update({
            estatus: 'rechazada',
            motivo_rechazo,
            autorizado_por,
            autorizado_por_userid,
            fecha_autorizacion: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        console.error('Error rechazando solicitud vacaciones:', error);
        throw error;
    }
};

// Elimina la solicitud y, si estaba autorizada, el periodo que descontó los días
export const deleteSolicitudVacaciones = async (solicitud: SolicitudVacaciones): Promise<void> => {
    const { error } = await supabase
        .from('vacaciones_solicitudes')
        .delete()
        .eq('id', solicitud.id);

    if (error) {
        console.error('Error deleting solicitud vacaciones:', error);
        throw error;
    }

    if (solicitud.id_periodo) {
        await deletePeriodoVacaciones(solicitud.id_periodo);
    }
};
