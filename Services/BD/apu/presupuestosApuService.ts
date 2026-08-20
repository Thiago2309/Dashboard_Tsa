import ExcelJS from 'exceljs';
import { supabase } from '../../superbase.service';
import { convertirImporteALetras } from './numeroALetrasApu';

export interface PresupuestoConceptoApu {
    id?: number;
    id_frente?: number;
    id_concepto: number;
    concepto_clave?: string;
    concepto_descripcion?: string;
    concepto_unidad?: string;
    orden: number;
    cantidad: number;
    precio_unitario: number;
    importe?: number;
    aplica_iva: boolean;
}

export interface PresupuestoFrenteApu {
    id?: number;
    id_presupuesto?: number;
    nombre: string;
    orden: number;
    conceptos: PresupuestoConceptoApu[];
}

export interface PresupuestoApu {
    id?: number;
    nombre: string;
    empresa_nombre: string;
    dependencia: string;
    concurso_no: string;
    fecha: string;
    obra_nombre: string;
    lugar: string;
    pct_iva: number;
    subtotal?: number;
    monto_iva?: number;
    total?: number;
    status?: boolean;
    frentes?: PresupuestoFrenteApu[];
}

export interface TotalesPresupuestoApu {
    subtotal: number;
    monto_iva: number;
    total: number;
}

const importeLinea = (c: PresupuestoConceptoApu) => (c.cantidad || 0) * (c.precio_unitario || 0);

export const calcularSubtotalFrente = (frente: PresupuestoFrenteApu): number => (frente.conceptos || []).reduce((acc, c) => acc + importeLinea(c), 0);

// Calcula subtotal, IVA y total a partir de una lista plana de conceptos. El IVA solo se aplica sobre
// los conceptos marcados con aplica_iva (algunos conceptos pueden estar exentos).
export const calcularTotalesDesdeConceptos = (conceptos: PresupuestoConceptoApu[], pct_iva: number): TotalesPresupuestoApu => {
    const subtotal = conceptos.reduce((acc, c) => acc + importeLinea(c), 0);
    const baseGravable = conceptos.filter((c) => c.aplica_iva).reduce((acc, c) => acc + importeLinea(c), 0);
    const monto_iva = baseGravable * ((pct_iva || 0) / 100);

    return { subtotal, monto_iva, total: subtotal + monto_iva };
};

// Calcula subtotal, IVA y total del presupuesto a partir de sus Frentes.
export const calcularTotalesPresupuesto = (frentes: PresupuestoFrenteApu[], pct_iva: number): TotalesPresupuestoApu => {
    return calcularTotalesDesdeConceptos(
        frentes.flatMap((f) => f.conceptos || []),
        pct_iva
    );
};

const transformPresupuestoApuData = (data: any): PresupuestoApu => ({
    id: data.id,
    nombre: data.nombre,
    empresa_nombre: data.empresa_nombre ?? '',
    dependencia: data.dependencia ?? '',
    concurso_no: data.concurso_no ?? '',
    fecha: data.fecha,
    obra_nombre: data.obra_nombre ?? '',
    lugar: data.lugar ?? '',
    pct_iva: data.pct_iva ?? 16,
    subtotal: data.subtotal ?? 0,
    monto_iva: data.monto_iva ?? 0,
    total: data.total ?? 0,
    status: data.status ?? true
});

const transformFrenteApuData = (data: any): PresupuestoFrenteApu => ({
    id: data.id,
    id_presupuesto: data.id_presupuesto,
    nombre: data.nombre,
    orden: data.orden ?? 0,
    conceptos: []
});

const transformPresupuestoConceptoApuData = (data: any): PresupuestoConceptoApu => ({
    id: data.id,
    id_frente: data.id_frente,
    id_concepto: data.id_concepto,
    concepto_clave: data.concepto_clave ?? '',
    concepto_descripcion: data.concepto_descripcion ?? '',
    concepto_unidad: data.concepto_unidad ?? '',
    orden: data.orden ?? 0,
    cantidad: data.cantidad ?? 0,
    precio_unitario: data.precio_unitario ?? 0,
    importe: data.importe ?? 0,
    aplica_iva: data.aplica_iva ?? true
});

export const fetchPresupuestosApu = async (): Promise<PresupuestoApu[]> => {
    const { data, error } = await supabase.from('fetch_apu_presupuestos').select('*').order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching Presupuestos APU:', error);
        throw error;
    }

    return data?.map(transformPresupuestoApuData) || [];
};

export const fetchPresupuestoApuPorId = async (id: number): Promise<PresupuestoApu> => {
    const { data: cabecera, error: errorCabecera } = await supabase.from('fetch_apu_presupuestos').select('*').eq('id', id).single();
    if (errorCabecera) {
        console.error('Error fetching Presupuesto APU por id:', errorCabecera);
        throw errorCabecera;
    }

    const { data: frentesRaw, error: errorFrentes } = await supabase.from('fetch_apu_presupuesto_frentes').select('*').eq('id_presupuesto', id).order('orden');
    if (errorFrentes) {
        console.error('Error fetching Frentes de Presupuesto APU:', errorFrentes);
        throw errorFrentes;
    }

    const { data: conceptosRaw, error: errorConceptos } = await supabase.from('fetch_apu_presupuesto_conceptos').select('*').eq('id_presupuesto', id).order('orden');
    if (errorConceptos) {
        console.error('Error fetching conceptos de Presupuesto APU:', errorConceptos);
        throw errorConceptos;
    }

    const frentes = (frentesRaw || []).map(transformFrenteApuData);
    (conceptosRaw || []).map(transformPresupuestoConceptoApuData).forEach((concepto) => {
        const frente = frentes.find((f) => f.id === concepto.id_frente);
        if (frente) frente.conceptos.push(concepto);
    });

    return { ...transformPresupuestoApuData(cabecera), frentes };
};

// Clona la Tarjeta de Precio Unitario maestra de un concepto hacia una tabla propia del presupuesto
// (apu_presupuesto_tarjetas / apu_presupuesto_tarjeta_insumos), sin tocar la tarjeta maestra.
// Así cada presupuesto conserva su propia copia editable, aunque luego se ajusten los precios maestros.
const clonarTarjetaHaciaPresupuesto = async (id_presupuesto: number, id_presupuesto_concepto: number, id_concepto: number): Promise<void> => {
    const { data: tarjetaMaestra, error: errorTarjeta } = await supabase.from('fetch_apu_tarjetas').select('*').eq('id_concepto', id_concepto).maybeSingle();
    if (errorTarjeta || !tarjetaMaestra) return;

    const { data: insumosMaestros, error: errorInsumos } = await supabase.from('fetch_apu_tarjeta_insumos').select('*').eq('id_tarjeta', tarjetaMaestra.id).order('id');
    if (errorInsumos) return;

    const { data: tarjetaClonada, error: errorClon } = await supabase
        .from('apu_presupuesto_tarjetas')
        .insert([
            {
                id_presupuesto,
                id_presupuesto_concepto,
                id_concepto,
                rendimiento: tarjetaMaestra.rendimiento,
                jornada_horas: tarjetaMaestra.jornada_horas,
                pct_herramienta: tarjetaMaestra.pct_herramienta,
                pct_indirectos: tarjetaMaestra.pct_indirectos,
                pct_financiamiento: tarjetaMaestra.pct_financiamiento,
                pct_utilidad: tarjetaMaestra.pct_utilidad,
                pct_cargos_adicionales: tarjetaMaestra.pct_cargos_adicionales,
                notas: tarjetaMaestra.notas,
                costo_materiales: tarjetaMaestra.costo_materiales,
                costo_mano_obra: tarjetaMaestra.costo_mano_obra,
                costo_maquinaria: tarjetaMaestra.costo_maquinaria,
                costo_herramienta: tarjetaMaestra.costo_herramienta,
                costo_directo: tarjetaMaestra.costo_directo,
                pct_material: tarjetaMaestra.pct_material,
                pct_mano_obra: tarjetaMaestra.pct_mano_obra,
                pct_maquinaria: tarjetaMaestra.pct_maquinaria,
                monto_indirectos: tarjetaMaestra.monto_indirectos,
                monto_financiamiento: tarjetaMaestra.monto_financiamiento,
                monto_utilidad: tarjetaMaestra.monto_utilidad,
                monto_cargos_adicionales: tarjetaMaestra.monto_cargos_adicionales,
                precio_unitario: tarjetaMaestra.precio_unitario
            }
        ])
        .select('id')
        .single();

    if (errorClon || !tarjetaClonada || !insumosMaestros || insumosMaestros.length === 0) return;

    await supabase.from('apu_presupuesto_tarjeta_insumos').insert(
        insumosMaestros.map((i: any) => ({
            id_presupuesto_tarjeta: tarjetaClonada.id,
            id_insumo: i.id_insumo,
            tipo: i.tipo,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
            importe: i.importe
        }))
    );

    const idsMaquinaria = Array.from(new Set(insumosMaestros.filter((i: any) => i.tipo === 'MAQUINARIA').map((i: any) => i.id_insumo as number)));
    await Promise.all(idsMaquinaria.map((idInsumo) => clonarMaquinariaHaciaPresupuesto(id_presupuesto, idInsumo)));
};

// Clona el Costo Horario de Maquinaria maestro hacia una tabla propia del presupuesto
// (apu_presupuesto_maquinaria), sin tocar la maquinaria maestra. Se comparte entre todas las tarjetas
// del mismo presupuesto que usen la misma maquinaria (no se duplica si ya existe para este presupuesto).
const clonarMaquinariaHaciaPresupuesto = async (id_presupuesto: number, id_insumo: number): Promise<void> => {
    const { data: yaClonada } = await supabase.from('apu_presupuesto_maquinaria').select('id').eq('id_presupuesto', id_presupuesto).eq('id_insumo', id_insumo).maybeSingle();
    if (yaClonada) return;

    const { data: maquinariaMaestra, error } = await supabase.from('fetch_apu_maquinaria').select('*').eq('id_insumo', id_insumo).maybeSingle();
    if (error || !maquinariaMaestra) return;

    await supabase.from('apu_presupuesto_maquinaria').insert([
        {
            id_presupuesto,
            id_maquinaria: maquinariaMaestra.id,
            id_insumo,
            clave: maquinariaMaestra.clave,
            descripcion: maquinariaMaestra.descripcion,
            marca_modelo: maquinariaMaestra.marca_modelo,
            tipo_calculo: maquinariaMaestra.tipo_calculo,
            valor_adquisicion: maquinariaMaestra.valor_adquisicion,
            valor_rescate_pct: maquinariaMaestra.valor_rescate_pct,
            vida_util_anios: maquinariaMaestra.vida_util_anios,
            horas_uso_anual: maquinariaMaestra.horas_uso_anual,
            tasa_interes_pct: maquinariaMaestra.tasa_interes_pct,
            tasa_seguros_pct: maquinariaMaestra.tasa_seguros_pct,
            factor_mantenimiento_pct: maquinariaMaestra.factor_mantenimiento_pct,
            consumo_combustible_litros_hora: maquinariaMaestra.consumo_combustible_litros_hora,
            precio_combustible_litro: maquinariaMaestra.precio_combustible_litro,
            consumo_lubricantes_pct: maquinariaMaestra.consumo_lubricantes_pct,
            costo_llantas_hora: maquinariaMaestra.costo_llantas_hora,
            otros_consumibles_hora: maquinariaMaestra.otros_consumibles_hora,
            precio_flete: maquinariaMaestra.precio_flete,
            abundamiento: maquinariaMaestra.abundamiento,
            costo_fijo_hora: maquinariaMaestra.costo_fijo_hora,
            costo_operacion_hora: maquinariaMaestra.costo_operacion_hora,
            costo_hora_total: maquinariaMaestra.costo_hora_total
        }
    ]);
};

// Guarda los frentes y conceptos del presupuesto conservando los ids existentes (actualiza en vez de
// borrar-e-insertar), para no perder las Tarjetas de Precio Unitario ya clonadas y editadas por
// presupuesto. Solo se borran los frentes/conceptos que el usuario realmente quitó, y solo se clona
// una tarjeta nueva cuando se agrega un concepto que antes no estaba.
const guardarFrentesPresupuestoApu = async (id_presupuesto: number, frentes: PresupuestoFrenteApu[]): Promise<void> => {
    const { data: frentesExistentes } = await supabase.from('apu_presupuesto_frentes').select('id').eq('id_presupuesto', id_presupuesto);
    const idsFrentesExistentes = (frentesExistentes || []).map((f) => f.id as number);
    const idsFrentesConservados: number[] = [];

    for (let i = 0; i < frentes.length; i++) {
        const frente = frentes[i];
        let idFrente = frente.id;

        if (idFrente) {
            const { error } = await supabase.from('apu_presupuesto_frentes').update({ nombre: frente.nombre, orden: i }).eq('id', idFrente);
            if (error) {
                console.error('Error actualizando Frente de Presupuesto APU:', error);
                throw error;
            }
        } else {
            const { data, error } = await supabase.from('apu_presupuesto_frentes').insert([{ id_presupuesto, nombre: frente.nombre, orden: i }]).select('id').single();
            if (error) {
                console.error('Error creando Frente de Presupuesto APU:', error);
                throw error;
            }
            idFrente = data.id;
        }

        idsFrentesConservados.push(idFrente!);

        const { data: conceptosExistentes } = await supabase.from('apu_presupuesto_conceptos').select('id').eq('id_frente', idFrente);
        const idsConceptosExistentes = (conceptosExistentes || []).map((c) => c.id as number);
        const idsConceptosConservados: number[] = [];

        for (let j = 0; j < frente.conceptos.length; j++) {
            const concepto = frente.conceptos[j];
            const datos = {
                id_frente: idFrente,
                id_concepto: concepto.id_concepto,
                orden: j,
                cantidad: concepto.cantidad,
                precio_unitario: concepto.precio_unitario,
                importe: importeLinea(concepto),
                aplica_iva: concepto.aplica_iva
            };

            if (concepto.id) {
                const { error } = await supabase.from('apu_presupuesto_conceptos').update(datos).eq('id', concepto.id);
                if (error) {
                    console.error('Error actualizando concepto de Presupuesto APU:', error);
                    throw error;
                }
                idsConceptosConservados.push(concepto.id);
            } else {
                const { data, error } = await supabase.from('apu_presupuesto_conceptos').insert([datos]).select('id').single();
                if (error) {
                    console.error('Error creando concepto de Presupuesto APU:', error);
                    throw error;
                }
                idsConceptosConservados.push(data.id);
                await clonarTarjetaHaciaPresupuesto(id_presupuesto, data.id, concepto.id_concepto);
            }
        }

        const idsConceptosAEliminar = idsConceptosExistentes.filter((id) => !idsConceptosConservados.includes(id));
        if (idsConceptosAEliminar.length > 0) {
            const { error } = await supabase.from('apu_presupuesto_conceptos').delete().in('id', idsConceptosAEliminar);
            if (error) {
                console.error('Error eliminando conceptos removidos de Presupuesto APU:', error);
                throw error;
            }
        }
    }

    const idsFrentesAEliminar = idsFrentesExistentes.filter((id) => !idsFrentesConservados.includes(id));
    if (idsFrentesAEliminar.length > 0) {
        const { error } = await supabase.from('apu_presupuesto_frentes').delete().in('id', idsFrentesAEliminar);
        if (error) {
            console.error('Error eliminando Frentes removidos de Presupuesto APU:', error);
            throw error;
        }
    }
};

// Crea la cabecera del presupuesto y sus frentes/conceptos. Sin soporte de transacciones en este
// proyecto: si falla el detalle, se elimina la cabecera recién creada (la cascada limpia lo demás).
export const createPresupuestoApu = async (presupuesto: PresupuestoApu): Promise<PresupuestoApu> => {
    const totales = calcularTotalesPresupuesto(presupuesto.frentes || [], presupuesto.pct_iva);

    const { data, error } = await supabase
        .from('apu_presupuestos')
        .insert([
            {
                nombre: presupuesto.nombre,
                empresa_nombre: presupuesto.empresa_nombre,
                dependencia: presupuesto.dependencia,
                concurso_no: presupuesto.concurso_no,
                fecha: presupuesto.fecha,
                obra_nombre: presupuesto.obra_nombre,
                lugar: presupuesto.lugar,
                pct_iva: presupuesto.pct_iva ?? 16,
                status: presupuesto.status ?? true,
                ...totales
            }
        ])
        .select('id')
        .single();

    if (error) {
        console.error('Error creating Presupuesto APU:', error);
        throw error;
    }

    try {
        await guardarFrentesPresupuestoApu(data.id, presupuesto.frentes || []);
    } catch (errorDetalle) {
        await supabase.from('apu_presupuestos').delete().eq('id', data.id);
        throw errorDetalle;
    }

    return fetchPresupuestoApuPorId(data.id);
};

export const updatePresupuestoApu = async (presupuesto: PresupuestoApu): Promise<PresupuestoApu> => {
    const totales = calcularTotalesPresupuesto(presupuesto.frentes || [], presupuesto.pct_iva);

    const { error } = await supabase
        .from('apu_presupuestos')
        .update({
            nombre: presupuesto.nombre,
            empresa_nombre: presupuesto.empresa_nombre,
            dependencia: presupuesto.dependencia,
            concurso_no: presupuesto.concurso_no,
            fecha: presupuesto.fecha,
            obra_nombre: presupuesto.obra_nombre,
            lugar: presupuesto.lugar,
            pct_iva: presupuesto.pct_iva ?? 16,
            status: presupuesto.status ?? true,
            updated_at: new Date().toISOString(),
            ...totales
        })
        .eq('id', presupuesto.id);

    if (error) {
        console.error('Error updating Presupuesto APU:', error);
        throw error;
    }

    await guardarFrentesPresupuestoApu(presupuesto.id!, presupuesto.frentes || []);

    return fetchPresupuestoApuPorId(presupuesto.id!);
};

// Actualiza el renglón del presupuesto (precio_unitario/importe) y recalcula el Subtotal/IVA/Total de la
// cabecera. La usan tanto el editor de Tarjetas por Presupuesto como el de Costo de Maquinaria por
// Presupuesto, ya que ambos pueden cambiar el precio de un concepto sin pasar por el editor de Presupuesto.
export const propagarPrecioAConceptoYRecalcular = async (id_presupuesto: number, id_presupuesto_concepto: number, nuevoPrecioUnitario: number): Promise<void> => {
    const { data: conceptoActual, error: errorConcepto } = await supabase.from('apu_presupuesto_conceptos').select('cantidad').eq('id', id_presupuesto_concepto).single();
    if (errorConcepto) {
        console.error('Error leyendo renglón de Presupuesto APU a actualizar:', errorConcepto);
        throw errorConcepto;
    }

    const nuevoImporte = (conceptoActual.cantidad || 0) * nuevoPrecioUnitario;

    const { error: errorUpdateConcepto } = await supabase
        .from('apu_presupuesto_conceptos')
        .update({ precio_unitario: nuevoPrecioUnitario, importe: nuevoImporte })
        .eq('id', id_presupuesto_concepto);

    if (errorUpdateConcepto) {
        console.error('Error propagando precio al renglón de Presupuesto APU:', errorUpdateConcepto);
        throw errorUpdateConcepto;
    }

    const { data: presupuestoActual, error: errorPresupuesto } = await supabase.from('apu_presupuestos').select('pct_iva').eq('id', id_presupuesto).single();
    if (errorPresupuesto) {
        console.error('Error leyendo Presupuesto APU a recalcular:', errorPresupuesto);
        throw errorPresupuesto;
    }

    const { data: todosLosConceptos, error: errorConceptos } = await supabase.from('fetch_apu_presupuesto_conceptos').select('cantidad, precio_unitario, aplica_iva').eq('id_presupuesto', id_presupuesto);
    if (errorConceptos) {
        console.error('Error leyendo conceptos de Presupuesto APU para recalcular:', errorConceptos);
        throw errorConceptos;
    }

    const totalesPresupuesto = calcularTotalesDesdeConceptos((todosLosConceptos || []) as PresupuestoConceptoApu[], presupuestoActual.pct_iva);

    const { error: errorUpdatePresupuesto } = await supabase
        .from('apu_presupuestos')
        .update({ ...totalesPresupuesto, updated_at: new Date().toISOString() })
        .eq('id', id_presupuesto);

    if (errorUpdatePresupuesto) {
        console.error('Error recalculando totales de Presupuesto APU:', errorUpdatePresupuesto);
        throw errorUpdatePresupuesto;
    }
};

export const deletePresupuestoApu = async (id: number): Promise<void> => {
    const { error } = await supabase.from('apu_presupuestos').delete().eq('id', id);

    if (error) {
        console.error('Error deleting Presupuesto APU:', error);
        throw error;
    }
};

const MONEY_FORMAT = '"$"#,##0.00';
const BORDER_BOTTOM_MEDIUM: Partial<ExcelJS.Borders> = { bottom: { style: 'medium' } };
const BORDER_TOP_THIN: Partial<ExcelJS.Borders> = { top: { style: 'thin' } };

// Exporta el presupuesto a Excel replicando el encabezado, los Frentes con su subtotal
// y el bloque de Subtotal/IVA/Total que se ve en pantalla y al imprimir.
export const exportarPresupuestoApuExcel = async (presupuesto: PresupuestoApu): Promise<void> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema APU - Tsa';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Presupuesto');
    worksheet.columns = [{ width: 14 }, { width: 42 }, { width: 10 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 10 }];

    const agregarFilaMerge = (valor: string, negritas = false) => {
        const fila = worksheet.addRow([valor]);
        worksheet.mergeCells(fila.number, 1, fila.number, 7);
        if (negritas) fila.font = { bold: true };
        return fila;
    };

    agregarFilaMerge(presupuesto.empresa_nombre, true).alignment = { horizontal: 'center' };
    worksheet.getRow(worksheet.rowCount).font = { bold: true, size: 14 };
    agregarFilaMerge(`Dependencia: ${presupuesto.dependencia}`, true);
    agregarFilaMerge(`Concurso No. ${presupuesto.concurso_no}        Fecha: ${presupuesto.fecha}`);
    agregarFilaMerge(`Obra: ${presupuesto.obra_nombre}`).alignment = { wrapText: true };
    agregarFilaMerge(`Lugar: ${presupuesto.lugar}`).alignment = { wrapText: true };
    worksheet.addRow([]);

    const filaTitulo = agregarFilaMerge('PRESUPUESTO DE OBRA', true);
    filaTitulo.alignment = { horizontal: 'center' };
    filaTitulo.font = { bold: true, size: 13 };
    worksheet.addRow([]);

    const headerRow = worksheet.addRow(['Código', 'Concepto', 'Unidad', 'Cantidad', 'P. Unitario', 'Importe', '%']);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };
    headerRow.eachCell((cell) => (cell.border = BORDER_BOTTOM_MEDIUM));

    const frentes = presupuesto.frentes || [];
    const subtotal = presupuesto.subtotal || 0;
    let hayExentos = false;

    frentes.forEach((frente) => {
        const subtotalFrente = calcularSubtotalFrente(frente);
        const pctDeFrente = (importe: number) => (subtotalFrente > 0 ? importe / subtotalFrente : 0);

        const filaFrente = worksheet.addRow([null, frente.nombre]);
        filaFrente.font = { bold: true };

        frente.conceptos.forEach((c) => {
            const importe = importeLinea(c);
            if (!c.aplica_iva) hayExentos = true;
            const etiqueta = c.aplica_iva ? c.concepto_descripcion : `${c.concepto_descripcion} *`;
            const fila = worksheet.addRow([c.concepto_clave, etiqueta, c.concepto_unidad, c.cantidad, c.precio_unitario, importe, pctDeFrente(importe)]);
            fila.getCell(4).numFmt = '#,##0.0000';
            fila.getCell(5).numFmt = MONEY_FORMAT;
            fila.getCell(6).numFmt = MONEY_FORMAT;
            fila.getCell(7).numFmt = '0.00%';
        });

        const filaSubtotalFrente = worksheet.addRow([null, `Total ${frente.nombre}`, null, null, null, subtotalFrente, 1]);
        filaSubtotalFrente.font = { bold: true };
        filaSubtotalFrente.getCell(6).numFmt = MONEY_FORMAT;
        filaSubtotalFrente.getCell(7).numFmt = '0.00%';
        filaSubtotalFrente.eachCell((cell) => (cell.border = BORDER_TOP_THIN));
        worksheet.addRow([]);
    });

    const filaTotalConceptos = worksheet.addRow([null, 'Total del Presupuesto', null, null, null, subtotal]);
    filaTotalConceptos.font = { bold: true };
    filaTotalConceptos.getCell(6).numFmt = MONEY_FORMAT;
    filaTotalConceptos.eachCell((cell) => (cell.border = BORDER_TOP_THIN));

    if (hayExentos) {
        agregarFilaMerge('* Exento de I.V.A.').font = { italic: true, size: 9 };
    }
    worksheet.addRow([]);

    const filaSubtotal = worksheet.addRow([null, null, null, null, 'Subtotal', subtotal]);
    filaSubtotal.getCell(6).numFmt = MONEY_FORMAT;

    const filaIva = worksheet.addRow([null, null, null, null, `I.V.A. (${presupuesto.pct_iva}%)`, presupuesto.monto_iva]);
    filaIva.getCell(6).numFmt = MONEY_FORMAT;

    const filaTotal = worksheet.addRow([null, null, null, null, 'Total', presupuesto.total]);
    filaTotal.font = { bold: true };
    filaTotal.getCell(6).numFmt = MONEY_FORMAT;
    filaTotal.eachCell((cell) => (cell.border = BORDER_TOP_THIN));

    worksheet.addRow([]);
    const filaLetra = agregarFilaMerge(`( * ${convertirImporteALetras(presupuesto.total || 0)} * )`);
    filaLetra.font = { italic: true };
    filaLetra.alignment = { horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Presupuesto_${(presupuesto.nombre || 'obra').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
