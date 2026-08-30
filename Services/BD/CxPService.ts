import { supabase } from '../superbase.service';
import { PostgrestError } from '@supabase/supabase-js';
import { fetchAllRows } from './supabasePagination';

export type TipoEntidad = 'Proveedor' | 'Cliente' | 'Colaborador' | 'Invitado' | string;

const fetchTodosLosViajesConInvitado = (): Promise<{ id_invitado: string | number | null; caphrsviajes: number | null }[]> =>
    fetchAllRows((sb, from, to) =>
        sb.from('viajes')
          .select('id_invitado, caphrsviajes')
          .not('id_invitado', 'is', null)
          .range(from, to)
    );

// Nota: se usa total_invitado (lo que se le PAGA al invitado), no total (lo que se le
// cobra al cliente) — un mismo registro de renta puede tener cliente e invitado a la vez.
const fetchTodosLosRentasConInvitado = (): Promise<{ id_invitado: number | null; total_invitado: number | null }[]> =>
    fetchAllRows((sb, from, to) =>
        sb.from('renta_maquinaria')
          .select('id_invitado, total_invitado')
          .not('id_invitado', 'is', null)
          .range(from, to)
    );

export interface CuentaPorPagarBase {
    id?: number;
    id_entidad: number | null;
    tipo_entidad: TipoEntidad;
    nombre_colaborador?: string;
    id_compra: number | null;
    fecha: string;
    monto: number;
    saldo: number;
    estatus: 'Pendiente' | 'Pagado' | 'Cancelado';
}

export interface CuentaPorPagar extends CuentaPorPagarBase {
    metodo_pago?: string;
    referencia?: string;
    fecha_pago?: string | null;
    fecha_pago_esperado?: string | null;
    notas?: string;
    entidad_nombre?: string;
    adeudo?: number;
}

export interface ResumenEntidad {
    id_entidad: number;
    entidad_nombre: string;
    total_adeudado: number;
    total_monto_pagado: number;
    cuentas_pendientes: number;
    tipo: TipoEntidad;
    etiquetas?: string[]; // solo aplica a Invitado: 'camion' y/o 'maquinaria'
}

export interface PagoCxP {
    id?: number;
    id_cuenta: number;
    monto: number;
    metodo_pago: string;
    referencia?: string;
    fecha?: string;
}

const transformCuentaData = (data: any): CuentaPorPagar => {
    const cuenta: CuentaPorPagar = {
        id: data.id,
        id_entidad: data.id_entidad,
        tipo_entidad: data.tipo_entidad,
        nombre_colaborador: data.nombre_colaborador,
        id_compra: data.id_compra,
        fecha: data.fecha,
        monto: data.monto || 0,
        saldo: data.saldo || 0,
        adeudo: (data.saldo || 0) - (data.monto || 0),
        estatus: data.estatus || 'Pendiente'
    };

    if (data.metodo_pago) cuenta.metodo_pago = data.metodo_pago;
    if (data.referencia) cuenta.referencia = data.referencia;
    if (data.fecha_pago) cuenta.fecha_pago = data.fecha_pago;
    if (data.fecha_pago_esperado) cuenta.fecha_pago_esperado = data.fecha_pago_esperado;
    if (data.notas) cuenta.notas = data.notas;
    
    cuenta.entidad_nombre = data.tipo_entidad === 'Colaborador' 
        ? data.nombre_colaborador 
        : data.proveedor?.nombre || data.cliente?.empresa || 'Desconocido';

    return cuenta;
};

export const fetchTodosProveedores = async (): Promise<{id: number, nombre: string}[]> => {
    const { data, error } = await supabase
        .from('proveedor')
        .select('id, nombre')
        .order('nombre', { ascending: true });

    if (error) throw error;
    
    // Mapear manualmente los resultados
    return data?.map(proveedor => ({
        id: proveedor.id,
        nombre: proveedor.nombre
    })) || [];
};

export const fetchTodosInvitados = async (): Promise<{id: number, nombre: string}[]> => {
    const { data, error } = await supabase
        .from('invitados')
        .select('id, empresa')
        .order('empresa', { ascending: true });

    if (error) throw error;

    return data?.map(invitado => ({
        id: invitado.id,
        nombre: invitado.empresa
    })) || [];
};

export const fetchEntidadesConCuentas = async (tipo?: TipoEntidad): Promise<ResumenEntidad[]> => {
    if (tipo === 'Colaborador') {
        const { data, error } = await supabase
            .from('cuentas_por_pagar')
            .select('*')
            .eq('tipo_entidad', 'Colaborador')
            .order('nombre_colaborador', { ascending: true });

        if (error) throw error;

        // Agrupar por nombre_colaborador
        const colaboradoresMap = new Map();
        data?.forEach(cuenta => {
            const nombre = cuenta.nombre_colaborador || 'Colaborador sin nombre';
            if (!colaboradoresMap.has(nombre)) {
                colaboradoresMap.set(nombre, {
                    total_adeudado: 0,
                    total_monto_pagado: 0,
                    cuentas_pendientes: 0
                });
            }
            const colab = colaboradoresMap.get(nombre);
            colab.total_adeudado += (cuenta.saldo || 0) - (cuenta.monto || 0);
            colab.total_monto_pagado += cuenta.monto || 0;
            if (cuenta.estatus === 'Pendiente') colab.cuentas_pendientes++;
        });

        return Array.from(colaboradoresMap.entries()).map(([nombre, stats]) => ({
            id_entidad: 0,
            entidad_nombre: nombre,
            total_adeudado: stats.total_adeudado,
            total_monto_pagado: stats.total_monto_pagado,
            cuentas_pendientes: stats.cuentas_pendientes,
            tipo: 'Colaborador'
        }));
    }

    // Para proveedores - obtener todos los proveedores y sus cuentas
    const { data: proveedores, error: errorProveedores } = await supabase
        .from('proveedor')
        .select('id, nombre');

    if (errorProveedores) throw errorProveedores;

    const { data: cuentasProveedor } = await supabase
        .from('cuentas_por_pagar')
        .select('*')
        .eq('tipo_entidad', 'Proveedor');

    const resumenProveedores = proveedores?.map(proveedor => {
        const cuentas = cuentasProveedor?.filter(c => c.id_entidad === proveedor.id) || [];
        const totalAdeudado = cuentas.reduce((sum, c) => sum + (c.saldo - (c.monto || 0)), 0);
        const totalPagado = cuentas.reduce((sum, c) => sum + (c.monto || 0), 0);
        const pendientes = cuentas.filter(c => c.estatus === 'Pendiente').length;
        
        return {
            id_entidad: proveedor.id,
            entidad_nombre: proveedor.nombre,
            total_adeudado: totalAdeudado,
            total_monto_pagado: totalPagado,
            cuentas_pendientes: pendientes,
            tipo: 'Proveedor' as TipoEntidad
        };
    }) || [];

    if (tipo === 'Proveedor') return resumenProveedores;

    // Para invitados: el Monto Total se calcula dinámicamente sumando el FLETE (caphrsviajes)
    // de sus viajes vinculados (si tiene etiqueta "camion") y/o el total de sus rentas de
    // maquinaria vinculadas (si tiene etiqueta "maquinaria"), y descontando su % de
    // participación sobre esa suma, igual que en Cuentas por Cobrar (no se confía en el saldo
    // acumulado manualmente en cuentas_por_pagar, que puede quedar desactualizado). El
    // material (total_materia) no forma parte del pago del invitado.
    if (tipo === 'Invitado') {
        const { data: invitados, error: errorInvitados } = await supabase
            .from('invitados')
            .select('id, empresa, porcentaje_participacion, etiquetas');

        if (errorInvitados) throw errorInvitados;

        const [viajesInvitados, rentasInvitados] = await Promise.all([
            fetchTodosLosViajesConInvitado(),
            fetchTodosLosRentasConInvitado()
        ]);

        const totalViajesPorInvitado = viajesInvitados.reduce((acc, v) => {
            if (!v.id_invitado) return acc;
            const key = String(v.id_invitado);
            acc[key] = (acc[key] || 0) + (v.caphrsviajes || 0);
            return acc;
        }, {} as Record<string, number>);

        const totalRentasPorInvitado = rentasInvitados.reduce((acc, r) => {
            if (!r.id_invitado) return acc;
            const key = String(r.id_invitado);
            acc[key] = (acc[key] || 0) + (r.total_invitado || 0);
            return acc;
        }, {} as Record<string, number>);

        const { data: cuentasInvitado } = await supabase
            .from('cuentas_por_pagar')
            .select('*')
            .eq('tipo_entidad', 'Invitado');

        return invitados?.map(invitado => {
            const etiquetas: string[] = (invitado as any).etiquetas || [];

            let totalDeuda = 0;
            if (etiquetas.includes('camion')) {
                totalDeuda += totalViajesPorInvitado[String(invitado.id)] || 0;
            }
            if (etiquetas.includes('maquinaria')) {
                totalDeuda += totalRentasPorInvitado[String(invitado.id)] || 0;
            }

            const porcentaje = (invitado.porcentaje_participacion || 0) / 100;
            const saldoCalculado = totalDeuda * (1 - porcentaje);

            const cuentas = cuentasInvitado?.filter(c => c.id_entidad === invitado.id) || [];
            const totalPagado = cuentas.reduce((sum, c) => sum + (c.monto || 0), 0);
            const pendientes = cuentas.filter(c => c.estatus === 'Pendiente').length;

            return {
                id_entidad: invitado.id,
                entidad_nombre: invitado.empresa,
                total_adeudado: Math.max(0, Number((saldoCalculado - totalPagado).toFixed(2))),
                total_monto_pagado: totalPagado,
                cuentas_pendientes: pendientes,
                tipo: 'Invitado' as TipoEntidad,
                etiquetas
            };
        }) || [];
    }

    // Para clientes
    const { data: clientes, error: errorClientes } = await supabase
        .from('clientes')
        .select('id, empresa');

    if (errorClientes) throw errorClientes;

    const { data: cuentasCliente } = await supabase
        .from('cuentas_por_pagar')
        .select('*')
        .eq('tipo_entidad', 'Cliente');

    const resumenClientes = clientes?.map(cliente => {
        const cuentas = cuentasCliente?.filter(c => c.id_entidad === cliente.id) || [];
        const totalAdeudado = cuentas.reduce((sum, c) => sum + (c.saldo - (c.monto || 0)), 0);
        const totalPagado = cuentas.reduce((sum, c) => sum + (c.monto || 0), 0);
        const pendientes = cuentas.filter(c => c.estatus === 'Pendiente').length;
        
        return {
            id_entidad: cliente.id,
            entidad_nombre: cliente.empresa,
            total_adeudado: totalAdeudado,
            total_monto_pagado: totalPagado,
            cuentas_pendientes: pendientes,
            tipo: 'Cliente' as TipoEntidad
        };
    }) || [];

    return tipo === 'Cliente' ? resumenClientes : [...resumenProveedores, ...resumenClientes];
};

// Recalcula el Monto Total real de un invitado sumando el flete de sus viajes vinculados y
// descontando su % de participación sobre esa suma, y lo persiste en su(s) cuenta(s) por
// pagar (igual que fetchCuentasPorCliente hace con las cuentas por cobrar de clientes).
const fetchCuentasInvitado = async (id_entidad: number): Promise<CuentaPorPagar[]> => {
    const { data: invitado, error: errorInvitado } = await supabase
        .from('invitados')
        .select('empresa, porcentaje_participacion, etiquetas')
        .eq('id', id_entidad)
        .single();

    if (errorInvitado) throw errorInvitado;

    const etiquetas: string[] = (invitado as any).etiquetas || [];
    let totalDeuda = 0;

    if (etiquetas.includes('camion')) {
        const { data: viajes, error: errorViajes } = await supabase
            .from('viajes')
            .select('caphrsviajes')
            .eq('id_invitado', String(id_entidad));

        if (errorViajes) throw errorViajes;
        totalDeuda += viajes?.reduce((sum, v) => sum + (v.caphrsviajes || 0), 0) || 0;
    }

    if (etiquetas.includes('maquinaria')) {
        // total_invitado: lo que se le PAGA al invitado, no lo que se le cobra al cliente.
        const { data: rentas, error: errorRentas } = await supabase
            .from('renta_maquinaria')
            .select('total_invitado')
            .eq('id_invitado', id_entidad);

        if (errorRentas) throw errorRentas;
        totalDeuda += rentas?.reduce((sum, r) => sum + (r.total_invitado || 0), 0) || 0;
    }

    const porcentaje = (invitado.porcentaje_participacion || 0) / 100;
    const saldoCalculado = Number((totalDeuda * (1 - porcentaje)).toFixed(2));

    const { data: cuentas, error: errorCuentas } = await supabase
        .from('cuentas_por_pagar')
        .select('*')
        .eq('tipo_entidad', 'Invitado')
        .eq('id_entidad', id_entidad)
        .order('fecha', { ascending: false });

    if (errorCuentas) throw errorCuentas;
    if (!cuentas || cuentas.length === 0) return [];

    const cuentasActualizadas: CuentaPorPagar[] = [];

    for (const cuenta of cuentas) {
        // Solo las cuentas todavía pendientes reflejan el saldo recalculado; una cuenta ya
        // cancelada conserva su saldo histórico.
        const saldo = cuenta.estatus === 'Cancelado' ? (cuenta.saldo || 0) : saldoCalculado;

        if (cuenta.saldo !== saldo) {
            await supabase.from('cuentas_por_pagar').update({ saldo }).eq('id', cuenta.id);
        }

        const adeudo = Math.max(0, Number((saldo - (cuenta.monto || 0)).toFixed(2)));
        const estatusActualizado: 'Pagado' | 'Pendiente' | 'Cancelado' =
            cuenta.estatus === 'Cancelado' ? 'Cancelado' : adeudo <= 0 ? 'Pagado' : 'Pendiente';

        if (cuenta.estatus !== estatusActualizado) {
            await supabase.from('cuentas_por_pagar').update({ estatus: estatusActualizado }).eq('id', cuenta.id);
        }

        cuentasActualizadas.push({
            ...transformCuentaData({ ...cuenta, saldo, estatus: estatusActualizado }),
            entidad_nombre: invitado.empresa
        });
    }

    return cuentasActualizadas;
};

export const fetchCuentasPorEntidad = async (tipo: TipoEntidad, id_entidad?: number): Promise<CuentaPorPagar[]> => {
    if (tipo === 'Invitado' && id_entidad) {
        return fetchCuentasInvitado(id_entidad);
    }

    let query = supabase
        .from('cuentas_por_pagar')
        .select('*');

    if (tipo === 'Colaborador') {
        query = query.eq('tipo_entidad', 'Colaborador');
    } else if (id_entidad) {
        query = query
            .eq('tipo_entidad', tipo)
            .eq('id_entidad', id_entidad);
    }

    const { data, error } = await query.order('fecha', { ascending: false });

    if (error) throw error;
    
    // Ahora manualmente obtener los nombres de las entidades
    const cuentasConNombres = await Promise.all(
        (data || []).map(async (cuenta) => {
            let entidad_nombre = 'Desconocido';
            
            if (cuenta.tipo_entidad === 'Proveedor' && cuenta.id_entidad) {
                const { data: proveedor } = await supabase
                    .from('proveedor')
                    .select('nombre')
                    .eq('id', cuenta.id_entidad)
                    .single();
                entidad_nombre = proveedor?.nombre || 'Proveedor no encontrado';
            } 
            else if (cuenta.tipo_entidad === 'Cliente' && cuenta.id_entidad) {
                const { data: cliente } = await supabase
                    .from('clientes')
                    .select('empresa')
                    .eq('id', cuenta.id_entidad)
                    .single();
                entidad_nombre = cliente?.empresa || 'Cliente no encontrado';
            }
            else if (cuenta.tipo_entidad === 'Invitado' && cuenta.id_entidad) {
                const { data: invitado } = await supabase
                    .from('invitados')
                    .select('empresa')
                    .eq('id', cuenta.id_entidad)
                    .single();
                entidad_nombre = invitado?.empresa || 'Invitado no encontrado';
            }
            else if (cuenta.tipo_entidad === 'Colaborador') {
                entidad_nombre = cuenta.nombre_colaborador || 'Colaborador';
            }
            
            return {
                ...transformCuentaData(cuenta),
                entidad_nombre
            };
        })
    );
    
    return cuentasConNombres;
};

export const crearCuentaPorPagar = async (cuenta: Omit<CuentaPorPagar, 'id'>): Promise<CuentaPorPagar> => {
    const { data, error } = await supabase
        .from('cuentas_por_pagar')
        .insert([{
            id_entidad: cuenta.tipo_entidad === 'Colaborador' ? null : cuenta.id_entidad,
            tipo_entidad: cuenta.tipo_entidad,
            nombre_colaborador: cuenta.tipo_entidad === 'Colaborador' ? cuenta.nombre_colaborador : null,
            id_compra: cuenta.id_compra,
            fecha: cuenta.fecha,
            saldo: cuenta.saldo,
            monto: 0,
            estatus: 'Pendiente',
            notas: cuenta.notas,
            fecha_pago_esperado: cuenta.fecha_pago_esperado,
            metodo_pago: cuenta.tipo_entidad === 'Colaborador' ? 'Efectivo' : null
        }])
        .select('*')
        .single();

    if (error) throw error;
    return transformCuentaData(data);
};

export const registrarPagoCxP = async (
    id_cuenta: number,
    monto: number,
    metodo_pago: string = 'Efectivo',
    referencia?: string
): Promise<void> => {
    const { error: errorPago } = await supabase
        .from('pagos_cxp')
        .insert({
            id_cuenta,
            monto,
            metodo_pago,
            referencia
        });

    if (errorPago) throw errorPago;

    const { data: pagos, error: errorPagos } = await supabase
        .from('pagos_cxp')
        .select('monto')
        .eq('id_cuenta', id_cuenta);

    if (errorPagos) throw errorPagos;

    const totalAbonado = pagos?.reduce((sum: number, pago: any) => sum + pago.monto, 0) || 0;

    const { data: cuenta, error: errorCuenta } = await supabase
        .from('cuentas_por_pagar')
        .select('saldo')
        .eq('id', id_cuenta)
        .single();

    if (errorCuenta) throw errorCuenta;

    const nuevoEstatus = totalAbonado >= cuenta.saldo ? 'Pagado' : 'Pendiente';

    const { error } = await supabase
        .from('cuentas_por_pagar')
        .update({
            monto: totalAbonado,
            estatus: nuevoEstatus,
            metodo_pago: metodo_pago,
            fecha_pago: nuevoEstatus === 'Pagado' ? new Date().toISOString() : null
        })
        .eq('id', id_cuenta);

    if (error) throw error;
};

export const actualizarFechaPagoEsperadoCxP = async (
    id_cuenta: number, 
    fecha: string | null
): Promise<void> => {
    const { error } = await supabase
        .from('cuentas_por_pagar')
        .update({ fecha_pago_esperado: fecha })
        .eq('id', id_cuenta);

    if (error) throw error;
};

export const fetchHistorialPagosCxP = async (id_cuenta: number): Promise<PagoCxP[]> => {
    const { data, error } = await supabase
        .from('pagos_cxp')
        .select('*')
        .eq('id_cuenta', id_cuenta)
        .order('fecha', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const actualizarPagoCxP = async (
    id_pago: number,
    nuevoMonto: number,
    metodo_pago: string
): Promise<void> => {
    const { error: errorPago } = await supabase
        .from('pagos_cxp')
        .update({ 
            monto: nuevoMonto,
            metodo_pago,
            fecha: new Date().toISOString()
        })
        .eq('id', id_pago);

    if (errorPago) throw errorPago;

    const { data: pago, error: errorGetPago } = await supabase
        .from('pagos_cxp')
        .select('id_cuenta')
        .eq('id', id_pago)
        .single();

    if (errorGetPago) throw errorGetPago;

    const { data: pagos, error: errorPagos } = await supabase
        .from('pagos_cxp')
        .select('monto')
        .eq('id_cuenta', pago.id_cuenta);

    if (errorPagos) throw errorPagos;

    const totalAbonado = pagos?.reduce((sum: number, pago: any) => sum + pago.monto, 0) || 0;

    const { data: cuenta, error: errorCuenta } = await supabase
        .from('cuentas_por_pagar')
        .select('saldo')
        .eq('id', pago.id_cuenta)
        .single();

    if (errorCuenta) throw errorCuenta;

    const nuevoEstatus = totalAbonado >= cuenta.saldo ? 'Pagado' : 'Pendiente';

    const { error } = await supabase
        .from('cuentas_por_pagar')
        .update({
            monto: totalAbonado,
            estatus: nuevoEstatus,
            fecha_pago: nuevoEstatus === 'Pagado' ? new Date().toISOString() : null
        })
        .eq('id', pago.id_cuenta);

    if (error) throw error;
};