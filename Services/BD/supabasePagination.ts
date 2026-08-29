import { supabase } from '../superbase.service';

const PAGE_SIZE = 1000;
// Cuántas páginas se piden en paralelo por tanda. Antes se pedía una página,
// se esperaba la respuesta completa y recién ahí se pedía la siguiente, así que
// una tabla de 5000 filas pagaba 5 viajes de red seguidos. Pidiendo varias
// páginas a la vez, esas 5 páginas llegan en el tiempo de un solo viaje de red
// (limitado por la más lenta de la tanda, no por la suma de todas).
const PARALLEL_BATCH = 5;

// PostgREST solo devuelve 1000 filas por consulta si no se pagina explícitamente
// (con .range()). Cualquier tabla que ya supere esa cantidad de filas (como
// "viajes") queda truncada en silencio si se consulta sin paginar. Esta función
// trae TODAS las filas de una consulta, sin importar cuántas haya, pidiendo los
// bloques de 1000 en tandas paralelas hasta que una tanda entrega una página
// incompleta (esa es la señal de que ya no hay más filas).
export const fetchAllRows = async <T,>(
    build: (query: typeof supabase, from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> => {
    const paginas: T[][] = [];
    let paginaInicial = 0;
    let hayMas = true;

    while (hayMas) {
        const tanda = await Promise.all(
            Array.from({ length: PARALLEL_BATCH }, (_, i) => {
                const desde = (paginaInicial + i) * PAGE_SIZE;
                return build(supabase, desde, desde + PAGE_SIZE - 1);
            })
        );

        for (const { data, error } of tanda) {
            if (error) throw error;
            const filas = data ?? [];
            paginas.push(filas);
            if (filas.length < PAGE_SIZE) {
                hayMas = false;
                break; // el resto de la tanda ya no hace falta: no puede haber más filas después de una página incompleta
            }
        }

        paginaInicial += PARALLEL_BATCH;
    }

    return paginas.flat();
};
