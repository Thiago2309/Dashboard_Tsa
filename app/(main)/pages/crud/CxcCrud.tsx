'use client';
import { useState, useEffect, useRef } from 'react';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { Dialog } from 'primereact/dialog';
import { Calendar } from 'primereact/calendar';
import { fetchTodosClientesConCuentas, actualizarPago, 
            fetchCuentasPorCliente, ResumenCliente, CuentaPorCobrar, 
            registrarPago, actualizarFechaPagoEsperado, fetchHistorialPagos, 
            registrarPagoConHistorial 
        } from '../../../../Services/BD/cuentasPorCobrarService';
import { fetchViajesPorCliente } from '../../../../Services/BD/viajeService';
import { supabase } from '@/Services/superbase.service';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { TabView, TabPanel } from 'primereact/tabview';
import { ProgressBar } from 'primereact/progressbar';
import { Divider } from 'primereact/divider';

const CxcCrud = () => {
    const [resumenClientes, setResumenClientes] = useState<ResumenCliente[]>([]);
    const [cuentasCliente, setCuentasCliente] = useState<CuentaPorCobrar[]>([]);
    const [clienteSeleccionado, setClienteSeleccionado] = useState<ResumenCliente | null>(null);
    const [loading, setLoading] = useState({
        clientes: true,
        detalles: false,
        viajes: false
    });
    const [totalGeneral, setTotalGeneral] = useState<number>(0);
    const [viajesCliente, setViajesCliente] = useState<any[]>([]);
    const [pagoDialog, setPagoDialog] = useState(false);
    const [editFechaDialog, setEditFechaDialog] = useState(false);
    const [montoPago, setMontoPago] = useState<number | null>(0); // Ajusta el tipo
    const [fechaPagoEdit, setFechaPagoEdit] = useState<Date | null>(null);
    const [cuentaSeleccionada, setCuentaSeleccionada] = useState<CuentaPorCobrar | null>(null);
    const toast = useRef<Toast>(null);
    const [historialPagos, setHistorialPagos] = useState<any[]>([]);
    const [metodoPago, setMetodoPago] = useState<string>('Efectivo');
    const [referenciaPago, setReferenciaPago] = useState<string>('');
    const [nuevaReferencia, setNuevaReferencia] = useState<string>('');
    // EDITAR MONTO DE HISTORIAL DE ABONOS
    const [pagoEditDialog, setPagoEditDialog] = useState(false);
    const [pagoEditado, setPagoEditado] = useState<any>(null);
    const [nuevoMonto, setNuevoMonto] = useState<number>(0);

    useEffect(() => {
        const cargarClientes = async () => {
            setLoading(prev => ({...prev, clientes: true}));
            try {
                const data = await fetchTodosClientesConCuentas();
                setResumenClientes(data);
                setTotalGeneral(data.reduce((sum, c) => sum + c.total_adeudado, 0));
            } catch (error) {
                mostrarError('Error al cargar clientes');
            } finally {
                setLoading(prev => ({...prev, clientes: false}));
            }
        };

        cargarClientes();
    }, []);


    const abrirDialogoEditarPago = async (pago: any) => {
        setPagoEditado(pago);
        setNuevoMonto(pago.monto);
        setNuevaReferencia(pago.referencia || '');
        setPagoEditDialog(true);
    };

    const guardarEdicionPago = async () => {
        if (!pagoEditado) return;
    
        try {
            // Llama a tu servicio para actualizar el pago
            await actualizarPago(
                pagoEditado.id,
                nuevoMonto,
                pagoEditado.estatus,
                pagoEditado.metodo_pago,
                nuevaReferencia
              );
            
            // Actualiza el estado local
            setHistorialPagos(historialPagos.map(p => 
                p.id === pagoEditado.id ? {...p, monto: nuevoMonto} : p
            ));

            // Actualizar todo, para que se refleje el cambio
            await actualizarDatosClienteSeleccionado();
            
            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Abono actualizado correctamente',
                life: 3000
            });
            
            setPagoEditDialog(false);
        } catch (error) {
            mostrarError('Error al actualizar el abono');
        }
    };

    // ACTUALZIA DATOS DEL CLIENTE ACTIVO (UTIL PARA LLAMARLO EN FUNCIONES)
    const actualizarDatosClienteSeleccionado = async () => {
        if (!clienteSeleccionado) return;
    
        try {
            const data = await fetchTodosClientesConCuentas();
            setResumenClientes(data);
            setTotalGeneral(data.reduce((sum, c) => sum + c.total_adeudado, 0));
            const [cuentas, viajes] = await Promise.all([
                fetchCuentasPorCliente(clienteSeleccionado.id_cliente),
                fetchViajesPorCliente(clienteSeleccionado.id_cliente)
            ]);
            setCuentasCliente(cuentas);
            setViajesCliente(viajes);
        } catch (error) {
            mostrarError('Error al actualizar detalles del cliente');
        }
    };
    

    const handleClienteClick = async (cliente: ResumenCliente) => {
        if (clienteSeleccionado?.id_cliente === cliente.id_cliente) {
            setClienteSeleccionado(null);
            setCuentasCliente([]);
            setViajesCliente([]);
            setHistorialPagos([]); // Limpiar historial al deseleccionar
            return;
        }
    
        setLoading({ clientes: false, detalles: true, viajes: true });
        setClienteSeleccionado(cliente);
    
        try {
            const [cuentas, viajes] = await Promise.all([
                fetchCuentasPorCliente(cliente.id_cliente),
                fetchViajesPorCliente(cliente.id_cliente),
            ]);
    
            setCuentasCliente(cuentas);
            setViajesCliente(viajes);
    
            // Paso 5: Cargar historial de pagos de la PRIMERA cuenta (asumiendo 1 cuenta/cliente)
            if (cuentas.length > 0) {
                const historial = await fetchHistorialPagos(cuentas[0].id!); // Usamos el ID de la primera cuenta
                setHistorialPagos(historial);
            } else {
                setHistorialPagos([]); // No hay cuentas = no hay historial
                console.log("No hay Pagos Asociados a la cuenta");
            }
    
        } catch (error) {
            mostrarError(`Error al cargar datos de ${cliente.cliente_nombre}`);
            setClienteSeleccionado(null);
            setHistorialPagos([]); // Limpiar en caso de error
        } finally {
            setLoading({ clientes: false, detalles: false, viajes: false });
        }
    };

    const mostrarError = (mensaje: string) => {
        toast.current?.show({
            severity: 'error',
            summary: 'Error',
            detail: mensaje,
            life: 5000
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(value);
    };

    const fechaBodyTemplate = (rowData: CuentaPorCobrar) => {
        if (!rowData.fecha) return '-';
        const [year, month, day] = rowData.fecha.split('T')[0].split('-');
        return `${day}-${month}-${year}`;
    };

    const fechaPagoBodyTemplate = (rowData: CuentaPorCobrar) => {
        if (!rowData.fecha_pago_esperado) return 'Sin fecha';
        // Mostrar la fecha exactamente como viene, pero formateada a dd-mm-aaaa sin modificar la zona horaria
        const [year, month, day] = rowData.fecha_pago_esperado.split('T')[0].split('-');
        return `${day}-${month}-${year}`;
    };

    const getSeverity = (rowData: CuentaPorCobrar) => {
        if (!rowData.fecha_pago_esperado) return 'info';
        const hoy = new Date();
        const fechaPago = new Date(rowData.fecha_pago_esperado);
        const diffDias = Math.ceil((fechaPago.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (fechaPago < hoy) return 'danger';
        if (diffDias <= 3) return 'warning';
        return 'success';
    };

    const estatusBodyTemplate = (rowData: CuentaPorCobrar) => {
        return (
            <Tag 
                value={rowData.estatus} 
                severity={rowData.estatus === 'Pagado' ? 'success' : 
                         rowData.estatus === 'Cancelado' ? 'danger' : 'warning'}
            />
        );
    };

    const abrirDialogoPago = (cuenta: CuentaPorCobrar) => {
        setCuentaSeleccionada(cuenta);
        setMontoPago(cuenta.saldo);
        setPagoDialog(true);
    };

    const abrirDialogoEditarFecha = (cuenta: CuentaPorCobrar) => {
        setCuentaSeleccionada(cuenta);
        setFechaPagoEdit(cuenta.fecha_pago_esperado ? new Date(cuenta.fecha_pago_esperado) : null);
        setEditFechaDialog(true);
    };

    const registrarPagoCliente = async () => {
        if (!montoPago || montoPago <= 0) {
            mostrarError("El monto debe ser mayor a 0");
            return;
        }

        if (!cuentaSeleccionada || !montoPago) return;
        
        try {
          await registrarPagoConHistorial(
            cuentaSeleccionada.id!,
            montoPago,
            metodoPago,
            referenciaPago
          );
          
          // Actualizar datos
          const [resumen, cuentas, historial] = await Promise.all([
            fetchTodosClientesConCuentas(),
            fetchCuentasPorCliente(clienteSeleccionado!.id_cliente),
            fetchHistorialPagos(cuentaSeleccionada.id!)
          ]);
          
          setResumenClientes(resumen);
          setCuentasCliente(cuentas);
          setHistorialPagos(historial);
          
          toast.current?.show({ severity: 'success', summary: 'Abono registrado' });
          setPagoDialog(false);
        } catch (error) {
          mostrarError('Error al registrar abono');
        }
      };
    //     if (!cuentaSeleccionada || !montoPago) return;
    
    //     try {
    //         // Actualizamos solo el monto (lo que ha pagado)
    //         const { error } = await supabase
    //             .from('cuentas_por_cobrar')
    //             .update({ 
    //                 monto: montoPago,
    //                 // Actualizamos el estatus si pagó completo
    //                 estatus: montoPago >= cuentaSeleccionada.saldo ? 'Pagado' : 'Pendiente'
    //             })
    //             .eq('id', cuentaSeleccionada.id!);
    
    //         if (error) throw error;
    
    //         // Actualizamos la vista
    //         const [resumen, cuentas] = await Promise.all([
    //             fetchTodosClientesConCuentas(),
    //             clienteSeleccionado ? fetchCuentasPorCliente(clienteSeleccionado.id_cliente) : []
    //         ]);
            
    //         setResumenClientes(resumen);
    //         setTotalGeneral(resumen.reduce((sum, c) => sum + c.total_adeudado, 0));
    //         setCuentasCliente(cuentas);
            
    //         toast.current?.show({
    //             severity: 'success',
    //             summary: 'Éxito',
    //             detail: 'Pago registrado correctamente',
    //             life: 5000
    //         });
    //         setPagoDialog(false);
    //     } catch (error) {
    //         mostrarError('Error al registrar el pago');
    //     }
    // };

    const guardarFechaPagoEsperado = async () => {
        if (!cuentaSeleccionada) return;

        try {
            await actualizarFechaPagoEsperado(
                cuentaSeleccionada.id!, 
                fechaPagoEdit?.toISOString().split('T')[0] || null
            );
            if (clienteSeleccionado) {
                const cuentas = await fetchCuentasPorCliente(clienteSeleccionado.id_cliente);
                setCuentasCliente(cuentas);
            }
            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Fecha de pago actualizada',
                life: 5000
            });
            setEditFechaDialog(false);
        } catch (error) {
            mostrarError('Error al actualizar la fecha de pago');
        }
    };

    const actualizarDatos = async () => {
        setLoading({clientes: true, detalles: false, viajes: false});
        try {
            const data = await fetchTodosClientesConCuentas();
            setResumenClientes(data);
            setTotalGeneral(data.reduce((sum, c) => sum + c.total_adeudado, 0));
            if (clienteSeleccionado) {
                const [cuentas, viajes] = await Promise.all([
                    fetchCuentasPorCliente(clienteSeleccionado.id_cliente),
                    fetchViajesPorCliente(clienteSeleccionado.id_cliente)
                ]);
                setCuentasCliente(cuentas);
                setViajesCliente(viajes);
            }
        } catch (error) {
            mostrarError('Error al actualizar datos');
        } finally {
            setLoading({clientes: false, detalles: false, viajes: false});
        }
    };

    return (
        <div className="grid">
            <div className="col-12">
                <Toast ref={toast} />
                
                <div className="flex justify-content-between align-items-center mb-4">
                    <h2>Cuentas por Cobrar</h2>
                    <div className="flex align-items-center gap-4">
                        <div className="bg-white border-round p-3 surface-card shadow-1">
                            <span className="block text-sm text-color-secondary">Total por Cobrar:</span>
                            <span className={`text-xl font-medium ${Math.max(0, totalGeneral) > 0 ? 'text-green-500' : 'text-orange-500'}`}>
                                {formatCurrency(Math.max(0, totalGeneral))}
                            </span>
                        </div>
                        <Button 
                            icon="pi pi-refresh" 
                            label="Actualizar" 
                            className="p-button-outlined"
                            onClick={actualizarDatos}
                            disabled={loading.clientes || loading.detalles}
                        />
                    </div>
                </div>

                {loading.clientes ? (
                    <div className="flex justify-content-center">
                        <ProgressSpinner />
                    </div>
                ) : (
                    <>
                        <div className="grid">
                            {resumenClientes.map(cliente => (
                                <div className="col-12 md:col-6 lg:col-4" key={cliente.id_cliente}>
                                    <Card 
                                        className={`cursor-pointer transition-all transition-duration-200 ${clienteSeleccionado?.id_cliente === cliente.id_cliente ? 'border-left-3 border-primary' : 'border-left-3 border-white'}`}
                                        onClick={() => handleClienteClick(cliente)}
                                        >
                                        <div className="flex flex-column gap-3">
                                            {/* Header con nombre y estado */}
                                            <div className="flex justify-content-between align-items-start">
                                                <span className="font-medium text-900" style={{ fontSize: '1.1rem' }}>
                                                    {cliente.cliente_nombre}
                                                </span>

                                                <Tag 
                                                    value={Math.abs(cliente.total_horas_viaje - cliente.total_monto_pagado) < 0.01 ? "Pagado" : "Por cobrar"} 
                                                    severity={Math.abs(cliente.total_horas_viaje - cliente.total_monto_pagado) < 0.01 ? 'success' : 'warning'}
                                                    className="scale-90"
                                                    rounded
                                                />
                                            </div>

                                            {/* Línea divisoria sutil */}
                                            <Divider className="my-1 mx-0" />

                                            {/* Detalles financieros */}
                                            <div className="grid">
                                            {/* Total a Cobrar */}
                                            <div className="col-6 flex flex-column">
                                                <span className="text-sm text-600 mb-1">Total de la Deuda</span>
                                                <span className="font-medium text-900">
                                                {formatCurrency(cliente.total_horas_viaje || 0)}
                                                </span>
                                            </div>

                                            {/* Abonado */}
                                            <div className="col-6 flex flex-column">
                                                <span className="text-sm text-600 mb-1">Total Abonado</span>
                                                <span className="font-medium text-green-600">
                                                {formatCurrency(cliente.total_monto_pagado || 0)}
                                                </span>
                                            </div>

                                            {/* Saldo Pendiente */}
                                            <div className="col-12 mt-2">
                                                <div className="flex justify-content-between align-items-center surface-100 p-2 border-round">
                                                <span className="text-sm text-600">Saldo Restante por Cobrar</span>
                                                <span className={`font-semibold ${Math.max(0, (cliente.total_horas_viaje || 0) - (cliente.total_monto_pagado || 0)) > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                                                    {formatCurrency(Math.max(0, (cliente.total_horas_viaje || 0) - (cliente.total_monto_pagado || 0)))}
                                                </span>
                                                </div>
                                            </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            ))}
                        </div>

                        {clienteSeleccionado && (
                            <div className="mt-5">
                                <Card 
                                    title={`Detalles de cuentas - ${clienteSeleccionado.cliente_nombre}`}
                                    subTitle={`Total A Cobrar: ${formatCurrency(Math.max(0, clienteSeleccionado.total_adeudado))}`}
                                >
                                    {loading.detalles ? (
                                        <div className="flex justify-content-center">
                                            <ProgressSpinner />
                                        </div>
                                    ) : (
                                        <>
                                            <DataTable
                                                value={cuentasCliente}
                                                // paginator
                                                // rows={5}
                                                rowsPerPageOptions={[5, 10, 25]}
                                                emptyMessage="No se encontraron cuentas"
                                                className="p-datatable-sm mb-5"
                                            >
                                                <Column field="fecha" header="Fecha de CxC" body={fechaBodyTemplate} />
                                                {/* <Column field="id_viaje" header="Viaje" /> */}
                                                <Column field="monto" header="Monto total Abonado" body={(row) => formatCurrency(row.monto)} />
                                                <Column 
                                                    field="saldo" 
                                                    header="SubTotal de Deuda" 
                                                    body={(row) => (
                                                        <span className="font-bold">
                                                        {formatCurrency(row.saldo || 0)} pesos
                                                        </span>
                                                    )}
                                                />
                                                <Column 
                                                    header="Total A Cobrar" 
                                                    body={(row) => (
                                                        <span className={`font-bold ${row.adeudo > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                            {formatCurrency(row.adeudo)}
                                                        </span>
                                                    )}
                                                />
                                                <Column field="estatus" header="Estatus" body={estatusBodyTemplate} />
                                                <Column 
                                                    field="fecha_pago_esperado" 
                                                    header="Fecha Pago Esperado" 
                                                    body={(row) => (
                                                        <div className="flex align-items-center gap-2">
                                                            <Tag 
                                                                value={fechaPagoBodyTemplate(row)} 
                                                                severity={getSeverity(row)} 
                                                            />
                                                            <Button 
                                                                icon="pi pi-pencil" 
                                                                className="p-button-text p-button-sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    abrirDialogoEditarFecha(row);
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                />
                                                <Column 
                                                    body={(row) => (
                                                        <Button 
                                                            icon="pi pi-money-bill" 
                                                            label="Registrar Pago" 
                                                            className="p-button-sm p-button-success"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                abrirDialogoPago(row);
                                                            }}
                                                            disabled={row.adeudo <= 0}
                                                        />
                                                    )}
                                                />
                                            </DataTable>
                                            <TabView>
                                                <TabPanel header="Historial de Abonos">
                                                    <DataTable 
                                                        value={historialPagos} 
                                                        paginator
                                                        rows={3}
                                                        emptyMessage="No hay Abonos registrados"
                                                        className="p-datatable-sm"
                                                    >
                                                        <Column 
                                                            field="fecha" 
                                                            header="Fecha" 
                                                            body={(row) => {
                                                                if (!row.fecha) return '-';
                                                                // Mostrar la fecha exactamente como viene, pero formateada a dd-mm-aaaa sin modificar la zona horaria
                                                                const [year, month, day] = row.fecha.split('T')[0].split('-');
                                                                return `${day}-${month}-${year}`;
                                                            }} 
                                                        />
                                                        <Column field="monto" header="Monto" body={(row) => formatCurrency(row.monto)} />
                                                        <Column field="metodo_pago" header="Método" />
                                                        <Column field="referencia" header="Descripción" body={(row) => row.referencia ? row.referencia : '-'}/>
                                                        <Column 
                                                            header="Editar" 
                                                            body={(row) => (
                                                                <Button 
                                                                    icon="pi pi-pencil" 
                                                                    className="p-button-rounded p-button-text p-button-sm p-button-edit"
                                                                    onClick={() => abrirDialogoEditarPago(row)}
                                                                    tooltip="Editar monto"
                                                                />
                                                            )} 
                                                        />
                                                    </DataTable>
                                                </TabPanel>
                                            </TabView>

                                            {!loading.viajes && viajesCliente.length > 0 && (
                                                <div className="mt-5">
                                                    <h4>Viajes Relacionados</h4>
                                                    <DataTable
                                                        value={viajesCliente}
                                                        paginator
                                                        rows={5}
                                                        emptyMessage="No se encontraron viajes"
                                                        className="p-datatable-sm"
                                                    >
                                                        <Column field="id" header="Id de Viaje" />
                                                        <Column 
                                                            field="fecha" 
                                                            header="Fecha" 
                                                            body={(row) => {
                                                                if (!row.fecha) return '-';
                                                                // Mostrar la fecha exactamente como viene, pero formateada a dd-mm-aaaa sin modificar la zona horaria
                                                                const [year, month, day] = row.fecha.split('T')[0].split('-');
                                                                return `${day}-${month}-${year}`;
                                                            }} 
                                                        />
                                                        <Column field="folio" header="Folio" />
                                                        <Column field="folio_bco" header="Folio BCO" />
                                                        <Column field="caphrsviajes" header="SubTotal de Deuda" body={(row) => formatCurrency(row.caphrsviajes || 0)} />
                                                    </DataTable>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </Card>
                            </div>
                        )}
                    </>
                )}

                {/* Diálogo de edición de Abono del Historial*/}
                <Dialog 
                    visible={pagoEditDialog} 
                    onHide={() => setPagoEditDialog(false)}
                    header={`Editar Abono del ${pagoEditado ? pagoEditado.fecha?.split('T')[0].split('-').reverse().join('-') : ''}`}
                    style={{ width: '450px' }}
                >
                    <div className="p-fluid">
                        <div className="field">
                            <label htmlFor="monto">Nuevo Monto</label>
                            <InputNumber
                                id="monto"
                                value={nuevoMonto}
                                onValueChange={(e) => setNuevoMonto(e.value || 0)}
                                mode="currency"
                                currency="MXN"
                                locale="es-MX"
                                min={0}
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="referencia">Descripción</label>
                            <InputText
                                id="referencia"
                                value={nuevaReferencia}
                                onChange={(e) => setNuevaReferencia(e.target.value)}
                                placeholder="Descripción del abono"
                            />
                        </div>
                    </div>

                    <div className="flex justify-content-end gap-2 mt-4">
                        <Button 
                            label="Cancelar" 
                            icon="pi pi-times" 
                            className="p-button-text"
                            onClick={() => setPagoEditDialog(false)} 
                        />
                        <Button 
                            label="Guardar" 
                            icon="pi pi-check" 
                            onClick={guardarEdicionPago}
                        />
                    </div>
                </Dialog>
                <Dialog 
                    visible={pagoDialog}
                    onHide={() => setPagoDialog(false)}
                    header="Registrar Abono" 
                    footer={
                        <div>
                            <Button label="Cancelar" icon="pi pi-times" onClick={() => setPagoDialog(false)} className="p-button-text" />
                            <Button label="Registrar" icon="pi pi-check" onClick={registrarPagoCliente} autoFocus />
                        </div>
                    }
                >
                    <div className="p-fluid">
                        <div className="field">
                        <label>Monto</label>
                        <InputNumber 
                            value={0}
                            onChange={(e) => setMontoPago(e.value)}
                            mode="currency" 
                            currency="MXN"
                        />
                        </div>
                        <div className="field">
                        <label>Método de Pago</label>
                        <Dropdown 
                            options={['Efectivo', 'Transferencia']}
                            value={metodoPago}
                            onChange={(e) => setMetodoPago(e.value)}
                            placeholder="Selecciona"
                        />
                        </div>
                        <div className="field">
                        <label>Descripción (opcional)</label>
                        <InputText 
                            value={referenciaPago}
                            onChange={(e) => setReferenciaPago(e.target.value)}
                        />
                        </div>
                        <small>Saldo Faltante: {formatCurrency(cuentaSeleccionada?.adeudo || 0)}</small>
                    </div>
                </Dialog>

                {/* Diálogo para editar fecha de pago esperado */}
                <Dialog 
                    visible={editFechaDialog} 
                    onHide={() => setEditFechaDialog(false)}
                    header="Editar Fecha de Pago Esperado"
                    footer={
                        <div>
                            <Button label="Cancelar" icon="pi pi-times" onClick={() => setEditFechaDialog(false)} className="p-button-text" />
                            <Button label="Guardar" icon="pi pi-check" onClick={guardarFechaPagoEsperado} autoFocus />
                        </div>
                    }
                >
                    <div className="p-fluid">
                        <div className="field">
                            <label htmlFor="fechaPago">Fecha de Pago Esperado</label>
                            <Calendar
                                id="fechaPago"
                                value={fechaPagoEdit ? new Date(fechaPagoEdit.getTime() + fechaPagoEdit.getTimezoneOffset() * 60000) : null}
                                onChange={(e) => setFechaPagoEdit(e.value ?? null)}
                                dateFormat="yy-mm-dd"
                                placeholder="Fecha en formato YYYY-MM-DD"
                                showIcon
                                showButtonBar
                            />
                        </div>
                        <small>Deje en blanco para eliminar la fecha</small>
                    </div>
                </Dialog>
            </div>
        </div>
    );
};

export default CxcCrud;