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
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { TabView, TabPanel } from 'primereact/tabview';
import {
    fetchEntidadesConCuentas,
    fetchCuentasPorEntidad,
    crearCuentaPorPagar,
    registrarPagoCxP,
    actualizarFechaPagoEsperadoCxP,
    fetchHistorialPagosCxP,
    actualizarPagoCxP,
    fetchTodosProveedores,
    ResumenEntidad,
    CuentaPorPagar
} from '../../../../Services/BD/CxPService';

const TIPO_ENTIDAD = 'Proveedor';

const CxpCrud = () => {
    const [resumenEntidades, setResumenEntidades] = useState<ResumenEntidad[]>([]);
    const [cuentasEntidad, setCuentasEntidad] = useState<CuentaPorPagar[]>([]);
    const [entidadSeleccionada, setEntidadSeleccionada] = useState<ResumenEntidad | null>(null);
    const [loading, setLoading] = useState({
        entidades: true,
        detalles: false
    });
    const [totalGeneral, setTotalGeneral] = useState<number>(0);
    const [pagoDialog, setPagoDialog] = useState(false);
    const [editFechaDialog, setEditFechaDialog] = useState(false);
    const [montoPago, setMontoPago] = useState<number>(0);
    const [fechaPagoEdit, setFechaPagoEdit] = useState<Date | null>(null);
    const [cuentaSeleccionada, setCuentaSeleccionada] = useState<CuentaPorPagar | null>(null);
    const toast = useRef<Toast>(null);
    const [historialPagos, setHistorialPagos] = useState<any[]>([]);
    const [metodoPago, setMetodoPago] = useState<string>('Efectivo');
    const [referenciaPago, setReferenciaPago] = useState<string>('');
    const [pagoEditDialog, setPagoEditDialog] = useState(false);
    const [pagoEditado, setPagoEditado] = useState<any>(null);
    const [nuevoMonto, setNuevoMonto] = useState<number>(0);
    const [nuevaCuentaDialog, setNuevaCuentaDialog] = useState(false);
    const [proveedores, setProveedores] = useState<{id: number, nombre: string}[]>([]);
    const [nuevaCuenta, setNuevaCuenta] = useState<Omit<CuentaPorPagar, 'id'>>({
        id_entidad: 0,
        tipo_entidad: TIPO_ENTIDAD,
        id_compra: null,
        fecha: new Date().toISOString().split('T')[0],
        monto: 0,
        saldo: 0,
        estatus: 'Pendiente',
        fecha_pago_esperado: null,
        notas: ''
    });

    useEffect(() => {
        const cargarDatosIniciales = async () => {
            setLoading(prev => ({...prev, entidades: true}));
            try {
                const [entidades, proveedoresData] = await Promise.all([
                    fetchEntidadesConCuentas(TIPO_ENTIDAD),
                    fetchTodosProveedores()
                ]);
                setResumenEntidades(entidades);
                setProveedores(proveedoresData);
                setTotalGeneral(entidades.reduce((sum, e) => sum + e.total_adeudado, 0));
            } catch (error) {
                mostrarError('Error al cargar datos iniciales');
            } finally {
                setLoading(prev => ({...prev, entidades: false}));
            }
        };

        cargarDatosIniciales();
    }, []);

    const handleEntidadClick = async (entidad: ResumenEntidad) => {
        if (entidadSeleccionada?.id_entidad === entidad.id_entidad) {
            setEntidadSeleccionada(null);
            setCuentasEntidad([]);
            setHistorialPagos([]);
            return;
        }

        setLoading({ entidades: false, detalles: true });
        setEntidadSeleccionada(entidad);

        try {
            const cuentas = await fetchCuentasPorEntidad(TIPO_ENTIDAD, entidad.id_entidad);
            setCuentasEntidad(cuentas);

            if (cuentas.length > 0) {
                const historial = await fetchHistorialPagosCxP(cuentas[0].id!);
                setHistorialPagos(historial);
            } else {
                setHistorialPagos([]);
            }
        } catch (error) {
            mostrarError(`Error al cargar datos de ${entidad.entidad_nombre}`);
            setEntidadSeleccionada(null);
        } finally {
            setLoading({ entidades: false, detalles: false });
        }
    };

    const actualizarDatos = () => {
        setLoading({ entidades: true, detalles: false });
        fetchEntidadesConCuentas(TIPO_ENTIDAD)
            .then(data => {
                setResumenEntidades(data);
                setTotalGeneral(data.reduce((sum, e) => sum + e.total_adeudado, 0));
            })
            .catch(() => mostrarError('Error al actualizar'))
            .finally(() => setLoading({ entidades: false, detalles: false }));
    };

    const registrarPagoEntidad = async () => {
        if (!montoPago || montoPago <= 0) {
            mostrarError("El monto debe ser mayor a 0");
            return;
        }

        if (!cuentaSeleccionada || !montoPago) return;

        try {
            await registrarPagoCxP(
                cuentaSeleccionada.id!,
                montoPago,
                metodoPago,
                referenciaPago
            );

            // Actualizar datos
            const [resumen, cuentas, historial] = await Promise.all([
                fetchEntidadesConCuentas(TIPO_ENTIDAD),
                entidadSeleccionada ? fetchCuentasPorEntidad(TIPO_ENTIDAD, entidadSeleccionada.id_entidad) : [],
                fetchHistorialPagosCxP(cuentaSeleccionada.id!)
            ]);

            setResumenEntidades(resumen);
            setCuentasEntidad(cuentas);
            setHistorialPagos(historial);
            setTotalGeneral(resumen.reduce((sum, e) => sum + e.total_adeudado, 0));

            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Pago registrado correctamente',
                life: 3000
            });
            setPagoDialog(false);
        } catch (error) {
            mostrarError('Error al registrar pago');
        }
    };

    const guardarFechaPagoEsperado = async () => {
        if (!cuentaSeleccionada) return;

        try {
            await actualizarFechaPagoEsperadoCxP(
                cuentaSeleccionada.id!,
                fechaPagoEdit?.toISOString().split('T')[0] || null
            );

            if (entidadSeleccionada) {
                const cuentas = await fetchCuentasPorEntidad(TIPO_ENTIDAD, entidadSeleccionada.id_entidad);
                setCuentasEntidad(cuentas);
            }

            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Fecha de pago actualizada',
                life: 3000
            });
            setEditFechaDialog(false);
        } catch (error) {
            mostrarError('Error al actualizar la fecha de pago');
        }
    };

    const crearNuevaCuenta = async () => {
        if (!nuevaCuenta.id_entidad || !nuevaCuenta.saldo) {
            mostrarError("Complete todos los campos requeridos");
            return;
        }

        try {
            await crearCuentaPorPagar(nuevaCuenta);

            // Actualizar lista de entidades
            const entidades = await fetchEntidadesConCuentas(TIPO_ENTIDAD);
            setResumenEntidades(entidades);
            setTotalGeneral(entidades.reduce((sum, e) => sum + e.total_adeudado, 0));

            // Si la entidad está seleccionada, actualizar sus cuentas
            if (entidadSeleccionada && entidadSeleccionada.id_entidad === nuevaCuenta.id_entidad) {
                const cuentas = await fetchCuentasPorEntidad(TIPO_ENTIDAD, nuevaCuenta.id_entidad);
                setCuentasEntidad(cuentas);
            }

            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Cuenta creada correctamente',
                life: 3000
            });

            // Resetear formulario
            setNuevaCuenta({
                id_entidad: 0,
                tipo_entidad: TIPO_ENTIDAD,
                id_compra: null,
                fecha: new Date().toISOString().split('T')[0],
                monto: 0,
                saldo: 0,
                estatus: 'Pendiente',
                fecha_pago_esperado: null,
                notas: ''
            });
            setNuevaCuentaDialog(false);
        } catch (error) {
            mostrarError('Error al crear la cuenta');
        }
    };

    const abrirDialogoEditarPago = (pago: any) => {
        setPagoEditado(pago);
        setNuevoMonto(pago.monto);
        setMetodoPago(pago.metodo_pago);
        setPagoEditDialog(true);
    };

    const guardarEdicionPago = async () => {
        if (!pagoEditado) return;

        try {
            await actualizarPagoCxP(
                pagoEditado.id,
                nuevoMonto,
                metodoPago
            );

            // Actualizar datos
            const [resumen, cuentas, historial] = await Promise.all([
                fetchEntidadesConCuentas(TIPO_ENTIDAD),
                entidadSeleccionada ? fetchCuentasPorEntidad(TIPO_ENTIDAD, entidadSeleccionada.id_entidad) : [],
                fetchHistorialPagosCxP(pagoEditado.id_cuenta)
            ]);

            setResumenEntidades(resumen);
            setCuentasEntidad(cuentas);
            setHistorialPagos(historial);
            setTotalGeneral(resumen.reduce((sum, e) => sum + e.total_adeudado, 0));

            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Pago actualizado correctamente',
                life: 3000
            });

            setPagoEditDialog(false);
        } catch (error) {
            mostrarError('Error al actualizar el pago');
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(value);
    };

    const mostrarError = (mensaje: string) => {
        toast.current?.show({
            severity: 'error',
            summary: 'Error',
            detail: mensaje,
            life: 5000
        });
    };

    const fechaBodyTemplate = (rowData: CuentaPorPagar) => {
        return new Date(rowData.fecha).toLocaleDateString('es-MX');
    };

    const fechaPagoBodyTemplate = (rowData: CuentaPorPagar) => {
        return rowData.fecha_pago_esperado
            ? new Date(rowData.fecha_pago_esperado).toLocaleDateString('es-MX')
            : 'Sin fecha';
    };

    const getSeverity = (rowData: CuentaPorPagar) => {
        if (!rowData.fecha_pago_esperado) return 'info';
        const hoy = new Date();
        const fechaPago = new Date(rowData.fecha_pago_esperado);
        const diffDias = Math.ceil((fechaPago.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (fechaPago < hoy) return 'danger';
        if (diffDias <= 3) return 'warning';
        return 'success';
    };

    const estatusBodyTemplate = (rowData: CuentaPorPagar) => {
        return (
            <Tag
                value={rowData.estatus}
                severity={rowData.estatus === 'Pagado' ? 'success' :
                         rowData.estatus === 'Cancelado' ? 'danger' : 'warning'}
            />
        );
    };

    const abrirDialogoPago = (cuenta: CuentaPorPagar) => {
        setCuentaSeleccionada(cuenta);
        setMontoPago(cuenta.adeudo || cuenta.saldo);
        setMetodoPago('Transferencia');
        setReferenciaPago('');
        setPagoDialog(true);
    };

    const abrirDialogoEditarFecha = (cuenta: CuentaPorPagar) => {
        setCuentaSeleccionada(cuenta);
        setFechaPagoEdit(cuenta.fecha_pago_esperado ? new Date(cuenta.fecha_pago_esperado) : null);
        setEditFechaDialog(true);
    };

    return (
        <div className="grid">
            <div className="col-12">
                <Toast ref={toast} />

                <div className="flex justify-content-between align-items-center mb-4">
                    <h2>Cuentas por Pagar</h2>
                    <div className="flex align-items-center gap-4">
                        <div className="bg-white border-round p-3 surface-card shadow-1">
                            <span className="block text-sm text-color-secondary">Total por Pagar:</span>
                            <span className={`text-xl font-medium ${totalGeneral > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                                {formatCurrency(totalGeneral)}
                            </span>
                        </div>
                        <Button
                            icon="pi pi-refresh"
                            label="Actualizar"
                            className="p-button-outlined"
                            onClick={actualizarDatos}
                            disabled={loading.entidades || loading.detalles}
                        />
                        <Button
                            icon="pi pi-plus"
                            label="Nueva Cuenta"
                            className="p-button-success"
                            onClick={() => setNuevaCuentaDialog(true)}
                        />
                    </div>
                </div>

                {loading.entidades ? (
                    <div className="flex justify-content-center">
                        <ProgressSpinner />
                    </div>
                ) : (
                    <>
                        <DataTable
                            value={resumenEntidades}
                            selectionMode="single"
                            selection={entidadSeleccionada}
                            onSelectionChange={(e) => handleEntidadClick(e.value as ResumenEntidad)}
                            dataKey="id_entidad"
                            className="p-datatable-sm mb-4"
                            emptyMessage="No se encontraron proveedores con cuentas"
                            paginator
                            rows={5}
                            rowsPerPageOptions={[5, 10, 25]}
                        >
                            <Column
                                field="id_entidad"
                                header="ID Proveedor"
                                body={(row) => (
                                    <span className="font-medium">{row.id_entidad}</span>
                                )}
                            />
                            <Column
                                field="entidad_nombre"
                                header="Proveedor"
                                body={(row) => (
                                    <span className="font-medium">{row.entidad_nombre}</span>
                                )}
                            />
                            <Column
                                header="Total de la Deuda"
                                body={(row) => formatCurrency(row.total_adeudado + row.total_monto_pagado)}
                            />
                            <Column
                                field="total_monto_pagado"
                                header="Total Pagado"
                                body={(row) => formatCurrency(row.total_monto_pagado || 0)}
                            />
                            <Column
                                header="Saldo Restante"
                                body={(row) => (
                                    <span className={`font-semibold ${row.total_adeudado > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                                        {formatCurrency(Math.max(0, row.total_adeudado))}
                                    </span>
                                )}
                            />
                            <Column
                                header="Estatus"
                                body={(row) => (
                                    <Tag
                                        value={row.cuentas_pendientes > 0 ? "Por pagar" : "Al día"}
                                        severity={row.cuentas_pendientes > 0 ? 'warning' : 'success'}
                                        rounded
                                    />
                                )}
                            />
                        </DataTable>

                        {entidadSeleccionada && (
                            <div className="mt-5">
                                <Card
                                    title={`Detalles de cuentas - ${entidadSeleccionada.entidad_nombre}`}
                                    subTitle={`Total Adeudado: ${formatCurrency(entidadSeleccionada.total_adeudado)}`}
                                >
                                    {loading.detalles ? (
                                        <div className="flex justify-content-center">
                                            <ProgressSpinner />
                                        </div>
                                    ) : (
                                        <>
                                            <DataTable
                                                value={cuentasEntidad}
                                                emptyMessage="No se encontraron cuentas"
                                                className="p-datatable-sm mb-5"
                                            >
                                                <Column field="fecha" header="Fecha" body={fechaBodyTemplate} />
                                                <Column
                                                    field="monto"
                                                    header="Total Pagado"
                                                    body={(row) => formatCurrency(row.monto)}
                                                />
                                                <Column
                                                    field="saldo"
                                                    header="Monto Total"
                                                    body={(row) => formatCurrency(row.saldo)}
                                                />
                                                <Column
                                                    field="adeudo"
                                                    header="Saldo Pendiente"
                                                    body={(row) => (
                                                        <span className={`font-bold ${row.adeudo && row.adeudo > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                                                            {formatCurrency(row.adeudo || 0)}
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
                                                            disabled={row.estatus !== 'Pendiente'}
                                                        />
                                                    )}
                                                />
                                            </DataTable>
                                            <TabView>
                                                <TabPanel header="Historial de Pagos">
                                                    <DataTable
                                                        value={historialPagos}
                                                        paginator
                                                        rows={5}
                                                        emptyMessage="No hay pagos registrados"
                                                        className="p-datatable-sm"
                                                    >
                                                        <Column field="fecha" header="Fecha" body={(row) => new Date(row.fecha).toLocaleString('es-MX')} />
                                                        <Column field="monto" header="Monto" body={(row) => formatCurrency(row.monto)} />
                                                        <Column field="metodo_pago" header="Método" />
                                                        <Column field="referencia" header="Referencia" body={(row) => row.referencia || '-'} />
                                                        <Column
                                                            header="Editar"
                                                            body={(row) => (
                                                                <Button
                                                                    icon="pi pi-pencil"
                                                                    className="p-button-rounded p-button-text p-button-sm"
                                                                    onClick={() => abrirDialogoEditarPago(row)}
                                                                    tooltip="Editar pago"
                                                                />
                                                            )}
                                                        />
                                                    </DataTable>
                                                </TabPanel>
                                            </TabView>
                                        </>
                                    )}
                                </Card>
                            </div>
                        )}
                    </>
                )}

                {/* Diálogo para nueva cuenta */}
                <Dialog
                    visible={nuevaCuentaDialog}
                    onHide={() => setNuevaCuentaDialog(false)}
                    header="Nueva Cuenta por Pagar"
                    style={{ width: '500px' }}
                >
                    <div className="p-fluid">
                        <div className="field">
                            <label htmlFor="entidad">Proveedor *</label>
                            <Dropdown
                                id="entidad"
                                options={proveedores.map(p => ({
                                    label: p.nombre,
                                    value: p.id
                                }))}
                                value={nuevaCuenta.id_entidad}
                                onChange={(e) => setNuevaCuenta({
                                    ...nuevaCuenta,
                                    id_entidad: e.value
                                })}
                                placeholder="Seleccione un proveedor"
                                filter
                                filterBy="label"
                                required
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="saldo">Monto Total *</label>
                            <InputNumber
                                id="saldo"
                                value={nuevaCuenta.saldo}
                                onValueChange={(e) => setNuevaCuenta({
                                    ...nuevaCuenta,
                                    saldo: e.value || 0
                                })}
                                mode="currency"
                                currency="MXN"
                                locale="es-MX"
                                min={0}
                                required
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="fecha">Fecha *</label>
                            <Calendar
                                id="fecha"
                                value={new Date(nuevaCuenta.fecha)}
                                onChange={(e) => setNuevaCuenta({
                                    ...nuevaCuenta,
                                    fecha: e.value?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]
                                })}
                                dateFormat="dd/mm/yy"
                                showIcon
                                required
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="fecha_pago_esperado">Fecha Pago Esperado (Opcional)</label>
                            <Calendar
                                id="fecha_pago_esperado"
                                value={nuevaCuenta.fecha_pago_esperado ? new Date(nuevaCuenta.fecha_pago_esperado) : null}
                                onChange={(e) => setNuevaCuenta({
                                    ...nuevaCuenta,
                                    fecha_pago_esperado: e.value?.toISOString().split('T')[0] || null
                                })}
                                dateFormat="dd/mm/yy"
                                showIcon
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="notas">Notas (Opcional)</label>
                            <InputTextarea
                                id="notas"
                                value={nuevaCuenta.notas || ''}
                                onChange={(e) => setNuevaCuenta({
                                    ...nuevaCuenta,
                                    notas: e.target.value
                                })}
                                rows={3}
                            />
                        </div>
                    </div>
                    <div className="flex justify-content-end gap-2 mt-4">
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            className="p-button-text"
                            onClick={() => setNuevaCuentaDialog(false)}
                        />
                        <Button
                            label="Guardar"
                            icon="pi pi-check"
                            onClick={crearNuevaCuenta}
                            disabled={!nuevaCuenta.id_entidad || !nuevaCuenta.saldo}
                        />
                    </div>
                </Dialog>

                {/* Diálogo para registrar pago */}
                <Dialog
                    visible={pagoDialog}
                    onHide={() => setPagoDialog(false)}
                    header="Registrar Pago"
                    style={{ width: '450px' }}
                >
                    <div className="p-fluid">
                        <div className="field">
                            <label>Monto *</label>
                            <InputNumber
                                value={montoPago}
                                onValueChange={(e) => setMontoPago(e.value ?? 0)}
                                mode="currency"
                                currency="MXN"
                                locale="es-MX"
                                min={0.01}
                                max={cuentaSeleccionada?.adeudo}
                                required
                            />
                        </div>
                        <div className="field">
                            <label>Método de Pago *</label>
                            <Dropdown
                                options={['Transferencia', 'Efectivo', 'Cheque', 'Tarjeta']}
                                value={metodoPago}
                                onChange={(e) => setMetodoPago(e.value)}
                                placeholder="Seleccione método"
                                required
                            />
                        </div>
                        <div className="field">
                            <label>Referencia (Opcional)</label>
                            <InputText
                                value={referenciaPago}
                                onChange={(e) => setReferenciaPago(e.target.value)}
                                placeholder="Ej. Transferencia #1234"
                            />
                        </div>
                        <small className="block mt-2">
                            Saldo pendiente: {formatCurrency(cuentaSeleccionada?.adeudo || 0)}
                        </small>
                    </div>
                    <div className="flex justify-content-end gap-2 mt-4">
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            className="p-button-text"
                            onClick={() => setPagoDialog(false)}
                        />
                        <Button
                            label="Registrar"
                            icon="pi pi-check"
                            onClick={registrarPagoEntidad}
                            disabled={!montoPago || montoPago <= 0}
                        />
                    </div>
                </Dialog>

                {/* Diálogo para editar fecha de pago esperado */}
                <Dialog
                    visible={editFechaDialog}
                    onHide={() => setEditFechaDialog(false)}
                    header="Editar Fecha de Pago Esperado"
                    style={{ width: '450px' }}
                >
                    <div className="p-fluid">
                        <div className="field">
                            <label>Fecha de Pago Esperado</label>
                            <Calendar
                                value={fechaPagoEdit}
                                onChange={(e) => setFechaPagoEdit(e.value as Date)}
                                dateFormat="dd/mm/yy"
                                showIcon
                                placeholder="Seleccione una fecha"
                            />
                        </div>
                        <small>Deje en blanco para eliminar la fecha</small>
                    </div>
                    <div className="flex justify-content-end gap-2 mt-4">
                        <Button
                            label="Cancelar"
                            icon="pi pi-times"
                            className="p-button-text"
                            onClick={() => setEditFechaDialog(false)}
                        />
                        <Button
                            label="Guardar"
                            icon="pi pi-check"
                            onClick={guardarFechaPagoEsperado}
                        />
                    </div>
                </Dialog>

                {/* Diálogo para editar pago existente */}
                <Dialog
                    visible={pagoEditDialog}
                    onHide={() => setPagoEditDialog(false)}
                    header={`Editar Pago del ${pagoEditado ? new Date(pagoEditado.fecha).toLocaleDateString('es-MX') : ''}`}
                    style={{ width: '450px' }}
                >
                    <div className="p-fluid">
                        <div className="field">
                            <label>Nuevo Monto *</label>
                            <InputNumber
                                value={nuevoMonto}
                                onValueChange={(e) => setNuevoMonto(e.value || 0)}
                                mode="currency"
                                currency="MXN"
                                locale="es-MX"
                                min={0.01}
                                required
                            />
                        </div>
                        <div className="field">
                            <label>Método de Pago *</label>
                            <Dropdown
                                options={
                                    pagoEditado?.metodo_pago === 'Efectivo'
                                    ? ['Efectivo']
                                    : ['Transferencia', 'Efectivo', 'Cheque', 'Tarjeta']
                                }
                                value={metodoPago}
                                onChange={(e) => setMetodoPago(e.value)}
                                placeholder="Seleccione método"
                                required
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
                            disabled={!nuevoMonto || nuevoMonto <= 0}
                        />
                    </div>
                </Dialog>
            </div>
        </div>
    );
};

export default CxpCrud;
