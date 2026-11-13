// Cuando el camión es de un invitado (externo), su operador no está en el catálogo de
// operadores, así que el nombre se captura a mano y se anota como texto en Observaciones
// (mismo criterio que el M3 externo de m3ManualUtil.ts). El nombre va entre corchetes
// para poder leerlo de vuelta aunque traiga puntos.
const REGEX_OPERADOR_MANUAL = /Operador externo:\s*\[([^\]]*)\]\.?\s*/i;

// Agrega (o reemplaza) la anotación del operador manual al inicio del texto recibido.
// Si se combina con el M3 manual, aplicar primero esta y después anotarM3ManualEnObservaciones,
// porque la del M3 debe quedar siempre al inicio.
export const anotarOperadorManualEnObservaciones = (nombre: string | null | undefined, observacionesResto: string | null | undefined): string | null => {
    const resto = (observacionesResto || '').replace(REGEX_OPERADOR_MANUAL, '').trim();
    const limpio = (nombre || '').replace(/[\[\]]/g, '').trim();
    if (limpio) {
        return `Operador externo: [${limpio}].${resto ? ' ' + resto : ''}`;
    }
    return resto || null;
};

// Recupera el nombre del operador anotado en observaciones, o null si no hay ninguno.
export const extraerOperadorManualDeObservaciones = (observaciones: string | null | undefined): string | null => {
    if (!observaciones) return null;
    const m = observaciones.match(REGEX_OPERADOR_MANUAL);
    return m && m[1].trim() ? m[1].trim() : null;
};

// Devuelve observaciones sin la anotación del operador manual.
export const quitarAnotacionOperadorManual = (observaciones: string | null | undefined): string | null => {
    if (!observaciones) return null;
    const resto = observaciones.replace(REGEX_OPERADOR_MANUAL, '').trim();
    return resto || null;
};
