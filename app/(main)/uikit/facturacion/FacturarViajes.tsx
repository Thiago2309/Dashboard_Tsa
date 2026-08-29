"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { RadioButton } from 'primereact/radiobutton';

import {
    getClientesFiscales,
    getConfiguracionFiscal,
    fetchViajesFacturablesPorCliente,
    crearFacturaDeViajes,
    ClienteFiscal,
    ConfiguracionFiscal as ConfiguracionFiscalTipo
} from '../../../../Services/BD/facturacion/fiscalApiService';
import { ViajeEstimacion } from '../../../../Services/BD/estimacionesService';

const validarCliente = (cliente: ClienteFiscal): { valid: boolean; message?: string } => {
    if (!cliente.rfc || cliente.rfc.trim().length < 12) {
        return { valid: false, message: `El cliente "${cliente.empresa}" no tiene RFC válido.` };
    }
    const rfcRegex = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
    if (!rfcRegex.test(cliente.rfc.toUpperCase())) {
        return { valid: false, message: `El RFC "${cliente.rfc}" no tiene un formato válido.` };
    }
    if (!cliente.regimen_fiscal) {
        return { valid: false, message: `El cliente "${cliente.empresa}" no tiene régimen fiscal registrado.` };
    }
    if (!cliente.uso_cfdi) {
        return { valid: false, message: `El cliente "${cliente.empresa}" no tiene uso de CFDI registrado.` };
    }
    return { valid: true };
};

const formatCurrency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);

const FacturarViajes = () => {
    const [clientes, setClientes] = useState<ClienteFiscal[]>([]);
    const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteFiscal | null>(null);
    const [config, setConfig] = useState<ConfiguracionFiscalTipo | null>(null);
    const [viajes, setViajes] = useState<ViajeEstimacion[]>([]);
    const [viajesSeleccionados, setViajesSeleccionados] = useState<ViajeEstimacion[]>([]);
    const [loadingClientes, setLoadingClientes] = useState(true);
    const [loadingViajes, setLoadingViajes] = useState(false);
    const [generando, setGenerando] = useState(false);
    const [agruparEnUnaFactura, setAgruparEnUnaFactura] = useState(true);

    const toast = useRef<Toast>(null);

    useEffect(() => {
        cargarDatosIniciales();
    }, []);

    const cargarDatosIniciales = async () => {
        setLoadingClientes(true);
        try {
            const [clientesData, configData] = await Promise.all([getClientesFiscales(), getConfiguracionFiscal()]);
            setClientes(clientesData);
            setConfig(configData);
        } catch (error: any) {
            mostrarError(error.message || 'Error al cargar clientes/configuración');
        } finally {
            setLoadingClientes(false);
        }
    };

    const seleccionarCliente = async (cliente: ClienteFiscal | null) => {
        setClienteSeleccionado(cliente);
        setViajesSeleccionados([]);
        setViajes([]);
        if (!cliente) return;

        setLoadingViajes(true);
        try {
            const data = await fetchViajesFacturablesPorCliente(cliente.id);
            setViajes(data);
            setViajesSeleccionados(data); // por defecto, todos seleccionados
        } catch (error: any) {
            mostrarError(error.message || 'Error al cargar los viajes aprobados del cliente');
        } finally {
            setLoadingViajes(false);
        }
    };

    const mostrarError = (mensaje: string) => {
        toast.current?.show({ severity: 'error', summary: 'Error', detail: mensaje, life: 5000 });
    };

    const mostrarExito = (mensaje: string) => {
        toast.current?.show({ severity: 'success', summary: 'Éxito', detail: mensaje, life: 4000 });
    };

    const generarFactura = async () => {
        if (!clienteSeleccionado) return;
        const validacion = validarCliente(clienteSeleccionado);
        if (!validacion.valid) {
            mostrarError(validacion.message!);
            return;
        }
        if (viajesSeleccionados.length === 0) {
            mostrarError('Selecciona al menos un viaje para facturar');
            return;
        }

        setGenerando(true);
        try {
            if (agruparEnUnaFactura) {
                const factura = await crearFacturaDeViajes(clienteSeleccionado, viajesSeleccionados);
                mostrarExito(
                    `Factura ${config?.serie || ''}${factura.folio ? '-' + factura.folio : ''} creada con ${viajesSeleccionados.length} viaje(s) ` +
                        `(pendiente de aprobar). Ve a "Mis Facturas" para aprobarla/timbrarla.`
                );
            } else {
                const folios: string[] = [];
                const errores: string[] = [];
                for (const viaje of viajesSeleccionados) {
                    try {
                        const factura = await crearFacturaDeViajes(clienteSeleccionado, [viaje]);
                        folios.push(`${config?.serie || ''}${factura.folio ? '-' + factura.folio : ''}`);
                    } catch (error: any) {
                        errores.push(`Viaje ${viaje.folio || viaje.id}: ${error.message || 'error al crear la factura'}`);
                    }
                }
                if (folios.length > 0) {
                    mostrarExito(`${folios.length} factura(s) creada(s) (${folios.join(', ')}), pendientes de aprobar en "Mis Facturas".`);
                }
                if (errores.length > 0) {
                    mostrarError(`No se pudieron crear ${errores.length} factura(s): ${errores.join(' | ')}`);
                }
            }
            await seleccionarCliente(clienteSeleccionado); // refresca la lista, ya sin los viajes recién facturados
        } catch (error: any) {
            mostrarError(error.message || 'No se pudo generar la factura');
        } finally {
            setGenerando(false);
        }
    };

    const totalM3 = viajesSeleccionados.reduce((sum, v) => sum + v.m3, 0);
    const subtotal = viajesSeleccionados.reduce((sum, v) => sum + v.total_viaje, 0);
    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    return (
        <div>
            <Toast ref={toast} />

            <div className="flex justify-content-between align-items-center mb-3">
                <h3 className="m-0">Facturar Viajes</h3>
                {config && (
                    <Tag
                        severity={config.modo_simulacion ? 'warning' : 'success'}
                        value={config.modo_simulacion ? 'Modo simulación activo' : 'Modo real (facturadorelectronico.com)'}
                    />
                )}
            </div>

            <p className="text-color-secondary mt-0 mb-4">
                Elige un cliente para ver sus viajes en estatus <Tag severity="warning" value="aprobado" />. Al generar la factura, esta
                queda <strong>pendiente de aprobar</strong> en &quot;Mis Facturas&quot;; los viajes solo pasan a{' '}
                <Tag severity="success" value="facturado" /> cuando la factura se aprueba/timbra.
            </p>

            <div className="field mb-4" style={{ maxWidth: '420px' }}>
                <label className="font-medium">Cliente</label>
                <Dropdown
                    value={clienteSeleccionado}
                    onChange={(e) => seleccionarCliente(e.value)}
                    options={clientes}
                    optionLabel="empresa"
                    placeholder="Selecciona un cliente"
                    className="w-full"
                    filter
                    showClear
                    disabled={loadingClientes}
                />
                {clienteSeleccionado && (
                    <small className="text-color-secondary">
                        RFC: {clienteSeleccionado.rfc || 'SIN RFC'} | Régimen: {clienteSeleccionado.regimen_fiscal || 'No registrado'} | Uso
                        CFDI: {clienteSeleccionado.uso_cfdi || 'No registrado'}
                    </small>
                )}
            </div>

            {clienteSeleccionado && (
                <>
                    {loadingViajes ? (
                        <div className="flex justify-content-center my-4">
                            <ProgressSpinner style={{ width: '40px', height: '40px' }} />
                        </div>
                    ) : (
                        <>
                            <DataTable
                                value={viajes}
                                selection={viajesSeleccionados}
                                onSelectionChange={(e) => setViajesSeleccionados(e.value as ViajeEstimacion[])}
                                dataKey="id"
                                selectionMode="multiple"
                                paginator
                                rows={10}
                                rowsPerPageOptions={[10, 25, 50]}
                                emptyMessage="Este cliente no tiene viajes en estatus 'aprobado' pendientes de facturar"
                                className="p-datatable-sm"
                                showGridlines
                            >
                                <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />
                                <Column field="folio" header="Folio" style={{ width: '110px' }} />
                                <Column field="fecha" header="Fecha" body={(r: ViajeEstimacion) => (r.fecha ? new Date(r.fecha).toLocaleDateString('es-MX') : '-')} style={{ width: '110px' }} />
                                <Column field="origen" header="Origen" />
                                <Column field="destino" header="Destino" />
                                <Column field="material" header="Material" />
                                <Column field="m3" header="M3" body={(r: ViajeEstimacion) => r.m3.toFixed(2)} style={{ width: '90px' }} />
                                <Column field="precio" header="Precio Unitario" body={(r: ViajeEstimacion) => formatCurrency(r.precio)} style={{ width: '130px' }} />
                                <Column
                                    field="total_viaje"
                                    header="Total Viaje"
                                    body={(r: ViajeEstimacion) => <strong className="text-green-600">{formatCurrency(r.total_viaje)}</strong>}
                                    style={{ width: '130px' }}
                                />
                            </DataTable>

                            <div className="flex justify-content-end mt-3">
                                <div className="text-right">
                                    <div>Viajes seleccionados: <strong>{viajesSeleccionados.length}</strong> ({totalM3.toFixed(2)} m³)</div>
                                    <div>Subtotal: <strong>{formatCurrency(subtotal)}</strong></div>
                                    <div>IVA (16%): <strong>{formatCurrency(iva)}</strong></div>
                                    <div className="text-xl mt-2">Total: <strong>{formatCurrency(total)}</strong></div>
                                </div>
                            </div>

                            <div className="flex justify-content-between align-items-center mt-4 flex-wrap gap-3">
                                <div className="flex gap-4">
                                    <div className="flex align-items-center">
                                        <RadioButton
                                            inputId="agrupar"
                                            name="modoFacturacion"
                                            checked={agruparEnUnaFactura}
                                            onChange={() => setAgruparEnUnaFactura(true)}
                                        />
                                        <label htmlFor="agrupar" className="ml-2">Una sola factura con todos los viajes seleccionados</label>
                                    </div>
                                    <div className="flex align-items-center">
                                        <RadioButton
                                            inputId="porViaje"
                                            name="modoFacturacion"
                                            checked={!agruparEnUnaFactura}
                                            onChange={() => setAgruparEnUnaFactura(false)}
                                        />
                                        <label htmlFor="porViaje" className="ml-2">Una factura por cada viaje</label>
                                    </div>
                                </div>
                                <Button
                                    label={config?.modo_simulacion ? 'Generar Factura (simulada)' : 'Generar Factura'}
                                    icon="pi pi-file-edit"
                                    onClick={generarFactura}
                                    loading={generando}
                                    disabled={viajesSeleccionados.length === 0}
                                />
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default FacturarViajes;
