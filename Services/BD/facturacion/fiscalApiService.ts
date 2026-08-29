import { supabase } from '../../superbase.service';
import { fetchViajesConFiltrosOptimizado, ViajeEstimacion } from '../estimacionesService';
import { updateViajesEstatusBulk } from '../viajeService';

// ============================================
// INTERFACES
// ============================================

export interface ClienteFiscal {
    id: number;
    empresa: string;
    rfc: string;
    regimen_fiscal: string;
    uso_cfdi: string;
    metodo_pago: string;
    direccion: string;
    email?: string;
    telefono?: string;
}

export interface ProductoFactura {
    id?: number;
    codigo?: string;
    descripcion: string;
    cantidad: number;
    unidad: string;
    precio_unitario: number;
    descuento?: number;
    impuesto?: string;
    tasa_impuesto?: number;
}

export interface Factura {
    id?: number;
    cliente_id: number;
    tipo_comprobante: 'I' | 'E' | 'T';
    metodo_pago: 'PUE' | 'PPD';
    forma_pago: string;
    uso_cfdi: string;
    productos: ProductoFactura[];
    descuento?: number;
    moneda?: string;
    tipo_cambio?: number;
    fecha_pago?: string;
}

export interface ConfiguracionFiscal {
    id: number;
    empresa_nombre: string;
    rfc: string;
    regimen_fiscal: string;
    calle: string;
    no_exterior: string;
    no_interior?: string;
    colonia: string;
    localidad?: string;
    municipio: string;
    estado: string;
    pais: string;
    codigo_postal: string;
    serie: string;
    folio_actual: number;
    api_key: string;
    certificado_sat?: string;
    modo_simulacion: boolean;
}

export interface RespuestaTimbrado {
    success: boolean;
    uuid?: string;
    xml?: string;
    pdf?: string;
    error?: string;
}

// ============================================
// CONFIGURACIÓN FISCAL
// ============================================

export const getConfiguracionFiscal = async (): Promise<ConfiguracionFiscal> => {
    const { data, error } = await supabase
        .from('configuracion_fiscal')
        .select('*')
        .limit(1)
        .single();

    if (error) {
        console.error('Error al obtener configuración fiscal:', error);
        throw new Error('No se encontró configuración fiscal. Por favor configura tu empresa.');
    }
    return data;
};

export const actualizarConfiguracionFiscal = async (
    config: Partial<ConfiguracionFiscal>
): Promise<ConfiguracionFiscal> => {
    const { data, error } = await supabase
        .from('configuracion_fiscal')
        .update({ ...config, updated_at: new Date().toISOString() })
        .eq('id', 1)
        .select()
        .single();

    if (error) {
        console.error('Error al actualizar configuración fiscal:', error);
        throw new Error(error.message);
    }
    return data;
};

// ============================================
// CLIENTES (extensión de datos fiscales)
// ============================================

export const getClientesFiscales = async (): Promise<ClienteFiscal[]> => {
    const { data, error } = await supabase
        .from('clientes')
        .select('id, empresa, rfc, regimen_fiscal, uso_cfdi, metodo_pago, direccion')
        .order('empresa', { ascending: true });

    if (error) {
        console.error('Error al obtener clientes fiscales:', error);
        throw new Error(error.message);
    }
    return data || [];
};

export const getClienteFiscalById = async (id: number): Promise<ClienteFiscal> => {
    const { data, error } = await supabase
        .from('clientes')
        .select('id, empresa, rfc, regimen_fiscal, uso_cfdi, metodo_pago, direccion')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error al obtener cliente fiscal:', error);
        throw new Error(error.message);
    }
    return data;
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

const construirPayloadFactura = (factura: any, config: ConfiguracionFiscal) => {
    // Esta es la estructura que espera FiscalAPI
    // Consulta la documentación oficial para más detalles
    return {
        version: "4.0",
        emisor: {
            nombre: config.empresa_nombre,
            rfc: config.rfc,
            regimen_fiscal: config.regimen_fiscal,
            domicilio_fiscal: {
                calle: config.calle,
                no_exterior: config.no_exterior,
                no_interior: config.no_interior || "",
                colonia: config.colonia,
                localidad: config.localidad || "",
                municipio: config.municipio,
                estado: config.estado,
                pais: config.pais,
                codigo_postal: config.codigo_postal
            }
        },
        receptor: {
            nombre: factura.clientes.empresa,
            rfc: factura.clientes.rfc,
            regimen_fiscal: factura.clientes.regimen_fiscal,
            uso_cfdi: factura.clientes.uso_cfdi,
            domicilio: factura.clientes.direccion || ""
        },
        comprobante: {
            tipo_comprobante: factura.tipo_comprobante,
            metodo_pago: factura.metodo_pago,
            forma_pago: factura.forma_pago,
            moneda: factura.moneda,
            tipo_cambio: factura.tipo_cambio,
            fecha: factura.fecha_emision || new Date().toISOString(),
            fecha_pago: factura.fecha_pago || undefined,
            serie: factura.serie,
            folio: factura.folio,
            subtotal: factura.subtotal,
            descuento: factura.descuento,
            total: factura.total
        },
        conceptos: factura.facturas_detalles.map((detalle: any) => ({
            clave_unidad: detalle.unidad_cfdi || "H87", // Código SAT
            codigo_producto_sat: detalle.codigo_sat || "01010101",
            descripcion: detalle.descripcion,
            cantidad: detalle.cantidad,
            unidad: detalle.unidad,
            precio_unitario: detalle.precio_unitario,
            importe: detalle.importe,
            descuento: detalle.descuento || 0,
            impuestos: {
                traslados: [
                    {
                        base: detalle.importe - (detalle.descuento || 0),
                        impuesto: detalle.impuesto || "002",
                        tipo_factor: "Tasa",
                        tasa_o_cuota: detalle.tasa_impuesto / 100,
                        importe: ((detalle.importe - (detalle.descuento || 0)) * detalle.tasa_impuesto) / 100
                    }
                ]
            }
        })),
        impuestos: {
            traslados: [
                {
                    impuesto: "002",
                    tipo_factor: "Tasa",
                    tasa_o_cuota: 0.16,
                    importe: factura.iva
                }
            ]
        }
    };
};

// ============================================
// OBTENER FACTURAS
// ============================================

export const getFacturas = async (): Promise<any[]> => {
    const { data, error } = await supabase
        .from('facturas')
        .select(`
            *,
            clientes (id, empresa, rfc),
            facturas_detalles (*)
        `)
        .order('id', { ascending: false });

    if (error) {
        console.error('Error al obtener facturas:', error);
        throw new Error(error.message);
    }
    return data || [];
};

export const getFacturaById = async (id: number): Promise<any> => {
    const { data, error } = await supabase
        .from('facturas')
        .select(`
            *,
            clientes (id, empresa, rfc, regimen_fiscal, uso_cfdi, metodo_pago, direccion),
            facturas_detalles (*)
        `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error al obtener factura:', error);
        throw new Error(error.message);
    }
    return data;
};

export const cancelarFactura = async (uuid: string): Promise<RespuestaTimbrado> => {
    try {
        const config = await getConfiguracionFiscal();

        if (!config.api_key) {
            throw new Error('API Key de FiscalAPI no configurada');
        }

        const response = await fetch(`https://api.fiscalapi.com/v1/timbrado/cancelar/${uuid}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.api_key}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.message || 'Error al cancelar'
            };
        }

        // Actualizar estado en base de datos
        await supabase
            .from('facturas')
            .update({
                status: 'CANCELADA',
                fecha_cancelacion: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('uuid', uuid);

        return {
            success: true,
            uuid: uuid
        };

    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'Error al cancelar'
        };
    }
};

// ============================================
// DESCARGAR FACTURA
// ============================================

export const descargarFactura = async (id: number, tipo: 'xml' | 'pdf') => {
    const factura = await getFacturaById(id);
    
    if (!factura) {
        throw new Error('Factura no encontrada');
    }

    if (tipo === 'xml' && factura.xml) {
        // Descargar XML
        const blob = new Blob([factura.xml], { type: 'application/xml' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `factura_${factura.uuid}.xml`;
        a.click();
        window.URL.revokeObjectURL(url);
    } else if (tipo === 'pdf' && factura.pdf) {
        // Descargar PDF
        const link = document.createElement('a');
        link.href = factura.pdf;
        link.download = `factura_${factura.uuid}.pdf`;
        link.click();
    } else {
        throw new Error(`No se encontró el archivo ${tipo} para esta factura`);
    }
};

// ============================================
// FACTURACIÓN DE VIAJES (Aprobado -> Factura -> Facturado)
// ============================================
// A diferencia de "Nueva Factura" (que factura productos de inventario),
// este flujo factura directamente los viajes de un cliente que ya están en
// estatus "aprobado". Crear la factura NO cambia el estatus del viaje; el
// estatus solo pasa a "facturado" cuando la factura queda aprobada/timbrada
// (ver aprobarFacturaDeViajes), sea de verdad (facturadorelectronico.com) o
// simulado (mientras no tengas el acceso a esa API).

// Viajes que ya están ligados a una factura no cancelada no se vuelven a
// ofrecer, para no facturar el mismo viaje dos veces mientras su factura
// sigue pendiente de aprobación.
const fetchIdsViajesYaFacturados = async (): Promise<Set<number>> => {
    const { data, error } = await supabase
        .from('facturas_detalles')
        .select('id_viaje, facturas!inner(status)')
        .not('id_viaje', 'is', null)
        .neq('facturas.status', 'CANCELADA');

    if (error) {
        console.error('Error al revisar viajes ya facturados:', error);
        throw new Error(error.message);
    }

    return new Set((data || []).map((d: any) => d.id_viaje).filter((id: any): id is number => id != null));
};

// Viajes en estatus "aprobado" de un cliente, listos para facturar (excluye
// los que ya quedaron ligados a otra factura pendiente/timbrada).
export const fetchViajesFacturablesPorCliente = async (clienteId: number): Promise<ViajeEstimacion[]> => {
    const [viajesAprobados, idsYaFacturados] = await Promise.all([
        fetchViajesConFiltrosOptimizado({
            clienteId,
            estatus: 'aprobado',
            fechaInicio: null,
            fechaFin: null,
            operador: null,
            material: null,
            origen: null,
            destino: null
        }),
        fetchIdsViajesYaFacturados()
    ]);

    return viajesAprobados.filter(v => !idsYaFacturados.has(v.id));
};

// Crea la factura (encabezado + detalle, un renglón por viaje) en estatus
// PENDIENTE. Todavía no toca el estatus de los viajes: eso pasa al aprobar.
export const crearFacturaDeViajes = async (cliente: ClienteFiscal, viajes: ViajeEstimacion[]): Promise<Factura & { id: number; folio: string; serie: string }> => {
    if (viajes.length === 0) throw new Error('Selecciona al menos un viaje para facturar');

    const subtotal = viajes.reduce((sum, v) => sum + v.total_viaje, 0);
    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    const config = await getConfiguracionFiscal();

    const { data: facturaData, error: facturaError } = await supabase
        .from('facturas')
        .insert([{
            cliente_id: cliente.id,
            tipo_comprobante: 'I',
            // ojo: cliente.metodo_pago es texto libre del catálogo de clientes (ej. "Transferencia"),
            // no el código CFDI (PUE/PPD) que espera esta columna, así que aquí siempre va el código.
            metodo_pago: 'PUE',
            forma_pago: '03',
            uso_cfdi: cliente.uso_cfdi || 'G03',
            regimen_fiscal_cliente: cliente.regimen_fiscal,
            subtotal,
            descuento: 0,
            iva,
            total,
            moneda: 'MXN',
            tipo_cambio: 1,
            serie: config.serie,
            folio: config.folio_actual.toString(),
            status: 'PENDIENTE'
        }])
        .select()
        .single();

    if (facturaError) {
        console.error('Error al crear factura de viajes:', facturaError);
        throw new Error(facturaError.message);
    }

    const detalles = viajes.map(v => ({
        factura_id: facturaData.id,
        id_viaje: v.id,
        descripcion: `Viaje ${v.folio || v.numero_viaje || v.id} - ${v.material || 'Material'} de ${v.origen || ''} a ${v.destino || ''}`,
        cantidad: v.m3,
        unidad: 'M3',
        precio_unitario: v.precio,
        importe: v.total_viaje,
        descuento: 0,
        impuesto: 'IVA',
        tasa_impuesto: 16
    }));

    const { error: detallesError } = await supabase.from('facturas_detalles').insert(detalles);
    if (detallesError) {
        console.error('Error al crear detalles de la factura de viajes:', detallesError);
        throw new Error(detallesError.message);
    }

    await supabase.from('configuracion_fiscal').update({ folio_actual: config.folio_actual + 1 }).eq('id', config.id);

    return { ...facturaData, productos: [] };
};

// Aprueba/timbra la factura: si modo_simulacion está activo (o no hay
// api_key configurado), genera un timbrado simulado sin llamar a ninguna
// API externa. Si está desactivado, llama a facturadorelectronico.com con
// el api_key configurado.
//
// TODO cuando tengas acceso real a facturadorelectronico.com: ajustar la URL
// del endpoint y el payload de `construirPayloadFacturadorElectronico` según
// su documentación oficial (la estructura de abajo es un placeholder).
export const aprobarFacturaDeViajes = async (facturaId: number): Promise<RespuestaTimbrado> => {
    try {
        const { data: factura, error: facturaError } = await supabase
            .from('facturas')
            .select(`*, facturas_detalles (*), clientes (id, empresa, rfc, regimen_fiscal, uso_cfdi, metodo_pago, direccion)`)
            .eq('id', facturaId)
            .single();

        if (facturaError || !factura) throw new Error('Factura no encontrada');

        const config = await getConfiguracionFiscal();
        const idsViajes: number[] = (factura.facturas_detalles || [])
            .map((d: any) => d.id_viaje)
            .filter((id: any): id is number => id != null);

        let resultado: RespuestaTimbrado;

        if (config.modo_simulacion || !config.api_key) {
            resultado = await simularTimbradoFactura(factura);
        } else {
            resultado = await timbrarConFacturadorElectronico(factura, config);
        }

        if (!resultado.success) {
            await supabase.from('facturas').update({ status: 'ERROR', error_mensaje: resultado.error }).eq('id', facturaId);
            return resultado;
        }

        await supabase
            .from('facturas')
            .update({
                uuid: resultado.uuid,
                xml: resultado.xml,
                pdf: resultado.pdf,
                status: 'TIMBRADA',
                fecha_emision: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', facturaId);

        if (idsViajes.length > 0) {
            await updateViajesEstatusBulk(idsViajes, 'facturado');
        }

        return resultado;
    } catch (error: any) {
        console.error('Error al aprobar la factura de viajes:', error);
        return { success: false, error: error.message || 'Error desconocido al aprobar la factura' };
    }
};

// Simulación local: no llama a ningún servicio externo, solo genera un UUID
// falso para poder probar todo el flujo (crear factura -> aprobar -> viajes
// pasan a "facturado") sin tener aún el acceso a la API real.
const simularTimbradoFactura = async (factura: any): Promise<RespuestaTimbrado> => {
    await new Promise(resolve => setTimeout(resolve, 600)); // simula latencia de red
    const uuidSimulado = `SIMULADO-${factura.id}-${Date.now()}`;
    return {
        success: true,
        uuid: uuidSimulado,
        xml: undefined,
        pdf: undefined
    };
};

// Llamada real a facturadorelectronico.com. Placeholder: falta ajustar la URL
// del endpoint y el payload exacto según su documentación cuando tengas el
// acceso, pero el resto del flujo (guardar en BD, mover viajes a
// "facturado") ya está listo para funcionar tal cual.
const timbrarConFacturadorElectronico = async (factura: any, config: ConfiguracionFiscal): Promise<RespuestaTimbrado> => {
    try {
        const payload = construirPayloadFactura(factura, config);

        const response = await fetch('https://www.facturadorelectronico.com/api/v1/cfdi/timbrar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.api_key}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.message || 'Error al timbrar con facturadorelectronico.com' };
        }

        return { success: true, uuid: data.uuid, xml: data.xml, pdf: data.pdf };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error al conectar con facturadorelectronico.com' };
    }
};