import * as XLSX from 'xlsx';
import { fetchTarjetasApu, TarjetaApu } from './tarjetasApuService';

// La Matriz de Precios Unitarios es un reporte de solo lectura sobre las tarjetas ya calculadas:
// reutiliza fetchTarjetasApu (misma fuente que la lista de Tarjetas) y solo agrega el export a Excel.
export const fetchMatrizApu = async (): Promise<TarjetaApu[]> => {
    return fetchTarjetasApu();
};

export const exportarMatrizApuExcel = (tarjetas: TarjetaApu[]): void => {
    const filas = tarjetas.map((t) => ({
        Clave: t.concepto_clave,
        Descripción: t.concepto_descripcion,
        Unidad: t.concepto_unidad,
        Categoría: t.categoria_nombre,
        'Costo Materiales': t.costo_materiales,
        'Costo Mano de Obra': t.costo_mano_obra,
        'Costo Maquinaria': t.costo_maquinaria,
        'Costo Herramienta': t.costo_herramienta,
        'Costo Directo': t.costo_directo,
        '% Material': Number((t.pct_material ?? 0).toFixed(2)),
        '% Mano de Obra': Number((t.pct_mano_obra ?? 0).toFixed(2)),
        '% Maquinaria': Number((t.pct_maquinaria ?? 0).toFixed(2)),
        '% Indirectos': t.pct_indirectos,
        '% Financiamiento': t.pct_financiamiento,
        '% Utilidad': t.pct_utilidad,
        'Precio Unitario': t.precio_unitario
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);
    XLSX.utils.book_append_sheet(wb, ws, 'Matriz APU');
    XLSX.writeFile(wb, `Matriz_Precios_Unitarios_${new Date().toISOString().split('T')[0]}.xlsx`);
};
