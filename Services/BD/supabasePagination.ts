import { supabase } from '../superbase.service';

const PAGE_SIZE = 1000;

// PostgREST solo devuelve 1000 filas por consulta si no se pagina explícitamente
// (con .range()). Cualquier tabla que ya supere esa cantidad de filas (como
// "viajes") queda truncada en silencio si se consulta sin paginar. Esta función
// trae TODAS las filas de una consulta, sin importar cuántas haya, repitiendo la
// consulta en bloques de 1000 hasta que ya no vengan más resultados.
export const fetchAllRows = async <T,>(
    build: (query: typeof supabase, from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> => {
    const filas: T[] = [];
    let desde = 0;

    while (true) {
        const { data, error } = await build(supabase, desde, desde + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        filas.push(...data);
        if (data.length < PAGE_SIZE) break;
        desde += PAGE_SIZE;
    }

    return filas;
};
