import { ReactNode } from 'react';
import { supabase } from '../superbase.service';
import { CajaChica, createCajaChica } from './cajaChicaService'; // Ajusta la ruta

export interface CuentaPorCobrar {
    adeudo?: number; // Diferencia entre saldo y abonos (saldo - monto)
    id?: number;
    id_cliente: number;
    id_viaje: number | null;
    fecha: string;
    monto: number; // Ahora es la SUMA de todos los pagos (abonos)
    saldo: number; // Total de horas/dinero a deber (fijo)
    estatus: 'Pendiente' | 'Pagado' | 'Cancelado';
    metodo_pago?: string;
    referencia?: string;
    fecha_pago?: string | null;
    fecha_pago_esperado?: string | null;
    notas?: string;
    cliente_nombre?: string;
}

export interface ResumenCliente {
    id_cliente: number;
    cliente_nombre: string;
    total_adeudado: number;
    total_horas_viaje: number;  // Cambiado de ReactNode a number
    total_monto_pagado: number; // Cambiado de función a number
    cuentas_pendientes: number;
}

const transformCuentaData = (data: any): CuentaPorCobrar => ({
    id: data.id, // Aseguras que el id siempre se mapee
    id_cliente: data.id_cliente,
    id_viaje: data.id_viaje,
    fecha: data.fecha,
    monto: data.monto || 0,
    saldo: data.saldo || 0,
    adeudo: data.adeudo || 0,
    estatus: data.estatus || 'Pendiente',
    metodo_pago: data.metodo_pago,
    referencia: data.referencia,
    fecha_pago: data.fecha_pago,
    fecha_pago_esperado: data.fecha_pago_esperado,
    notas: data.notas,
    cliente_nombre: data.cliente?.empresa || data.cliente_nombre
});

export const fetchTodosClientesConCuentas = async (): Promise<ResumenCliente[]> => {
    // 1. Obtener los clientes con sus cuentas
    const { data: clientesData, error: errorClientes } = await supabase
        .from('clientes')
        .select(`
            id,
            empresa,
            porcentaje_administrativo,
            cuentas_por_cobrar (
                id,
                monto
            )
        `);

    if (errorClientes) throw errorClientes;

    // 2. Obtener los viajes y agrupar por cliente
    const { data: viajesData, error: errorViajes } = await supabase
        .from('viajes')
        .select(`
            id_cliente,
            caphrsviajes
        `);

    if (errorViajes) throw errorViajes;

    // 3. Agrupar las horas por cliente
    const horasPorCliente = viajesData?.reduce((acc, viaje) => {
        if (!viaje.id_cliente) return acc;
        acc[viaje.id_cliente] = (acc[viaje.id_cliente] || 0) + (viaje.caphrsviajes || 0);
        return acc;
    }, {} as Record<number, number>);

    // 4. Construir el resumen final
    return clientesData?.map(cliente => {
        const totalMontoPagado = cliente.cuentas_por_cobrar
            ?.reduce((sum, cuenta) => sum + (cuenta.monto || 0), 0) || 0;

         // Calcular total de horas con descuento administrativo si aplica
        let totalHorasViaje = horasPorCliente[cliente.id] || 0;
        
        // Aplicar porcentaje administrativo si existe
        if (cliente.porcentaje_administrativo && cliente.porcentaje_administrativo > 0) {
            const porcentajeAdmin = cliente.porcentaje_administrativo / 100;
            totalHorasViaje = totalHorasViaje * (1 - porcentajeAdmin);
        }

        return {
            id_cliente: cliente.id,
            cliente_nombre: cliente.empresa,
            total_adeudado: totalHorasViaje - totalMontoPagado,
            total_horas_viaje: totalHorasViaje,
            total_monto_pagado: totalMontoPagado,
            cuentas_pendientes: cliente.cuentas_por_cobrar?.length || 0
        } as ResumenCliente;
    }) || [];
};


// export const fetchCuentasPorCliente = async (id_cliente: number): Promise<CuentaPorCobrar[]> => {
//     // Obtenemos las cuentas con sus viajes específicos
//     const { data, error } = await supabase
//         .from('cuentas_por_cobrar')
//         .select(`
//             *,
//             cliente:clientes(empresa),
//             viajes:viajes(
//                 caphrsviajes
//             )
//         `)
//         .eq('id_cliente', id_cliente);

//     if (error) throw error;

//     return data?.map(cuenta => {
//         // Sumamos horas de viaje para esta cuenta específica
//         const horasViaje = cuenta.viajes
//             ?.reduce((sum: any, viaje: { caphrsviajes: any; }) => sum + (viaje.caphrsviajes || 0), 0) || 0;

//         return {
//             ...cuenta,
//             cliente_nombre: cuenta.cliente?.empresa,
//             saldo: horasViaje,
//             monto: cuenta.monto || 0,
//             adeudo: (cuenta.monto || 0) - horasViaje
//         };
//     }) || [];
// };

// export const fetchCuentasPorCliente = async (id_cliente: number): Promise<CuentaPorCobrar[]> => {
//     // Primero obtenemos TODOS los viajes del cliente
//     const { data: viajes, error: errorViajes } = await supabase
//         .from('viajes')
//         .select('id, caphrsviajes')
//         .eq('id_cliente', id_cliente);

//     if (errorViajes) throw errorViajes;

//     // Calculamos el total de horas de todos los viajes
//     const totalHorasViaje = viajes?.reduce((sum, viaje) => sum + (viaje.caphrsviajes || 0), 0) || 0;

//     // Luego obtenemos las cuentas por cobrar
//     const { data: cuentas, error: errorCuentas } = await supabase
//         .from('cuentas_por_cobrar')
//         .select(`
//             *,
//             id,
//             cliente:clientes(empresa)
//         `)
//         .eq('id_cliente', id_cliente)
//         .order('fecha_pago_esperado', { ascending: true });

//     if (errorCuentas) throw errorCuentas;

//     // Si no hay cuentas, devolvemos una cuenta inicial con valores cero
//     if (!cuentas || cuentas.length === 0) {
//         const { data: clienteData } = await supabase
//             .from('clientes')
//             .select('empresa')
//             .eq('id', id_cliente)
//             .single();

//         return [{
//             id_cliente,
//             id_viaje: null,
//             fecha: new Date().toISOString().split('T')[0],
//             monto: 0,
//             saldo: totalHorasViaje, // Usamos el total de horas calculado
//             adeudo: totalHorasViaje, // Inicialmente igual al saldo (0 - totalHorasViaje)
//             estatus: 'Pendiente',
//             cliente_nombre: clienteData?.empresa || '',
//             notas: 'Cuenta inicial'
//         }];
//     }

//     return cuentas.map(cuenta => transformCuentaData({
//         ...cuenta,
//         id: cuenta.id,
//         cliente_nombre: cuenta.cliente?.empresa,
//         saldo: totalHorasViaje,
//         monto: cuenta.monto || 0,
//         adeudo: totalHorasViaje - (cuenta.monto || 0)
//     }));
// };

// export const fetchCuentasPorCliente = async (id_cliente: number): Promise<CuentaPorCobrar[]> => {
//     try {
//         // 1. Obtener viajes del cliente (conservado igual)
//         const { data: viajes, error: errorViajes } = await supabase
//             .from('viajes')
//             .select('id, caphrsviajes')
//             .eq('id_cliente', id_cliente);

//         if (errorViajes) throw errorViajes;
//         const totalHorasViaje = viajes?.reduce((sum, viaje) => sum + (viaje.caphrsviajes || 0), 0) || 0;

//         // 2. Obtenemos cuentas con el tipo correcto (conservado igual)
//         const { data: cuentas, error: errorCuentas } = await supabase
//             .from('cuentas_por_cobrar')
//             .select(`
//                 id,
//                 id_cliente,
//                 id_viaje,
//                 fecha,
//                 monto,
//                 saldo,
//                 estatus,
//                 metodo_pago,
//                 referencia,
//                 fecha_pago,
//                 fecha_pago_esperado,
//                 notas,
//                 cliente:clientes ( empresa ),
//                 pagos!inner ( monto )
//             `)
//             .eq('id_cliente', id_cliente)
//             .order('fecha_pago_esperado', { ascending: true });

//         if (errorCuentas) throw errorCuentas;

//         // 3. Si no hay cuentas, creamos una (conservado igual)
//         if (!cuentas || cuentas.length === 0) {
//             const { data: nuevaCuenta, error: errorCreacion } = await supabase
//                 .from('cuentas_por_cobrar')
//                 .insert({
//                     id_cliente,
//                     fecha: new Date().toISOString().split('T')[0],
//                     monto: 0,
//                     saldo: totalHorasViaje,
//                     estatus: 'Pendiente',
//                     notas: 'Cuenta inicial automática1'
//                 })
//                 .select('*')
//                 .single();

//             if (errorCreacion) throw errorCreacion;

//             const { data: clienteData } = await supabase
//                 .from('clientes')
//                 .select('empresa')
//                 .eq('id', id_cliente)
//                 .single();

//             return [{
//                 ...nuevaCuenta,
//                 cliente_nombre: clienteData?.empresa || '',
//                 adeudo: totalHorasViaje - (nuevaCuenta.monto || 0),
//                 pagos: [] // <- Añadido para consistencia
//             }];
//         }

//         // 4. Mapeamos las cuentas (con la suma de pagos añadida)
//         return cuentas.map(cuenta => {
//             // Calcula el total abonado (suma de todos los pagos)
//             const totalAbonado = cuenta.pagos?.reduce(
//                 (sum: number, pago: any) => sum + (pago.monto || 0), 
//                 0
//             ) || 0;

//             return {
//                 ...cuenta,
//                 cliente_nombre: (cuenta.cliente as unknown as { empresa: string })?.empresa || '',
//                 saldo: totalHorasViaje,
//                 adeudo: totalHorasViaje - totalAbonado, // Actualizado
//                 monto: totalAbonado, // ¡Ahora es la suma de pagos!
//                 pagos: cuenta.pagos || [] // Conserva los pagos por si los necesitas
//             };
//         });

//     } catch (error) {
//         console.error('Error en fetchCuentasPorCliente:', error);
//         throw error;
//     }
// };

export const fetchCuentasPorCliente = async (id_cliente: number): Promise<CuentaPorCobrar[]> => {
    try {
        // 1. Obtener viajes del cliente
        const { data: viajes, error: errorViajes } = await supabase
            .from('viajes')
            .select('id, caphrsviajes')
            .eq('id_cliente', id_cliente);

        if (errorViajes) throw errorViajes;       
         // 2. Obtener información del cliente (incluyendo porcentaje administrativo)
        const { data: cliente, error: errorCliente } = await supabase
            .from('clientes')
            .select('porcentaje_administrativo')
            .eq('id', id_cliente)
            .single();

        if (errorCliente) throw errorCliente;
        
        // 3. Calcular total de horas de viaje
        let totalHorasViaje = viajes?.reduce((sum, viaje) => sum + (viaje.caphrsviajes || 0), 0) || 0;
        
        // 4. Aplicar porcentaje administrativo si existe
        if (cliente && cliente.porcentaje_administrativo && cliente.porcentaje_administrativo > 0) {
            const porcentajeAdmin = cliente.porcentaje_administrativo / 100;
            totalHorasViaje = totalHorasViaje * (1 - porcentajeAdmin);
        }

        // 2. Obtenemos cuentas existentes
        const { data: cuentas, error: errorCuentas } = await supabase
            .from('cuentas_por_cobrar')
            .select(`
                id,
                id_cliente,
                id_viaje,
                fecha,
                monto,
                saldo,
                estatus,
                metodo_pago,
                referencia,
                fecha_pago,
                fecha_pago_esperado,
                notas,
                cliente:clientes ( empresa ),
                pagos ( monto )
            `)
            .eq('id_cliente', id_cliente)
            .order('fecha_pago_esperado', { ascending: true });

        if (errorCuentas) throw errorCuentas;

        // 3. Si no hay cuentas, retornar array vacío (NO CREAR AUTOMÁTICAMENTE)
        if (!cuentas || cuentas.length === 0) {
            return [];
        }

        // 4. Mapeamos las cuentas existentes
        const cuentasActualizadas: CuentaPorCobrar[] = [];
        
        for (const cuenta of cuentas) {
            const totalAbonado = cuenta.pagos?.reduce(
                (sum: number, pago: any) => sum + (pago.monto || 0), 
                0
            ) || 0;

            // 5. ACTUALIZAR EL SALDO EN LA BASE DE DATOS si es diferente
            if (cuenta.saldo !== totalHorasViaje) {
                await supabase
                    .from('cuentas_por_cobrar')
                    .update({ saldo: totalHorasViaje })
                    .eq('id', cuenta.id);
            }

            // CORRECCIÓN: Evitar cero negativo y problemas de precisión
            const adeudoActual = Math.max(0, Number((totalHorasViaje - totalAbonado).toFixed(2)));

            // 6. Determinar el nuevo estatus
            const estatusActualizado: 'Pagado' | 'Pendiente' | 'Cancelado' = 
                adeudoActual <= 0 ? 'Pagado' : 'Pendiente';

            // 7. Actualizar estatus si ha cambiado
            if (cuenta.estatus !== estatusActualizado) {
                await supabase
                    .from('cuentas_por_cobrar')
                    .update({ estatus: estatusActualizado })
                    .eq('id', cuenta.id);
            }

            // 8. Crear objeto de cuenta actualizada
            const cuentaActualizada: CuentaPorCobrar = {
                id: cuenta.id,
                id_cliente: cuenta.id_cliente,
                id_viaje: cuenta.id_viaje,
                fecha: cuenta.fecha,
                monto: totalAbonado,
                saldo: totalHorasViaje,
                adeudo: adeudoActual,
                estatus: estatusActualizado,
                metodo_pago: cuenta.metodo_pago,
                referencia: cuenta.referencia,
                fecha_pago: cuenta.fecha_pago,
                fecha_pago_esperado: cuenta.fecha_pago_esperado,
                notas: cuenta.notas,
                cliente_nombre: (cuenta.cliente as unknown as { empresa: string })?.empresa || ''
            };

            cuentasActualizadas.push(cuentaActualizada);
        }

        return cuentasActualizadas;

    } catch (error) {
        console.error('Error en fetchCuentasPorCliente:', error);
        throw error;
    }
};


export const registrarPago = async (id_cuenta: number, monto: number): Promise<void> => {
    // 1. Obtener la cuenta actual
    const { data: cuenta, error: errorCuenta } = await supabase
        .from('cuentas_por_cobrar')
        .select('saldo, monto')
        .eq('id', id_cuenta)
        .single();

    if (errorCuenta) throw errorCuenta;

    // 2. Calcular nuevo total abonado (sumar en lugar de restar)
    const nuevoTotalAbonado = (cuenta.monto || 0) + monto;
    
    // 3. Determinar estatus (comparando abonado vs deuda total)
    const nuevoEstatus = nuevoTotalAbonado >= cuenta.saldo ? 'Pagado' : 'Pendiente';

    // 4. Actualizar la cuenta
    const { error } = await supabase
        .from('cuentas_por_cobrar')
        .update({
            monto: nuevoTotalAbonado, // Actualizamos el total abonado
            estatus: nuevoEstatus,
            fecha_pago: nuevoEstatus === 'Pagado' ? new Date().toISOString() : null,
            metodo_pago: nuevoEstatus === 'Pagado' ? 'Efectivo' : undefined
            // NOTA: No modificamos el saldo (deuda total) aquí
        })
        .eq('id', id_cuenta);

    if (error) throw error;
};

export const actualizarFechaPagoEsperado = async (id_cuenta: number, fecha: string | null): Promise<void> => {
    const { error } = await supabase
        .from('cuentas_por_cobrar')
        .update({ fecha_pago_esperado: fecha })
        .eq('id', id_cuenta);

    if (error) throw error;
};

// Crear cuenta por cobrar automáticamente al crear cliente
export const crearCuentaInicialParaCliente = async (id_cliente: number, empresa: string): Promise<void> => {
    const cuentaInicial: Omit<CuentaPorCobrar, 'id'> = {
        id_cliente,
        id_viaje: null,
        fecha: new Date().toISOString().split('T')[0],
        monto: 0,
        saldo: 0,
        estatus: 'Pendiente',
        notas: `Cuenta inicial creada automáticamente para ${empresa}`
    };

    const { error } = await supabase
        .from('cuentas_por_cobrar')
        .insert([cuentaInicial]);

    if (error) {
        console.error('Error al crear cuenta inicial para cliente:', error);
        throw error;
    }
};

// export const registrarPagoConHistorial = async (
//     id_cuenta: number,
//     monto: number,
//     metodo_pago: string = 'Efectivo',
//     referencia?: string
// ) => {
//     // 1. Registrar el pago en la tabla 'pagos'
//     const { error: errorPago } = await supabase
//         .from('pagos')
//         .insert({
//             id_cuenta,
//             monto,
//             metodo_pago,
//             referencia
//         });

//     if (errorPago) throw errorPago;

//     // 2. Obtener la cuenta COMPLETA
//     const { data: cuenta, error: errorCuenta } = await supabase
//         .from('cuentas_por_cobrar')
//         .select('*')
//         .eq('id', id_cuenta)
//         .single();

//     if (errorCuenta) throw errorCuenta;

//     // 3. Sumar TODOS los pagos hechos a esta cuenta
//     const { data: pagos, error: errorPagos } = await supabase
//         .from('pagos')
//         .select('monto')
//         .eq('id_cuenta', id_cuenta);

//     if (errorPagos) throw errorPagos;

//     // Sumar los montos
//     const totalPagado = pagos?.reduce((total, p) => total + p.monto, 0) || 0;
    
//     // 4. Calcular el adeudo REAL (evitando cero negativo)
//     const deudaTotal = cuenta.saldo > 0 ? cuenta.saldo : cuenta.adeudo + totalPagado;
//     const adeudoActual = Math.max(0, Number((deudaTotal - totalPagado).toFixed(2)));
//     const nuevoEstatus = adeudoActual <= 0 ? 'Pagado' : 'Pendiente';

//     // 5. Actualizar la cuenta
//     const { error } = await supabase
//         .from('cuentas_por_cobrar')
//         .update({
//             monto: totalPagado,
//             saldo: deudaTotal,
//             estatus: nuevoEstatus,
//             metodo_pago: metodo_pago,
//             fecha_pago: nuevoEstatus === 'Pagado' ? new Date().toISOString() : null
//         })
//         .eq('id', id_cuenta);

//     if (error) throw error;
// };

export const registrarPagoConHistorial = async (
    id_cuenta: number,
    monto: number,
    metodo_pago: string = 'Efectivo',
    referencia?: string
) => {
    // 1. Obtener información del cliente/empresa para la descripción
    const { data: cuentaInfo, error: errorInfo } = await supabase
        .from('cuentas_por_cobrar')
        .select(`
            *,
            clientes (
                empresa
            )
        `)
        .eq('id', id_cuenta)
        .single();

    if (errorInfo) throw errorInfo;

    // 2. Registrar el pago en la tabla 'pagos'
    const { error: errorPago } = await supabase
        .from('pagos')
        .insert({
            id_cuenta,
            monto,
            metodo_pago,
            referencia
        });

    if (errorPago) throw errorPago;

    // 3. Obtener la cuenta COMPLETA
    const { data: cuenta, error: errorCuenta } = await supabase
        .from('cuentas_por_cobrar')
        .select('*')
        .eq('id', id_cuenta)
        .single();

    if (errorCuenta) throw errorCuenta;

    // 4. Sumar TODOS los pagos hechos a esta cuenta
    const { data: pagos, error: errorPagos } = await supabase
        .from('pagos')
        .select('monto')
        .eq('id_cuenta', id_cuenta);

    if (errorPagos) throw errorPagos;

    // Sumar los montos
    const totalPagado = pagos?.reduce((total, p) => total + p.monto, 0) || 0;
    
    // 5. Calcular el adeudo REAL (evitando cero negativo)
    const deudaTotal = cuenta.saldo > 0 ? cuenta.saldo : cuenta.adeudo + totalPagado;
    const adeudoActual = Math.max(0, Number((deudaTotal - totalPagado).toFixed(2)));
    const nuevoEstatus = adeudoActual <= 0 ? 'Pagado' : 'Pendiente';

    // 6. Actualizar la cuenta
    const { error } = await supabase
        .from('cuentas_por_cobrar')
        .update({
            monto: totalPagado,
            saldo: deudaTotal,
            estatus: nuevoEstatus,
            metodo_pago: metodo_pago,
            fecha_pago: nuevoEstatus === 'Pagado' ? new Date().toISOString() : null
        })
        .eq('id', id_cuenta);

    if (error) throw error;

    // 7. CREAR REGISTRO EN CAJA CHICA COMO ABONO
    try {
        const nombreCliente = cuentaInfo.clientes?.empresa || 'Cliente';
        
        const registroCajaChica: Omit<CajaChica, 'id'> = {
            fecha: new Date().toISOString().split('T')[0], // Fecha actual
            descripcion: `ABONO - ${nombreCliente}`,
            ingreso: monto,
            egreso: null
        };

        await createCajaChica(registroCajaChica);
        console.log('Registro de ingreso creado en caja chica automáticamente');
    } catch (error) {
        console.error('Error creando registro en caja chica para pago:', error);
        // No lanzamos el error para no afectar el registro del pago
    }
};

export const fetchHistorialPagos = async (id_cuenta: number) => {
    const { data, error } = await supabase
        .from('pagos')
        .select('*')
        .eq('id_cuenta', id_cuenta)
        .order('fecha', { ascending: false });
    
    if (error) throw error;
        return data || [];
};


// ACTUALIZAR ABONO DEL HISTORIAL DE ABONOS
// export const actualizarPago = async (
//     idPago: number,
//     nuevoMonto: number,
//     nuevoEstatus: string,
//     metodo_pago: string,
//     nuevaReferencia: string
// ): Promise<void> => {
//     // 1. Actualizar el pago individual
//     const { error: errorActualizacion } = await supabase
//         .from('pagos')
//         .update({ 
//             monto: nuevoMonto,
//             referencia: nuevaReferencia,
//             fecha: new Date().toISOString().split('T')[0],
//         })
//         .eq('id', idPago);

//     if (errorActualizacion) throw errorActualizacion;

//     // 2. Obtener la cuenta asociada
//     const { data: pagoActualizado, error: errorPago } = await supabase
//         .from('pagos')
//         .select('id_cuenta')
//         .eq('id', idPago)
//         .single();

//     if (errorPago) throw errorPago;

//     const idCuenta = pagoActualizado?.id_cuenta;
//     if (!idCuenta) throw new Error('El pago no tiene una cuenta asociada');

//     // 3. Obtener la cuenta COMPLETA
//     const { data: cuenta, error: errorCuentaData } = await supabase
//         .from('cuentas_por_cobrar')
//         .select('*')
//         .eq('id', idCuenta)
//         .single();

//     if (errorCuentaData) throw errorCuentaData;

//     // 4. Recalcular TODOS los pagos
//     const { data: pagos, error: errorPagosCuenta } = await supabase
//         .from('pagos')
//         .select('monto')
//         .eq('id_cuenta', idCuenta);

//     if (errorPagosCuenta) throw errorPagosCuenta;

//     const totalPagado = pagos?.reduce((total, p) => total + p.monto, 0) || 0;
    
//     // 5. Calcular el adeudo REAL
//     const deudaTotal = cuenta.saldo > 0 ? cuenta.saldo : cuenta.adeudo + totalPagado;
//     const adeudoActual = deudaTotal - totalPagado;
//     const estatusActualizado = adeudoActual <= 0 ? 'Pagado' : 'Pendiente';

//     // 6. Actualizar la cuenta
//     const { error: errorCuenta } = await supabase
//         .from('cuentas_por_cobrar')
//         .update({
//             monto: totalPagado,
//             saldo: deudaTotal, // ← Corregir el saldo
//             estatus: estatusActualizado,
//             metodo_pago,
//             fecha_pago: estatusActualizado === 'Pagado' ? new Date().toISOString() : null
//         })
//         .eq('id', idCuenta);

//     if (errorCuenta) throw errorCuenta;
// };


export const actualizarPago = async (
    idPago: number,
    nuevoMonto: number,
    nuevoEstatus: string,
    metodo_pago: string,
    nuevaReferencia: string
): Promise<void> => {
    // 1. Obtener el pago actual para comparar montos
    const { data: pagoActual, error: errorPagoActual } = await supabase
        .from('pagos')
        .select('*')
        .eq('id', idPago)
        .single();

    if (errorPagoActual) throw errorPagoActual;

    const montoAnterior = pagoActual.monto;
    const idCuenta = pagoActual.id_cuenta;

    if (!idCuenta) throw new Error('El pago no tiene una cuenta asociada');

    // 2. Obtener información del cliente ANTES de actualizar
    const { data: cuentaInfo, error: errorCuentaInfo } = await supabase
        .from('cuentas_por_cobrar')
        .select(`
            *,
            clientes (
                empresa
            )
        `)
        .eq('id', idCuenta)
        .single();

    if (errorCuentaInfo) throw errorCuentaInfo;

    const nombreCliente = cuentaInfo.clientes?.empresa || 'Cliente';

    // 3. Actualizar el pago individual
    const { error: errorActualizacion } = await supabase
        .from('pagos')
        .update({ 
            monto: nuevoMonto,
            referencia: nuevaReferencia,
            fecha: new Date().toISOString().split('T')[0],
        })
        .eq('id', idPago);

    if (errorActualizacion) throw errorActualizacion;

    // 4. Obtener la cuenta COMPLETA
    const { data: cuenta, error: errorCuentaData } = await supabase
        .from('cuentas_por_cobrar')
        .select('*')
        .eq('id', idCuenta)
        .single();

    if (errorCuentaData) throw errorCuentaData;

    // 5. Recalcular TODOS los pagos
    const { data: pagos, error: errorPagosCuenta } = await supabase
        .from('pagos')
        .select('monto')
        .eq('id_cuenta', idCuenta);

    if (errorPagosCuenta) throw errorPagosCuenta;

    const totalPagado = pagos?.reduce((total, p) => total + p.monto, 0) || 0;
    
    // 6. Calcular el adeudo REAL
    const deudaTotal = cuenta.saldo > 0 ? cuenta.saldo : cuenta.adeudo + totalPagado;
    const adeudoActual = deudaTotal - totalPagado;
    const estatusActualizado = adeudoActual <= 0 ? 'Pagado' : 'Pendiente';

    // 7. Actualizar la cuenta
    const { error: errorCuenta } = await supabase
        .from('cuentas_por_cobrar')
        .update({
            monto: totalPagado,
            saldo: deudaTotal,
            estatus: estatusActualizado,
            metodo_pago,
            fecha_pago: estatusActualizado === 'Pagado' ? new Date().toISOString() : null
        })
        .eq('id', idCuenta);

    if (errorCuenta) throw errorCuenta;

    // 8. ACTUALIZAR REGISTRO EN CAJA CHICA SI EL MONTO CAMBIÓ
    if (montoAnterior !== nuevoMonto) {
        try {
            const descripcionBuscada = `INGRESO - ${nombreCliente}`;
            
            console.log(`Buscando registro en caja chica: ${descripcionBuscada}, monto anterior: ${montoAnterior}`);
            
            // Buscar el registro en caja chica
            const { data: registrosCajaChica, error: errorBusqueda } = await supabase
                .from('cajachica')
                .select('*')
                .eq('descripcion', descripcionBuscada)
                .eq('ingreso', montoAnterior)
                .limit(1);

            if (errorBusqueda) {
                console.error('Error buscando registro en caja chica:', errorBusqueda);
            } else if (registrosCajaChica && registrosCajaChica.length > 0) {
                console.log('Registro encontrado en caja chica, actualizando...');
                
                // Actualizar el registro existente
                const { error: errorUpdateCaja } = await supabase
                    .from('cajachica')
                    .update({
                        ingreso: nuevoMonto,
                        fecha: new Date().toISOString().split('T')[0]
                    })
                    .eq('id', registrosCajaChica[0].id);

                if (errorUpdateCaja) {
                    console.error('Error actualizando registro en caja chica:', errorUpdateCaja);
                } else {
                    console.log('Registro de caja chica actualizado automáticamente');
                }
            } else {
                // console.log('No se encontró registro en caja chica, creando nuevo...');
                
                // // Crear nuevo registro si no se encuentra
                // const nuevoRegistroCajaChica: Omit<CajaChica, 'id'> = {
                //     fecha: new Date().toISOString().split('T')[0],
                //     descripcion: `INGRESO - ${nombreCliente}`,
                //     ingreso: nuevoMonto,
                //     egreso: null
                // };

                // await createCajaChica(nuevoRegistroCajaChica);
                // console.log('Nuevo registro de caja chica creado');
            }
        } catch (error) {
            console.error('Error actualizando registro en caja chica para pago:', error);
        }
    } else {
        console.log('El monto no cambió, no se actualiza caja chica');
    }
};
