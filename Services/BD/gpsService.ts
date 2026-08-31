import { fetchCamionesConGPS, Camion } from './inventario/camion/camionService';
import { fetchMaquinariasConGPS, Maquinaria } from './inventario/maquinaria/maquinariaService';

export type TipoEquipoGPS = 'camion' | 'maquinaria';

export interface EquipoGPS {
    id: string;
    tipo: TipoEquipoGPS;
    nombre: string;
    identificador: string;
    estatus: string;
    lat: number;
    lng: number;
    velocidad: number;
    rumbo: number;
    ultimaActualizacion: string;
}

// Punto de referencia para la simulación (Cancún, Q. Roo).
const CENTRO_SIMULACION = { lat: 21.1619, lng: -86.8515 };

// ─────────────────────────────────────────────────────────────────────────
// SIMULACIÓN DE GPS
//
// Todavía no hay un proveedor de GPS conectado, así que estas funciones
// generan posiciones falsas (pero estables, en base al id de cada equipo)
// para poder construir y probar la pantalla de rastreo de principio a fin.
//
// Para conectar el GPS real más adelante, los pasos son:
//   1. Sustituir el cuerpo de `fetchEquiposConGPS` por una consulta a la
//      tabla/vista donde el proveedor de GPS guarde las posiciones
//      (lat, lng, velocidad, rumbo, fecha) de cada unidad, relacionándola
//      por placa (camión) o eco (maquinaria), o por un id de dispositivo.
//   2. Si el proveedor expone datos en vivo (websocket o polling), reemplazar
//      el intervalo de refresco en app/(main)/utilities/gps/page.tsx por una
//      suscripción a esa fuente, manteniendo la misma forma de `EquipoGPS`.
//   3. El resto de la pantalla (mapa, panel lateral, filtros, marcadores) no
//      necesita cambios: todo consume el arreglo de `EquipoGPS` tal cual.
// ─────────────────────────────────────────────────────────────────────────

const hashId = (texto: string): number => {
    let hash = 0;
    for (let i = 0; i < texto.length; i++) {
        hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
    }
    return hash;
};

const generarPosicionSimulada = (id: string) => {
    const hash = hashId(id);
    const angulo = (hash % 360) * (Math.PI / 180);
    const radio = 0.01 + ((hash >> 3) % 100) / 100 * 0.05; // ~1km a 6km del centro
    return {
        lat: CENTRO_SIMULACION.lat + radio * Math.cos(angulo),
        lng: CENTRO_SIMULACION.lng + radio * Math.sin(angulo)
    };
};

// Trae los camiones y la maquinaria marcados con GPS activado, y les asigna
// una posición simulada. Esta es la única función que habrá que reemplazar
// cuando se conecte el proveedor de GPS real.
export const fetchEquiposConGPS = async (): Promise<EquipoGPS[]> => {
    const [camiones, maquinarias] = await Promise.all([
        fetchCamionesConGPS(),
        fetchMaquinariasConGPS()
    ]);

    const equiposCamiones: EquipoGPS[] = camiones.map((c: Camion) => {
        const id = `camion-${c.id}`;
        const pos = generarPosicionSimulada(id);
        return {
            id,
            tipo: 'camion',
            nombre: c.nombre,
            identificador: c.placa,
            estatus: c.estatus,
            lat: pos.lat,
            lng: pos.lng,
            velocidad: hashId(`${id}-v`) % 90,
            rumbo: hashId(`${id}-r`) % 360,
            ultimaActualizacion: new Date().toISOString()
        };
    });

    const equiposMaquinaria: EquipoGPS[] = maquinarias.map((m: Maquinaria) => {
        const id = `maquinaria-${m.id}`;
        const pos = generarPosicionSimulada(id);
        return {
            id,
            tipo: 'maquinaria',
            nombre: m.equipo,
            identificador: m.eco,
            estatus: m.estatus,
            lat: pos.lat,
            lng: pos.lng,
            velocidad: 0,
            rumbo: hashId(`${id}-r`) % 360,
            ultimaActualizacion: new Date().toISOString()
        };
    });

    return [...equiposCamiones, ...equiposMaquinaria];
};

// Simula un pequeño desplazamiento de cada equipo (botón "Actualizar" de la
// pantalla de GPS). Cuando exista GPS real, este helper ya no se usará.
export const simularSiguienteMovimiento = (equipo: EquipoGPS): EquipoGPS => {
    if (equipo.tipo !== 'camion') return { ...equipo, ultimaActualizacion: new Date().toISOString() };

    const deltaLat = (Math.random() - 0.5) * 0.003;
    const deltaLng = (Math.random() - 0.5) * 0.003;
    return {
        ...equipo,
        lat: equipo.lat + deltaLat,
        lng: equipo.lng + deltaLng,
        velocidad: Math.round(Math.random() * 90),
        ultimaActualizacion: new Date().toISOString()
    };
};

// ─────────────────────────────────────────────────────────────────────────
// RECORRIDO (histórico de un día) Y DETECCIÓN DE PARADAS
//
// `fetchRecorrido` también está simulado por ahora: genera, de forma
// reproducible (mismo equipo + misma fecha = mismo recorrido), una lista de
// puntos con hora a lo largo de un turno de trabajo, incluyendo algunas
// paradas de distintas duraciones para poder probar el semáforo de colores.
//
// Para conectar el GPS real más adelante:
//   1. Sustituir el cuerpo de `fetchRecorrido` por una consulta a la tabla/
//      vista donde el proveedor de GPS guarde el historial de posiciones
//      (lat, lng, fecha/hora) de la unidad, filtrando por el día elegido.
//   2. `detectarParadas` no depende de la simulación: trabaja sobre cualquier
//      arreglo de `PuntoRecorrido` ordenado por tiempo, así que sigue
//      funcionando igual con datos reales.
//   3. La pantalla (mapa, selector de fecha, semáforo, tooltip de hora) no
//      necesita cambios: solo consume `PuntoRecorrido[]` y `ParadaRecorrido[]`.
// ─────────────────────────────────────────────────────────────────────────

export interface PuntoRecorrido {
    lat: number;
    lng: number;
    timestamp: string; // ISO
    velocidad: number;
}

export type SeveridadParada = 'verde' | 'amarillo' | 'rojo';

export interface ParadaRecorrido {
    lat: number;
    lng: number;
    inicio: string; // ISO
    fin: string; // ISO
    duracionMinutos: number;
    severidad: SeveridadParada;
}

// Generador pseudoaleatorio con semilla (mulberry32), para que el recorrido
// simulado sea siempre el mismo para el mismo equipo + fecha.
const crearRandomConSemilla = (semilla: number) => {
    let a = semilla;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const formatearFechaISO = (fecha: Date): string => {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Genera el recorrido simulado de un equipo para una fecha determinada.
export const fetchRecorrido = async (equipoId: string, fecha: Date): Promise<PuntoRecorrido[]> => {
    const semilla = hashId(`${equipoId}-${formatearFechaISO(fecha)}`);
    const random = crearRandomConSemilla(semilla);
    const base = generarPosicionSimulada(equipoId);

    const puntos: PuntoRecorrido[] = [];
    let lat = base.lat;
    let lng = base.lng;
    let rumbo = random() * Math.PI * 2;

    // Turno simulado de 06:00 a 18:00, un punto cada minuto (necesario para
    // poder detectar paradas cortas de solo 2-3 minutos con precisión).
    const inicio = new Date(fecha);
    inicio.setHours(6, 0, 0, 0);
    const totalPuntos = 721; // 12 horas * 60 puntos/hora + 1

    // Paradas "guionadas" para garantizar los 3 colores del semáforo, en
    // minutos transcurridos desde el inicio del turno, con duración en min.
    // (La duración detectada queda ~1 min por encima de la guionada, porque
    // el punto de llegada al lugar de la parada también cuenta como parte de
    // la racha estacionaria; por eso el rango "verde" se guiona más corto.)
    const paradasGuionadas = [
        { desdeMin: 75 + Math.floor(random() * 20), duracionMin: 1 }, // parada corta: NO debe marcarse (<2min)
        { desdeMin: 180 + Math.floor(random() * 20), duracionMin: 2 + Math.floor(random() * 2) }, // verde: 2-5
        { desdeMin: 330 + Math.floor(random() * 20), duracionMin: 5 + Math.floor(random() * 10) }, // amarillo: 5-15
        { desdeMin: 480 + Math.floor(random() * 20), duracionMin: 16 + Math.floor(random() * 30) } // rojo: >15
    ];

    let minutoActual = 0;
    let paradaEnCurso: { finMin: number } | null = null;

    for (let i = 0; i < totalPuntos; i++) {
        const timestamp = new Date(inicio.getTime() + minutoActual * 60000);

        // ¿Toca iniciar alguna parada guionada en este minuto?
        if (!paradaEnCurso) {
            const guion = paradasGuionadas.find((p) => Math.abs(p.desdeMin - minutoActual) < 2);
            if (guion) paradaEnCurso = { finMin: minutoActual + guion.duracionMin };
        }

        const detenido = !!paradaEnCurso && minutoActual < paradaEnCurso.finMin;
        if (paradaEnCurso && minutoActual >= paradaEnCurso.finMin) paradaEnCurso = null;

        let velocidad = 0;
        if (!detenido) {
            // Caminata aleatoria: cambia ligeramente el rumbo y avanza.
            rumbo += (random() - 0.5) * 0.5;
            const avanceMetros = 300 + random() * 400; // ~300-700m cada minuto (≈ 18-42 km/h)
            const avanceGrados = avanceMetros / 111320; // aprox. metros -> grados
            lat += Math.cos(rumbo) * avanceGrados;
            lng += Math.sin(rumbo) * avanceGrados / Math.cos(lat * (Math.PI / 180));
            velocidad = Math.round((avanceMetros / 1000) * 60 * 10) / 10; // aprox km/h
        }

        puntos.push({ lat, lng, timestamp: timestamp.toISOString(), velocidad });
        minutoActual += 1;
    }

    return puntos;
};

const RADIO_PARADA_METROS = 60;

const distanciaMetros = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * (Math.PI / 180);
    const dLng = (b.lng - a.lng) * (Math.PI / 180);
    const lat1 = a.lat * (Math.PI / 180);
    const lat2 = b.lat * (Math.PI / 180);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

const clasificarSeveridad = (duracionMinutos: number): SeveridadParada => {
    if (duracionMinutos > 15) return 'rojo';
    if (duracionMinutos >= 5) return 'amarillo';
    return 'verde';
};

// Recorre los puntos en orden y agrupa las rachas donde la unidad se quedó
// dentro de un radio pequeño (≈ misma posición). Solo reporta las rachas de
// 2 minutos o más, clasificadas en verde (2-5 min), amarillo (5-15 min) y
// rojo (más de 15 min), como pidió el usuario.
export const detectarParadas = (puntos: PuntoRecorrido[]): ParadaRecorrido[] => {
    const paradas: ParadaRecorrido[] = [];
    let i = 0;

    while (i < puntos.length) {
        let j = i;
        while (j + 1 < puntos.length && distanciaMetros(puntos[i], puntos[j + 1]) <= RADIO_PARADA_METROS) {
            j++;
        }

        const duracionMinutos = (new Date(puntos[j].timestamp).getTime() - new Date(puntos[i].timestamp).getTime()) / 60000;
        if (duracionMinutos >= 2) {
            paradas.push({
                lat: puntos[i].lat,
                lng: puntos[i].lng,
                inicio: puntos[i].timestamp,
                fin: puntos[j].timestamp,
                duracionMinutos: Math.round(duracionMinutos),
                severidad: clasificarSeveridad(duracionMinutos)
            });
        }

        i = j > i ? j + 1 : i + 1;
    }

    return paradas;
};
