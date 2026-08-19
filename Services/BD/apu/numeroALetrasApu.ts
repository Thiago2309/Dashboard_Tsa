// Convierte un importe en pesos mexicanos a su representación en letras,
// p.ej. 319.32 -> "TRESCIENTOS DIECINUEVE PESOS 32/100 M.N."

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];

const ESPECIALES: Record<number, string> = {
    10: 'DIEZ',
    11: 'ONCE',
    12: 'DOCE',
    13: 'TRECE',
    14: 'CATORCE',
    15: 'QUINCE',
    16: 'DIECISEIS',
    17: 'DIECISIETE',
    18: 'DIECIOCHO',
    19: 'DIECINUEVE'
};

const VEINTES: Record<number, string> = {
    20: 'VEINTE',
    21: 'VEINTIUNO',
    22: 'VEINTIDOS',
    23: 'VEINTITRES',
    24: 'VEINTICUATRO',
    25: 'VEINTICINCO',
    26: 'VEINTISEIS',
    27: 'VEINTISIETE',
    28: 'VEINTIOCHO',
    29: 'VEINTINUEVE'
};

const DECENAS: Record<number, string> = {
    3: 'TREINTA',
    4: 'CUARENTA',
    5: 'CINCUENTA',
    6: 'SESENTA',
    7: 'SETENTA',
    8: 'OCHENTA',
    9: 'NOVENTA'
};

const CENTENAS: Record<number, string> = {
    1: 'CIENTO',
    2: 'DOSCIENTOS',
    3: 'TRESCIENTOS',
    4: 'CUATROCIENTOS',
    5: 'QUINIENTOS',
    6: 'SEISCIENTOS',
    7: 'SETECIENTOS',
    8: 'OCHOCIENTOS',
    9: 'NOVECIENTOS'
};

// "VEINTIUNO" -> "VEINTIUN", "TREINTA Y UNO" -> "TREINTA Y UN" (apócope antes de MIL/MILLONES)
const apocopar = (texto: string): string => (texto.endsWith('UNO') ? texto.slice(0, -1) : texto);

const convertirDecenas = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return UNIDADES[n];
    if (n <= 19) return ESPECIALES[n];
    if (n <= 29) return VEINTES[n];

    const decena = Math.floor(n / 10);
    const unidad = n % 10;
    if (unidad === 0) return DECENAS[decena];
    return `${DECENAS[decena]} Y ${UNIDADES[unidad]}`;
};

const convertirCentenas = (n: number): string => {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';

    const centena = Math.floor(n / 100);
    const resto = n % 100;
    const textoCentena = centena > 0 ? CENTENAS[centena] : '';
    const textoResto = convertirDecenas(resto);

    return [textoCentena, textoResto].filter(Boolean).join(' ');
};

const convertirEntero = (valor: number): string => {
    const n = Math.floor(valor);
    if (n === 0) return 'CERO';

    const millones = Math.floor(n / 1000000);
    const miles = Math.floor((n % 1000000) / 1000);
    const resto = n % 1000;

    const partes: string[] = [];

    if (millones > 0) {
        partes.push(millones === 1 ? 'UN MILLON' : `${apocopar(convertirCentenas(millones))} MILLONES`);
    }

    if (miles > 0) {
        partes.push(miles === 1 ? 'MIL' : `${apocopar(convertirCentenas(miles))} MIL`);
    }

    if (resto > 0) {
        partes.push(convertirCentenas(resto));
    }

    return partes.join(' ');
};

export const convertirImporteALetras = (valor: number): string => {
    const valorAbsoluto = Math.abs(valor || 0);
    const entero = Math.floor(valorAbsoluto);
    const centavos = Math.round((valorAbsoluto - entero) * 100)
        .toString()
        .padStart(2, '0');

    const pesosTexto = entero === 1 ? 'PESO' : 'PESOS';

    return `${convertirEntero(entero)} ${pesosTexto} ${centavos}/100 M.N.`;
};
