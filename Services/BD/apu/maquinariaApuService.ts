import { supabase } from '../../superbase.service';

export interface MaquinariaApu {
    id?: number;
    id_insumo?: number;
    clave: string;
    descripcion: string;
    marca_modelo?: string;
    // Datos base para costo fijo
    valor_adquisicion: number;
    valor_rescate_pct: number;
    vida_util_anios: number;
    horas_uso_anual: number;
    tasa_interes_pct: number;
    tasa_seguros_pct: number;
    factor_mantenimiento_pct: number;
    // Datos base para costo de operación
    consumo_combustible_litros_hora: number;
    precio_combustible_litro: number;
    consumo_lubricantes_pct: number;
    costo_llantas_hora: number;
    otros_consumibles_hora: number;
    // Resultado calculado (se persiste para consulta rápida en la tarjeta/matriz)
    costo_fijo_hora?: number;
    costo_operacion_hora?: number;
    costo_hora_total?: number;
    status?: boolean;
}

export interface DesgloseCostoHorario {
    depreciacion_hora: number;
    inversion_hora: number;
    seguros_hora: number;
    costo_fijo_hora: number;
    combustible_hora: number;
    lubricantes_hora: number;
    llantas_hora: number;
    mantenimiento_hora: number;
    otros_hora: number;
    costo_operacion_hora: number;
    costo_hora_total: number;
}

// Cálculo del costo horario de maquinaria e implementos (costos fijos + costos de operación)
export const calcularCostoHorarioMaquinaria = (m: Partial<MaquinariaApu>): DesgloseCostoHorario => {
    const valorAdquisicion = m.valor_adquisicion || 0;
    const valorRescate = valorAdquisicion * ((m.valor_rescate_pct || 0) / 100);
    const vidaUtilHoras = (m.vida_util_anios || 0) * (m.horas_uso_anual || 0);
    const horasAnuales = m.horas_uso_anual || 0;
    const valorPromedio = (valorAdquisicion + valorRescate) / 2;

    const depreciacion_hora = vidaUtilHoras > 0 ? (valorAdquisicion - valorRescate) / vidaUtilHoras : 0;
    const inversion_hora = horasAnuales > 0 ? (valorPromedio * ((m.tasa_interes_pct || 0) / 100)) / horasAnuales : 0;
    const seguros_hora = horasAnuales > 0 ? (valorPromedio * ((m.tasa_seguros_pct || 0) / 100)) / horasAnuales : 0;
    const costo_fijo_hora = depreciacion_hora + inversion_hora + seguros_hora;

    const combustible_hora = (m.consumo_combustible_litros_hora || 0) * (m.precio_combustible_litro || 0);
    const lubricantes_hora = combustible_hora * ((m.consumo_lubricantes_pct || 0) / 100);
    const llantas_hora = m.costo_llantas_hora || 0;
    const mantenimiento_hora = depreciacion_hora * ((m.factor_mantenimiento_pct || 0) / 100);
    const otros_hora = m.otros_consumibles_hora || 0;
    const costo_operacion_hora = combustible_hora + lubricantes_hora + llantas_hora + mantenimiento_hora + otros_hora;

    return {
        depreciacion_hora,
        inversion_hora,
        seguros_hora,
        costo_fijo_hora,
        combustible_hora,
        lubricantes_hora,
        llantas_hora,
        mantenimiento_hora,
        otros_hora,
        costo_operacion_hora,
        costo_hora_total: costo_fijo_hora + costo_operacion_hora
    };
};

const transformMaquinariaApuData = (data: any): MaquinariaApu => ({
    id: data.id,
    id_insumo: data.id_insumo,
    clave: data.clave,
    descripcion: data.descripcion,
    marca_modelo: data.marca_modelo ?? '',
    valor_adquisicion: data.valor_adquisicion ?? 0,
    valor_rescate_pct: data.valor_rescate_pct ?? 0,
    vida_util_anios: data.vida_util_anios ?? 0,
    horas_uso_anual: data.horas_uso_anual ?? 0,
    tasa_interes_pct: data.tasa_interes_pct ?? 0,
    tasa_seguros_pct: data.tasa_seguros_pct ?? 0,
    factor_mantenimiento_pct: data.factor_mantenimiento_pct ?? 0,
    consumo_combustible_litros_hora: data.consumo_combustible_litros_hora ?? 0,
    precio_combustible_litro: data.precio_combustible_litro ?? 0,
    consumo_lubricantes_pct: data.consumo_lubricantes_pct ?? 0,
    costo_llantas_hora: data.costo_llantas_hora ?? 0,
    otros_consumibles_hora: data.otros_consumibles_hora ?? 0,
    costo_fijo_hora: data.costo_fijo_hora ?? 0,
    costo_operacion_hora: data.costo_operacion_hora ?? 0,
    costo_hora_total: data.costo_hora_total ?? 0,
    status: data.status ?? true,
});

export const fetchMaquinariaApu = async (): Promise<MaquinariaApu[]> => {
    const { data, error } = await supabase
        .from('fetch_apu_maquinaria')
        .select('*')
        .order('descripcion');

    if (error) {
        console.error('Error fetching Maquinaria APU:', error);
        throw error;
    }

    return data?.map(transformMaquinariaApuData) || [];
};

// Crea la maquinaria y su insumo vinculado (tipo MAQUINARIA) en una sola operación
export const createMaquinariaApu = async (maquinaria: Omit<MaquinariaApu, 'id' | 'id_insumo'>): Promise<MaquinariaApu> => {
    const costo = calcularCostoHorarioMaquinaria(maquinaria);

    const { data: insumo, error: errorInsumo } = await supabase
        .from('apu_insumos')
        .insert([{
            clave: maquinaria.clave,
            descripcion: maquinaria.descripcion,
            tipo: 'MAQUINARIA',
            unidad: 'HR',
            precio_unitario: costo.costo_hora_total,
            status: maquinaria.status ?? true
        }])
        .select('*')
        .single();

    if (errorInsumo) {
        console.error('Error creating Insumo de Maquinaria APU:', errorInsumo);
        throw errorInsumo;
    }

    const { data, error } = await supabase
        .from('apu_maquinaria')
        .insert([{
            id_insumo: insumo.id,
            clave: maquinaria.clave,
            descripcion: maquinaria.descripcion,
            marca_modelo: maquinaria.marca_modelo ?? '',
            valor_adquisicion: maquinaria.valor_adquisicion ?? 0,
            valor_rescate_pct: maquinaria.valor_rescate_pct ?? 0,
            vida_util_anios: maquinaria.vida_util_anios ?? 0,
            horas_uso_anual: maquinaria.horas_uso_anual ?? 0,
            tasa_interes_pct: maquinaria.tasa_interes_pct ?? 0,
            tasa_seguros_pct: maquinaria.tasa_seguros_pct ?? 0,
            factor_mantenimiento_pct: maquinaria.factor_mantenimiento_pct ?? 0,
            consumo_combustible_litros_hora: maquinaria.consumo_combustible_litros_hora ?? 0,
            precio_combustible_litro: maquinaria.precio_combustible_litro ?? 0,
            consumo_lubricantes_pct: maquinaria.consumo_lubricantes_pct ?? 0,
            costo_llantas_hora: maquinaria.costo_llantas_hora ?? 0,
            otros_consumibles_hora: maquinaria.otros_consumibles_hora ?? 0,
            costo_fijo_hora: costo.costo_fijo_hora,
            costo_operacion_hora: costo.costo_operacion_hora,
            costo_hora_total: costo.costo_hora_total,
            status: maquinaria.status ?? true
        }])
        .select('*')
        .single();

    if (error) {
        // Revertimos el insumo si falla la creación de la maquinaria, para no dejar un insumo huérfano
        await supabase.from('apu_insumos').delete().eq('id', insumo.id);
        console.error('Error creating Maquinaria APU:', error);
        throw error;
    }

    return transformMaquinariaApuData(data);
};

// Actualiza la maquinaria y sincroniza el precio de su insumo vinculado
export const updateMaquinariaApu = async (maquinaria: MaquinariaApu): Promise<MaquinariaApu> => {
    const costo = calcularCostoHorarioMaquinaria(maquinaria);

    const { data, error } = await supabase
        .from('apu_maquinaria')
        .update({
            clave: maquinaria.clave,
            descripcion: maquinaria.descripcion,
            marca_modelo: maquinaria.marca_modelo ?? '',
            valor_adquisicion: maquinaria.valor_adquisicion ?? 0,
            valor_rescate_pct: maquinaria.valor_rescate_pct ?? 0,
            vida_util_anios: maquinaria.vida_util_anios ?? 0,
            horas_uso_anual: maquinaria.horas_uso_anual ?? 0,
            tasa_interes_pct: maquinaria.tasa_interes_pct ?? 0,
            tasa_seguros_pct: maquinaria.tasa_seguros_pct ?? 0,
            factor_mantenimiento_pct: maquinaria.factor_mantenimiento_pct ?? 0,
            consumo_combustible_litros_hora: maquinaria.consumo_combustible_litros_hora ?? 0,
            precio_combustible_litro: maquinaria.precio_combustible_litro ?? 0,
            consumo_lubricantes_pct: maquinaria.consumo_lubricantes_pct ?? 0,
            costo_llantas_hora: maquinaria.costo_llantas_hora ?? 0,
            otros_consumibles_hora: maquinaria.otros_consumibles_hora ?? 0,
            costo_fijo_hora: costo.costo_fijo_hora,
            costo_operacion_hora: costo.costo_operacion_hora,
            costo_hora_total: costo.costo_hora_total,
            status: maquinaria.status ?? true
        })
        .eq('id', maquinaria.id)
        .select('*')
        .single();

    if (error) {
        console.error('Error updating Maquinaria APU:', error);
        throw error;
    }

    if (maquinaria.id_insumo) {
        const { error: errorInsumo } = await supabase
            .from('apu_insumos')
            .update({
                clave: maquinaria.clave,
                descripcion: maquinaria.descripcion,
                precio_unitario: costo.costo_hora_total,
                status: maquinaria.status ?? true
            })
            .eq('id', maquinaria.id_insumo);

        if (errorInsumo) {
            console.error('Error sincronizando Insumo de Maquinaria APU:', errorInsumo);
            throw errorInsumo;
        }
    }

    return transformMaquinariaApuData(data);
};

// Elimina la maquinaria y su insumo vinculado
export const deleteMaquinariaApu = async (id: number, id_insumo?: number): Promise<void> => {
    const { error } = await supabase
        .from('apu_maquinaria')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting Maquinaria APU:', error);
        throw error;
    }

    if (id_insumo) {
        const { error: errorInsumo } = await supabase.from('apu_insumos').delete().eq('id', id_insumo);
        if (errorInsumo) {
            console.error('Error deleting Insumo de Maquinaria APU vinculado:', errorInsumo);
            throw errorInsumo;
        }
    }
};
