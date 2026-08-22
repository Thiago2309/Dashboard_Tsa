// Cuando se usa un M3 manual (camión externo que no está en el catálogo m3), el valor no
// queda ligado a ningún registro del catálogo, así que se anota como texto al inicio de
// Observaciones para no perder el dato. Estas funciones centralizan ese formato para que
// se pueda leer de vuelta en otros flujos (ej. al aprobar un viaje logístico).
const REGEX_M3_MANUAL = /^M3 externo:\s*([\d.]+)\s*m³\.\s*/i;

// Combina el valor manual (si lo hay) con el resto del texto de observaciones, quitando
// cualquier anotación anterior para no ir acumulando duplicados en ediciones sucesivas.
export const anotarM3ManualEnObservaciones = (m3Manual: number | null | undefined, observacionesResto: string | null | undefined): string | null => {
    const resto = (observacionesResto || '').replace(REGEX_M3_MANUAL, '').trim();
    if (m3Manual && m3Manual > 0) {
        return `M3 externo: ${m3Manual} m³.${resto ? ' ' + resto : ''}`;
    }
    return resto || null;
};

// Recupera el valor manual anotado en observaciones, o null si no hay ninguno.
export const extraerM3ManualDeObservaciones = (observaciones: string | null | undefined): number | null => {
    if (!observaciones) return null;
    const m = observaciones.match(REGEX_M3_MANUAL);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isNaN(n) ? null : n;
};

// Devuelve el texto de observaciones sin la anotación del M3 manual, para mostrarlo limpio
// en el campo de texto libre del formulario.
export const quitarAnotacionM3Manual = (observaciones: string | null | undefined): string | null => {
    if (!observaciones) return null;
    const resto = observaciones.replace(REGEX_M3_MANUAL, '').trim();
    return resto || null;
};
