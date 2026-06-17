import { supabase } from '../../superbase.service';

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
// FACTURAS CRUD
// ============================================

export const crearFactura = async (factura: Factura): Promise<Factura> => {
    // 1. Calcular totales
    let subtotal = 0;
    let iva = 0;
    const totalDescuento = factura.descuento || 0;

    // Calcular por cada producto
    factura.productos.forEach(producto => {
        const importe = producto.cantidad * producto.precio_unitario;
        const descuentoProducto = producto.descuento || 0;
        const importeConDescuento = importe - descuentoProducto;
        subtotal += importeConDescuento;
        
        // Calcular IVA (16% por defecto)
        const tasa = producto.tasa_impuesto || 16;
        iva += (importeConDescuento * tasa) / 100;
    });

    const total = subtotal + iva - totalDescuento;

    // 2. Obtener configuración fiscal para el folio
    const config = await getConfiguracionFiscal();
    const folio = config.folio_actual;
    const serie = config.serie;

    // 3. Insertar factura
    const { data: facturaData, error: facturaError } = await supabase
        .from('facturas')
        .insert([{
            cliente_id: factura.cliente_id,
            tipo_comprobante: factura.tipo_comprobante,
            metodo_pago: factura.metodo_pago,
            forma_pago: factura.forma_pago,
            uso_cfdi: factura.uso_cfdi,
            subtotal: subtotal,
            descuento: totalDescuento,
            iva: iva,
            total: total,
            moneda: factura.moneda || 'MXN',
            tipo_cambio: factura.tipo_cambio || 1,
            fecha_pago: factura.fecha_pago || null,
            serie: serie,
            folio: folio.toString(),
            status: 'PENDIENTE'
        }])
        .select()
        .single();

    if (facturaError) {
        console.error('Error al crear factura:', facturaError);
        throw new Error(facturaError.message);
    }

    // 4. Insertar detalles
    const detalles = factura.productos.map(producto => ({
        factura_id: facturaData.id,
        producto_id: producto.id || null,
        codigo: producto.codigo || null,
        descripcion: producto.descripcion,
        cantidad: producto.cantidad,
        unidad: producto.unidad,
        precio_unitario: producto.precio_unitario,
        importe: producto.cantidad * producto.precio_unitario,
        descuento: producto.descuento || 0,
        impuesto: producto.impuesto || 'IVA',
        tasa_impuesto: producto.tasa_impuesto || 16
    }));

    const { error: detallesError } = await supabase
        .from('facturas_detalles')
        .insert(detalles);

    if (detallesError) {
        console.error('Error al crear detalles de factura:', detallesError);
        throw new Error(detallesError.message);
    }

    // 5. Actualizar folio en configuración
    await supabase
        .from('configuracion_fiscal')
        .update({ folio_actual: folio + 1 })
        .eq('id', config.id);

    return { ...facturaData, productos: factura.productos };
};

// ============================================
// TIMBRADO CON FISCALAPI
// ============================================

export const timbrarFactura = async (facturaId: number): Promise<RespuestaTimbrado> => {
    try {
        // 1. Obtener factura con sus detalles
        const { data: factura, error: facturaError } = await supabase
            .from('facturas')
            .select(`
                *,
                facturas_detalles (*),
                clientes (id, empresa, rfc, regimen_fiscal, uso_cfdi, metodo_pago, direccion)
            `)
            .eq('id', facturaId)
            .single();

        if (facturaError || !factura) {
            throw new Error('Factura no encontrada');
        }

        // 2. Obtener configuración fiscal
        const config = await getConfiguracionFiscal();

        if (!config.api_key) {
            throw new Error('API Key de FiscalAPI no configurada');
        }

        // 3. Construir payload para FiscalAPI
        const payload = construirPayloadFactura(factura, config);

        // 4. Enviar a FiscalAPI
        const response = await fetch('https://sandbox.fiscalapi.com/v1/timbrado/cfdi', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.api_key}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            // Actualizar factura con error
            await supabase
                .from('facturas')
                .update({
                    status: 'ERROR',
                    error_mensaje: data.message || 'Error al timbrar'
                })
                .eq('id', facturaId);

            return {
                success: false,
                error: data.message || 'Error al timbrar'
            };
        }

        // 5. Actualizar factura con datos del timbrado
        const { error: updateError } = await supabase
            .from('facturas')
            .update({
                uuid: data.uuid,
                xml: data.xml,
                pdf: data.pdf,
                cadena_original: data.cadena_original,
                sello_sat: data.sello_sat,
                sello_cfd: data.sello_cfd,
                status: 'TIMBRADA',
                fecha_emision: data.fecha_timbrado || new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', facturaId);

        if (updateError) {
            console.error('Error al actualizar factura:', updateError);
        }

        return {
            success: true,
            uuid: data.uuid,
            xml: data.xml,
            pdf: data.pdf
        };

    } catch (error: any) {
        console.error('Error en timbrado:', error);
        return {
            success: false,
            error: error.message || 'Error desconocido al timbrar'
        };
    }
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