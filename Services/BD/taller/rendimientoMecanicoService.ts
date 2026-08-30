import { fetchOperadores, Operador } from '../operadoresService';
import { fetchPuestos } from '../puestoService';
import { fetchBitacoras, BitacoraTaller } from './bitacoraTallerService';

// Quita acentos y normaliza mayúsculas/espacios para poder comparar nombres/puestos
// escritos de formas ligeramente distintas (p. ej. "Mecánico" vs "mecanico").
const normalizarTexto = (v: string | null | undefined): string =>
    (v || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const esPuestoMecanico = (nombrePuesto: string | null | undefined): boolean =>
    normalizarTexto(nombrePuesto).includes('mecanico');

export interface RendimientoMecanico {
    operador: Operador;
    trabajos: BitacoraTaller[];
    totalTrabajos: number;
    trabajosAbiertos: number;
    totalCostoManoObra: number;
}

// Trae a todos los empleados con puesto "Mecánico" (por puesto_id o por el campo de
// texto legado `puesto`) junto con las bitácoras de taller que se les asignaron
// (comparando por nombre contra `tecnico_asignado`, que es como hoy se registra el
// técnico en la Bitácora de Taller) y el costo de mano de obra acumulado de cada uno.
export const fetchRendimientoMecanicos = async (): Promise<RendimientoMecanico[]> => {
    const [puestos, operadores, bitacoras] = await Promise.all([
        fetchPuestos(),
        fetchOperadores(),
        fetchBitacoras()
    ]);

    const idsPuestoMecanico = new Set(
        puestos.filter(p => esPuestoMecanico(p.nombre)).map(p => p.id)
    );

    const mecanicos = operadores.filter(op => {
        if (op.puesto_id && idsPuestoMecanico.has(op.puesto_id)) return true;
        return esPuestoMecanico(op.puesto);
    });

    const bitacorasPorTecnico = new Map<string, BitacoraTaller[]>();
    bitacoras.forEach(b => {
        const key = normalizarTexto(b.tecnico_asignado);
        if (!key) return;
        if (!bitacorasPorTecnico.has(key)) bitacorasPorTecnico.set(key, []);
        bitacorasPorTecnico.get(key)!.push(b);
    });

    return mecanicos
        .map(op => {
            const trabajos = bitacorasPorTecnico.get(normalizarTexto(op.nombre)) || [];
            return {
                operador: op,
                trabajos,
                totalTrabajos: trabajos.length,
                trabajosAbiertos: trabajos.filter(t => t.estatus_bitacora !== 'Resuelta').length,
                totalCostoManoObra: trabajos.reduce((sum, t) => sum + (t.costo_mano_obra || 0), 0)
            };
        })
        .sort((a, b) => a.operador.nombre.localeCompare(b.operador.nombre));
};
