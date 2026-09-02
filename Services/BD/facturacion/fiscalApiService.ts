import md5 from 'blueimp-md5';
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
    // Código postal REAL del receptor: el SAT lo exige en cada CFDI 4.0
    // (domicilioFiscalReceptor) y debe coincidir con el registrado ante el
    // SAT para ese RFC, no con el del emisor. Opcional aquí porque es un
    // campo nuevo; mientras no se capture, se usa el CP del emisor como
    // respaldo (ver construirPayloadFacturador), lo cual puede generar
    // rechazo del SAT en producción si no coincide con el real del cliente.
    codigo_postal?: string;
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
    // Credenciales de Facturador.com (apidocs.facturador.com). El password
    // nunca se guarda en texto plano: se hashea a MD5 en el navegador antes
    // de guardarlo, que es el formato que pide su endpoint de autenticación.
    facturador_rfc?: string;
    facturador_password_md5?: string;
    facturador_client_id?: string;
    facturador_client_secret?: string;
    facturador_emisor_id?: number | null;
    facturador_ambiente?: 'pruebas' | 'produccion';
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
        .select('id, empresa, rfc, regimen_fiscal, uso_cfdi, metodo_pago, direccion, codigo_postal')
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
        .select('id, empresa, rfc, regimen_fiscal, uso_cfdi, metodo_pago, direccion, codigo_postal')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error al obtener cliente fiscal:', error);
        throw new Error(error.message);
    }
    return data;
};

// ============================================
// FACTURADOR.COM (apidocs.facturador.com) — AUTENTICACIÓN Y AMBIENTES
// ============================================
// Facturador.com usa OAuth2 (grant_type=password) contra un servidor de auth
// separado del servidor de la API de negocio, y requiere el password en MD5
// (nunca en texto plano). El emisorId de la cuenta se resuelve una sola vez
// (vía /connect/userinfo) y se guarda en configuracion_fiscal para no pedirlo
// en cada llamada.

const AMBIENTES_FACTURADOR: Record<'pruebas' | 'produccion', { authBase: string; apiBase: string }> = {
    pruebas: {
        authBase: 'https://authcli.stagefacturador.com',
        apiBase: 'https://pruebas.stagefacturador.com'
    },
    // TODO: cuando se active el paquete de folios productivo, pedir a
    // Facturador.com (o al ejecutivo de ventas) las URLs productivas exactas
    // — su documentación las da en la sección "API Key producción", que no
    // quedó accesible al revisar la documentación pública.
    produccion: {
        authBase: '',
        apiBase: ''
    }
};

const getUrlsFacturador = (config: ConfiguracionFiscal) => {
    const ambiente = config.facturador_ambiente || 'pruebas';
    const urls = AMBIENTES_FACTURADOR[ambiente];
    if (!urls.authBase || !urls.apiBase) {
        throw new Error(`Faltan configurar las URLs del ambiente "${ambiente}" de Facturador.com`);
    }
    return urls;
};

// Hashea el password del lado del cliente: nunca se guarda ni se envía en
// texto plano, tal como requiere el endpoint de autenticación de
// Facturador.com (parámetro es_md5=true).
export const hashPasswordFacturador = (passwordPlano: string): string => md5(passwordPlano);

interface TokenFacturador {
    accessToken: string;
    expiraEn: number; // epoch ms
}

let tokenFacturadorCache: TokenFacturador | null = null;

const obtenerTokenFacturador = async (config: ConfiguracionFiscal): Promise<string> => {
    if (tokenFacturadorCache && tokenFacturadorCache.expiraEn > Date.now() + 5000) {
        return tokenFacturadorCache.accessToken;
    }

    if (!config.facturador_rfc || !config.facturador_password_md5 || !config.facturador_client_id || !config.facturador_client_secret) {
        throw new Error('Faltan credenciales de Facturador.com en Configuración Fiscal (RFC, contraseña, Client ID o Client Secret)');
    }

    const { authBase } = getUrlsFacturador(config);
    const body = new URLSearchParams({
        grant_type: 'password',
        scope: 'offline_access openid APINegocios',
        username: config.facturador_rfc,
        password: config.facturador_password_md5,
        client_id: config.facturador_client_id,
        client_secret: config.facturador_client_secret,
        es_md5: 'true'
    });

    const response = await fetch(`${authBase}/connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error_description || data.error || 'No se pudo autenticar con Facturador.com');
    }

    tokenFacturadorCache = {
        accessToken: data.access_token,
        expiraEn: Date.now() + (data.expires_in || 3600) * 1000
    };
    return tokenFacturadorCache.accessToken;
};

// Resuelve (y guarda en configuracion_fiscal) el emisorId de la cuenta, que
// se necesita en la URL de todos los demás endpoints de Facturador.com.
const obtenerEmisorIdFacturador = async (config: ConfiguracionFiscal, token: string): Promise<number> => {
    if (config.facturador_emisor_id) return config.facturador_emisor_id;

    const { authBase } = getUrlsFacturador(config);
    const response = await fetch(`${authBase}/connect/userinfo`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok || !data.emisorid) {
        throw new Error('No se pudo obtener el emisorId de la cuenta en Facturador.com');
    }

    await supabase.from('configuracion_fiscal').update({ facturador_emisor_id: data.emisorid }).eq('id', config.id);
    return data.emisorid;
};

// Prueba la conexión completa (token + emisorId) sin timbrar nada. La usa el
// botón "Probar conexión" en Configuración Fiscal.
export const probarConexionFacturador = async (): Promise<{ success: boolean; emisorId?: number; error?: string }> => {
    try {
        const config = await getConfiguracionFiscal();
        const token = await obtenerTokenFacturador(config);
        const emisorId = await obtenerEmisorIdFacturador(config, token);
        return { success: true, emisorId };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error al conectar con Facturador.com' };
    }
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

// Construye el JSON de comprobante tal como lo pide el endpoint "Emitir CFDI"
// de Facturador.com (ver /docs/emision/16ofm1v8ivslx-emitir-cfdi). El bloque
// de impuestos por concepto (impuestos.traslados) sigue la estructura
// estándar de CFDI 4.0; su ejemplo público solo muestra un concepto sin
// impuesto, así que conviene confirmarlo con el primer timbrado real y
// ajustar aquí si Facturador.com devuelve un error de validación distinto.
// Redondea a centavos igual que lo hará el validador del SAT. Es clave
// aplicar esto en CADA paso intermedio (no solo al final de una suma): si se
// suman números con más de 2 decimales (p.ej. precio × m³ sin redondear) y
// se redondea hasta el resultado final, ese resultado puede no coincidir con
// la suma de las piezas YA redondeadas que en realidad viajan en el JSON
// (Concepto.Importe, Traslado.Importe, SubTotal...), y el SAT rechaza el CFDI
// por un descuadre de un centavo.
const redondear = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const construirPayloadFacturador = (factura: any, config: ConfiguracionFiscal) => {
    // Acumula base/importe por tasa a partir de los conceptos, para construir
    // el nodo `impuestos` de nivel comprobante tal como lo pide la
    // documentación (/docs/emision/hks3zl8dha30b-atributos-cfdi-4-0): ese
    // nodo necesita un `totalImpuestosTrasladados` EXPLÍCITO además del
    // arreglo `traslados` — antes solo mandábamos el arreglo, por eso el SAT
    // lo veía en 0 y no cuadraba contra la suma real. Sus ejemplos también
    // usan números (0.16, 73.92), no texto con 6 decimales.
    const acumuladoPorTasa = new Map<string, { tasaOCuota: number; base: number; importe: number }>();

    const conceptos = factura.facturas_detalles.map((detalle: any) => {
        const importe = redondear(Number(detalle.importe));
        const descuento = redondear(Number(detalle.descuento || 0));
        const base = redondear(importe - descuento);
        const tieneImpuesto = !!detalle.tasa_impuesto;
        let impuestosConcepto: any;

        if (tieneImpuesto) {
            const tasaOCuota = Number(detalle.tasa_impuesto) / 100;
            const importeImpuesto = redondear((base * detalle.tasa_impuesto) / 100);

            impuestosConcepto = {
                traslados: [{ base, impuesto: '002', tipoFactor: 'Tasa', tasaOCuota, importe: importeImpuesto }]
            };

            const clave = tasaOCuota.toFixed(6);
            const acumulado = acumuladoPorTasa.get(clave) || { tasaOCuota, base: 0, importe: 0 };
            acumulado.base = redondear(acumulado.base + base);
            acumulado.importe = redondear(acumulado.importe + importeImpuesto);
            acumuladoPorTasa.set(clave, acumulado);
        }

        return {
            claveProdServ: detalle.codigo_sat || '78101800',
            cantidad: String(detalle.cantidad),
            claveUnidad: detalle.unidad_cfdi || 'H87',
            descripcion: detalle.descripcion,
            valorUnitario: redondear(Number(detalle.precio_unitario)),
            importe,
            descuento: descuento || undefined,
            objetoImp: tieneImpuesto ? '02' : '01',
            ...(impuestosConcepto && { impuestos: impuestosConcepto })
        };
    });

    // subTotal y totalImpuestosTrasladados se arman sumando las cifras
    // "conceptos[].importe" y los totales por tasa que YA están redondeados
    // arriba, para que Total quede matemáticamente idéntico a lo que el
    // validador recalcula a partir de esos mismos campos.
    const subTotal = redondear(conceptos.reduce((sum: number, c: any) => sum + c.importe, 0));
    const totalImpuestosTrasladados = redondear(Array.from(acumuladoPorTasa.values()).reduce((sum, t) => sum + t.importe, 0));
    const total = redondear(subTotal + totalImpuestosTrasladados);

    return {
        version: '4.0',
        emisor: {
            rfc: config.rfc,
            nombre: config.empresa_nombre,
            regimenFiscal: config.regimen_fiscal,
            sucursal: {
                nombre: config.empresa_nombre,
                calle: config.calle || null,
                codigoPostal: config.codigo_postal,
                colonia: config.colonia || null,
                estado: config.estado || null,
                localidad: config.localidad || null,
                municipio: config.municipio || null,
                noExterior: config.no_exterior || null,
                noInterior: config.no_interior || null,
                pais: 'MEX',
                referencia: null,
                correo: null
            }
        },
        receptor: {
            rfc: factura.clientes.rfc,
            nombre: factura.clientes.empresa,
            usoCFDI: factura.clientes.uso_cfdi || 'G03',
            regimenFiscalReceptor: factura.clientes.regimen_fiscal,
            // El SAT exige el código postal REAL del receptor (no el del emisor).
            // Si el cliente no tiene codigo_postal registrado en el catálogo de
            // clientes, se usa el del emisor como último recurso, pero lo
            // correcto es capturar el CP real de cada cliente.
            domicilioFiscalReceptor: factura.clientes.codigo_postal || config.codigo_postal,
            direccionIDFacturador: 0
        },
        conceptos,
        serie: factura.serie && factura.serie !== 'Sin Serie' ? factura.serie : undefined,
        folio: factura.folio,
        fecha: new Date().toISOString().slice(0, 19),
        formaPago: factura.forma_pago,
        subTotal,
        moneda: factura.moneda || 'MXN',
        tipoCambio: factura.tipo_cambio || 1,
        total,
        tipoDeComprobante: factura.tipo_comprobante,
        exportacion: '01',
        metodoPago: factura.metodo_pago,
        lugarExpedicion: config.codigo_postal,
        descripcionFacturador: 'Factura',
        ...(acumuladoPorTasa.size > 0 && {
            impuestos: {
                traslados: Array.from(acumuladoPorTasa.values()).map((t) => ({
                    base: t.base,
                    impuesto: '002',
                    tipoFactor: 'Tasa',
                    tasaOCuota: t.tasaOCuota,
                    importe: t.importe
                })),
                totalImpuestosTrasladados
            }
        })
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

// motivo: clave SAT de cancelación (ver /docs .../cancelacion-de-cfd-is).
// '02' = "comprobante con error y no requiere relacionar con otra factura",
// el caso más común; si necesitas sustituir el comprobante usa '01' y pasa
// folioSustitucion (UUID de la factura que lo sustituye).
export const cancelarFactura = async (uuid: string, motivo: string = '02', folioSustitucion?: string): Promise<RespuestaTimbrado> => {
    try {
        const config = await getConfiguracionFiscal();

        // Un timbrado simulado (UUID falso) no existe en Facturador.com: solo
        // se actualiza el estatus local.
        if (uuid.startsWith('SIMULADO-')) {
            await supabase.from('facturas').update({ status: 'CANCELADA', fecha_cancelacion: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('uuid', uuid);
            return { success: true, uuid };
        }

        const token = await obtenerTokenFacturador(config);
        const emisorId = await obtenerEmisorIdFacturador(config, token);
        const { apiBase } = getUrlsFacturador(config);

        const response = await fetch(`${apiBase}/BusinessEmision/api/v1/emisores/${emisorId}/comprobantes/${uuid}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ motivo, folioSustitucion: folioSustitucion || null })
        });

        const data = await response.json();

        if (!response.ok || data.esValido === false) {
            const mensajeError = (data.errores || []).map((e: any) => e.mensaje || e).join(' | ') || 'Error al cancelar en Facturador.com';
            return { success: false, error: mensajeError };
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

// Vuelve a pedir el XML/PDF de una factura YA TIMBRADA y los guarda. Sirve
// para cuando el timbrado se completó bien pero la descarga falló en su
// momento (por ejemplo, si el servicio de PDFs de Facturador.com estaba
// caído) — no vuelve a timbrar ni gasta otro folio, solo reintenta traer los
// archivos con el UUID que ya se tiene.
export const regenerarArchivosFactura = async (facturaId: number): Promise<{ success: boolean; error?: string }> => {
    try {
        const { data: factura, error: fetchError } = await supabase
            .from('facturas')
            .select('uuid, status')
            .eq('id', facturaId)
            .single();

        if (fetchError || !factura) throw new Error('Factura no encontrada');
        if (factura.status !== 'TIMBRADA' || !factura.uuid) {
            throw new Error('Solo se puede regenerar el XML/PDF de una factura ya timbrada');
        }
        if (factura.uuid.startsWith('SIMULADO-')) {
            throw new Error('Esta factura fue timbrada en modo simulación; no existe en Facturador.com para descargar archivos reales');
        }

        const config = await getConfiguracionFiscal();
        const token = await obtenerTokenFacturador(config);
        const emisorId = await obtenerEmisorIdFacturador(config, token);

        const [xml, pdf] = await Promise.all([
            obtenerXMLFacturador(config, token, emisorId, factura.uuid),
            obtenerPDFFacturador(config, token, emisorId, factura.uuid)
        ]);

        await supabase.from('facturas').update({ xml, pdf, updated_at: new Date().toISOString() }).eq('id', facturaId);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'No se pudo regenerar el XML/PDF' };
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
// (ver aprobarFacturaDeViajes), sea de verdad (Facturador.com) o simulado
// (mientras el modo simulación siga activo en Configuración Fiscal).

// Viajes que ya están ligados a una factura PENDIENTE o TIMBRADA no se
// vuelven a ofrecer, para no facturar el mismo viaje dos veces. Las facturas
// CANCELADA o ERROR no bloquean: una cancelada ya no existe fiscalmente, y
// una en ERROR nunca llegó a timbrarse en el SAT (el intento falló), así que
// no debe impedir que el viaje se vuelva a facturar.
const fetchIdsViajesYaFacturados = async (): Promise<Set<number>> => {
    const { data, error } = await supabase
        .from('facturas_detalles')
        .select('id_viaje, facturas!inner(status)')
        .not('id_viaje', 'is', null)
        .in('facturas.status', ['PENDIENTE', 'TIMBRADA']);

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

// Aprueba/timbra la factura: si modo_simulacion está activo (o faltan
// credenciales de Facturador.com), genera un timbrado simulado sin llamar a
// ninguna API externa. Si está desactivado y hay credenciales, timbra de
// verdad contra Facturador.com.
export const aprobarFacturaDeViajes = async (facturaId: number): Promise<RespuestaTimbrado> => {
    try {
        const { data: factura, error: facturaError } = await supabase
            .from('facturas')
            .select(`*, facturas_detalles (*), clientes (id, empresa, rfc, regimen_fiscal, uso_cfdi, metodo_pago, direccion, codigo_postal)`)
            .eq('id', facturaId)
            .single();

        if (facturaError || !factura) throw new Error('Factura no encontrada');

        const config = await getConfiguracionFiscal();
        const idsViajes: number[] = (factura.facturas_detalles || [])
            .map((d: any) => d.id_viaje)
            .filter((id: any): id is number => id != null);

        let resultado: RespuestaTimbrado;

        const tieneCredencialesFacturador = !!(config.facturador_rfc && config.facturador_password_md5 && config.facturador_client_id && config.facturador_client_secret);
        if (config.modo_simulacion || !tieneCredencialesFacturador) {
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

// Elimina un borrador o intento fallido de factura (estatus PENDIENTE o
// ERROR) que nunca llegó a timbrarse en el SAT, y libera los viajes que
// tenía ligados para poder volver a facturarlos. Una factura ya TIMBRADA no
// se puede borrar así — esa debe cancelarse con cancelarFactura, que es el
// proceso oficial reconocido por el SAT.
export const eliminarFacturaBorrador = async (facturaId: number): Promise<void> => {
    const { data: factura, error: fetchError } = await supabase
        .from('facturas')
        .select('status')
        .eq('id', facturaId)
        .single();

    if (fetchError || !factura) throw new Error('Factura no encontrada');
    if (factura.status === 'TIMBRADA') {
        throw new Error('No se puede eliminar una factura ya timbrada; primero cancélala.');
    }

    const { error: detallesError } = await supabase.from('facturas_detalles').delete().eq('factura_id', facturaId);
    if (detallesError) throw new Error(detallesError.message);

    const { error: facturaError } = await supabase.from('facturas').delete().eq('id', facturaId);
    if (facturaError) throw new Error(facturaError.message);
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

// Llamada real a Facturador.com: obtiene token + emisorId, arma el payload
// del comprobante y lo timbra. El endpoint no regresa el XML/PDF en la misma
// respuesta (solo el UUID) — por eso, tras timbrar, se piden por separado con
// obtenerPDFFacturador/obtenerXMLFacturador.
const timbrarConFacturadorElectronico = async (factura: any, config: ConfiguracionFiscal): Promise<RespuestaTimbrado> => {
    try {
        const token = await obtenerTokenFacturador(config);
        const emisorId = await obtenerEmisorIdFacturador(config, token);
        const { apiBase } = getUrlsFacturador(config);
        const payload = construirPayloadFacturador(factura, config);

        const response = await fetch(`${apiBase}/businessEmision/api/v1/emisores/${emisorId}/comprobantes?emitir=true`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || data.esValido === false) {
            const mensajeError = (data.errores || []).map((e: any) => e.mensaje || e).join(' | ') || data.title || 'Error al timbrar con Facturador.com';
            return { success: false, error: mensajeError };
        }

        let xml: string | undefined;
        let pdf: string | undefined;
        try {
            [xml, pdf] = await Promise.all([
                obtenerXMLFacturador(config, token, emisorId, data.uuid),
                obtenerPDFFacturador(config, token, emisorId, data.uuid)
            ]);
        } catch (errorArchivos: any) {
            // El comprobante ya quedó timbrado (tiene UUID); si falla la
            // descarga de xml/pdf no se pierde el timbrado, solo se podrán
            // volver a descargar después desde "Mis Facturas".
            console.error('Comprobante timbrado, pero falló la descarga de XML/PDF:', errorArchivos);
        }

        return { success: true, uuid: data.uuid, xml, pdf };
    } catch (error: any) {
        return { success: false, error: error.message || 'Error al conectar con Facturador.com' };
    }
};

// Descarga el XML del comprobante ya timbrado.
const obtenerXMLFacturador = async (config: ConfiguracionFiscal, token: string, emisorId: number, uuid: string): Promise<string> => {
    const { apiBase } = getUrlsFacturador(config);
    const response = await fetch(`${apiBase}/businessEmision/api/v1/emisores/${emisorId}/descargacomprobantes/${uuid}?tipoContenido=xml`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('No se pudo descargar el XML del comprobante');
    return response.text();
};

// Pide la representación en PDF; Facturador.com regresa la URL (temporal, en
// su blob storage) del archivo ya generado.
const obtenerPDFFacturador = async (config: ConfiguracionFiscal, token: string, emisorId: number, uuid: string): Promise<string> => {
    const { apiBase } = getUrlsFacturador(config);
    const response = await fetch(`${apiBase}/businessEmision/api/v1/emisores/${emisorId}/comprobantes/${uuid}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('No se pudo generar el PDF del comprobante');
    const data = await response.json().catch(() => null);
    // El endpoint puede regresar la URL como texto plano o dentro de un JSON,
    // según el estado del comprobante; se cubren ambos casos.
    return typeof data === 'string' ? data : data?.url || (await response.text());
};