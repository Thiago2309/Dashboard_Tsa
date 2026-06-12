'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Toast } from 'primereact/toast';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { fetchOperadores, Operador } from '../../../../../Services/BD/operadoresService';
import { Prestamo, fetchPrestamos, createPrestamo, updatePrestamo, deletePrestamo, aplicarPagoPrestamo } from '../../../../../Services/BD/Nomina/prestamosService';

const PrestamoModule = () => {
    const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [showDialog, setShowDialog] = useState(false);
    const [showPagoDialog, setShowPagoDialog] = useState(false);
    const [editingPrestamo, setEditingPrestamo] = useState<Prestamo | null>(null);
    const [prestamoPago, setPrestamoPago] = useState<Prestamo | null>(null);
    const [montoPago, setMontoPago] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);

    // Form state
    const [idOperador, setIdOperador] = useState<number | null>(null);
    const [monto, setMonto] = useState<number>(0);
    const [saldoPendiente, setSaldoPendiente] = useState<number>(0);
    const [fechaPrestamo, setFechaPrestamo] = useState<Date>(new Date());
    const [descripcion, setDescripcion] = useState('');
    const [tipo, setTipo] = useState<'Personal' | 'Infonavit' | 'Fonacot'>('Personal');
    const [tasaInteres, setTasaInteres] = useState<number>(0);
    const [plazoMeses, setPlazoMeses] = useState<number>(1);
    const [estatus, setEstatus] = useState<'Pendiente' | 'Pagado' | 'Cancelado'>('Pendiente');

    const tiposPrestamo = [
        { label: 'Personal', value: 'Personal' },
        { label: 'Infonavit', value: 'Infonavit' },
        { label: 'Fonacot', value: 'Fonacot' }
    ];

    const estatusOptions = [
        { label: 'Pendiente', value: 'Pendiente' },
        { label: 'Pagado', value: 'Pagado' },
        { label: 'Cancelado', value: 'Cancelado' }
    ];

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            const [prestamosData, operadoresData] = await Promise.all([
                fetchPrestamos(),
                fetchOperadores()
            ]);
            setPrestamos(prestamosData);
            setOperadores(operadoresData.filter(op => op.estatus));
        } catch (error) {
            mostrarToast('error', 'Error', 'No se pudieron cargar los datos');
        }
    };

    const mostrarToast = (severity: 'success' | 'error' | 'warn' | 'info', summary: string, detail: string) => {
        toast.current?.show({ severity, summary, detail, life: 3000 });
    };

    const resetForm = () => {
        setIdOperador(null);
        setMonto(0);
        setSaldoPendiente(0);
        setFechaPrestamo(new Date());
        setDescripcion('');
        setTipo('Personal');
        setTasaInteres(0);
        setPlazoMeses(1);
        setEstatus('Pendiente');
        setEditingPrestamo(null);
    };

    const abrirDialogoNuevo = () => {
        resetForm();
        setShowDialog(true);
    };

    const abrirDialogoEditar = (prestamo: Prestamo) => {
        setEditingPrestamo(prestamo);
        setIdOperador(prestamo.id_operador);
        setMonto(prestamo.monto);
        setSaldoPendiente(prestamo.saldo_pendiente);
        setFechaPrestamo(new Date(prestamo.fecha_prestamo));
        setDescripcion(prestamo.descripcion ?? '');
        setTipo(prestamo.tipo as 'Personal' | 'Infonavit' | 'Fonacot');
        setTasaInteres(prestamo.tasa_interes);
        setPlazoMeses(prestamo.plazo_meses);
        setEstatus(prestamo.estatus as 'Pendiente' | 'Pagado' | 'Cancelado');
        setShowDialog(true);
    };

    const abrirDialogoPago = (prestamo: Prestamo) => {
        setPrestamoPago(prestamo);
        setMontoPago(0);
        setShowPagoDialog(true);
    };

    const guardarPrestamo = async () => {
        if (!idOperador || monto <= 0 || !descripcion) {
            mostrarToast('warn', 'Validación', 'Complete todos los campos obligatorios');
            return;
        }

        setLoading(true);
        try {
            const prestamoData = {
                id_operador: idOperador,
                monto,
                saldo_pendiente: editingPrestamo ? saldoPendiente : monto, // Para nuevos, saldo = monto
                fecha_prestamo: fechaPrestamo.toISOString().split('T')[0],
                descripcion,
                tipo,
                tasa_interes: tasaInteres,
                plazo_meses: plazoMeses,
                estatus
            };

            if (editingPrestamo) {
                await updatePrestamo({ ...editingPrestamo, ...prestamoData });
                mostrarToast('success', 'Éxito', 'Préstamo actualizado correctamente');
            } else {
                await createPrestamo(prestamoData);
                mostrarToast('success', 'Éxito', 'Préstamo creado correctamente');
            }

            setShowDialog(false);
            resetForm();
            cargarDatos();
        } catch (error) {
            mostrarToast('error', 'Error', 'No se pudo guardar el préstamo');
        } finally {
            setLoading(false);
        }
    };

    const procesarPago = async () => {
        if (!prestamoPago || montoPago <= 0) {
            mostrarToast('warn', 'Validación', 'Ingrese un monto válido');
            return;
        }

        if (montoPago > prestamoPago.saldo_pendiente) {
            mostrarToast('warn', 'Validación', 'El monto excede el saldo pendiente');
            return;
        }

        setLoading(true);
        try {
            await aplicarPagoPrestamo(prestamoPago.id!, montoPago);
            mostrarToast('success', 'Éxito', 'Pago aplicado correctamente');
            setShowPagoDialog(false);
            setPrestamoPago(null);
            cargarDatos();
        } catch (error) {
            mostrarToast('error', 'Error', 'No se pudo procesar el pago');
        } finally {
            setLoading(false);
        }
    };

    const eliminarPrestamo = async (prestamo: Prestamo) => {
        if (!confirm('¿Está seguro de eliminar este préstamo?')) return;

        try {
            await deletePrestamo(prestamo.id!);
            mostrarToast('success', 'Éxito', 'Préstamo eliminado correctamente');
            cargarDatos();
        } catch (error) {
            mostrarToast('error', 'Error', 'No se pudo eliminar el préstamo');
        }
    };

    const operadorBodyTemplate = (rowData: Prestamo) => {
        return rowData.operador_nombre || `ID: ${rowData.id_operador}`;
    };

    const montoBodyTemplate = (rowData: Prestamo) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(rowData.monto);
    };

    const saldoBodyTemplate = (rowData: Prestamo) => {
        return (
            <span className={`font-bold ${rowData.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {new Intl.NumberFormat('es-MX', {
                    style: 'currency',
                    currency: 'MXN'
                }).format(rowData.saldo_pendiente)}
            </span>
        );
    };

    const estadoBodyTemplate = (rowData: Prestamo) => {
        const tagClass = {
            'Pendiente': 'p-tag-warning',
            'Pagado': 'p-tag-success',
            'Cancelado': 'p-tag-danger'
        }[rowData.estatus];

        return (
            <span className={`p-tag ${tagClass}`}>
                {rowData.estatus}
            </span>
        );
    };

    const fechaBodyTemplate = (rowData: Prestamo) => {
        return new Date(rowData.fecha_prestamo).toLocaleDateString('es-MX');
    };

    const actionBodyTemplate = (rowData: Prestamo) => {
        return (
            <div className="flex gap-1">
                {rowData.estatus === 'Pendiente' && (
                    <Button
                        icon="pi pi-money-bill"
                        rounded
                        severity="success"
                        tooltip="Aplicar pago"
                        onClick={() => abrirDialogoPago(rowData)}
                    />
                )}
                <Button
                    icon="pi pi-pencil"
                    rounded
                    severity="warning"
                    tooltip="Editar"
                    onClick={() => abrirDialogoEditar(rowData)}
                />
                <Button
                    icon="pi pi-trash"
                    rounded
                    severity="danger"
                    tooltip="Eliminar"
                    onClick={() => eliminarPrestamo(rowData)}
                />
            </div>
        );
    };

    const footerDialog = (
        <div>
            <Button label="Cancelar" icon="pi pi-times" onClick={() => setShowDialog(false)} className="p-button-text" />
            <Button label="Guardar" icon="pi pi-check" onClick={guardarPrestamo} loading={loading} autoFocus />
        </div>
    );

    const footerPagoDialog = (
        <div>
            <Button label="Cancelar" icon="pi pi-times" onClick={() => setShowPagoDialog(false)} className="p-button-text" />
            <Button label="Procesar Pago" icon="pi pi-check" onClick={procesarPago} loading={loading} autoFocus />
        </div>
    );

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    
                    <div className="flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 className="text-2xl font-bold mb-1">Módulo de Préstamos</h2>
                            <p className="text-gray-600 m-0">Gestiona préstamos para empleados</p>
                        </div>
                        
                        <Button
                            label="Nuevo Préstamo"
                            icon="pi pi-plus"
                            className="p-button-success"
                            onClick={abrirDialogoNuevo}
                        />
                    </div>

                    <Card>
                        <DataTable
                            value={prestamos}
                            paginator
                            rows={10}
                            emptyMessage="No se encontraron préstamos"
                            loading={loading}
                        >
                            <Column field="id" header="ID" sortable />
                            <Column field="operador_nombre" header="Operador" body={operadorBodyTemplate} sortable />
                            <Column field="monto" header="Monto" body={montoBodyTemplate} sortable />
                            <Column field="saldo_pendiente" header="Saldo Pendiente" body={saldoBodyTemplate} sortable />
                            <Column field="tipo" header="Tipo" sortable />
                            <Column field="tasa_interes" header="Tasa %" body={(row) => `${row.tasa_interes}%`} />
                            <Column field="plazo_meses" header="Plazo (meses)" />
                            <Column field="fecha_prestamo" header="Fecha" body={fechaBodyTemplate} />
                            <Column field="estatus" header="Estado" body={estadoBodyTemplate} />
                            <Column field="descripcion" header="Descripción" />
                            <Column header="Acciones" body={actionBodyTemplate} style={{ width: '180px' }} />
                        </DataTable>
                    </Card>

                    <Dialog
                        visible={showDialog}
                        style={{ width: '500px' }}
                        header={editingPrestamo ? "Editar Préstamo" : "Nuevo Préstamo"}
                        modal
                        footer={footerDialog}
                        onHide={() => setShowDialog(false)}
                    >
                        <div className="p-fluid grid">
                            <div className="field col-12">
                                <label>Operador *</label>
                                <Dropdown
                                    value={idOperador}
                                    options={operadores.map(op => ({ label: op.nombre, value: op.id }))}
                                    onChange={(e) => setIdOperador(e.value)}
                                    placeholder="Seleccione operador"
                                    className="w-full"
                                />
                            </div>

                            <div className="field col-12">
                                <label>Monto *</label>
                                <InputNumber
                                    value={monto}
                                    onValueChange={(e) => setMonto(e.value || 0)}
                                    mode="currency"
                                    currency="MXN"
                                    locale="es-MX"
                                    className="w-full"
                                />
                            </div>

                            {editingPrestamo && (
                                <div className="field col-12 md:col-6">
                                    <label>Saldo Pendiente *</label>
                                    <InputNumber
                                        value={saldoPendiente}
                                        onValueChange={(e) => setSaldoPendiente(e.value || 0)}
                                        mode="currency"
                                        currency="MXN"
                                        locale="es-MX"
                                        className="w-full"
                                    />
                                </div>
                            )}

                            <div className="field col-12">
                                <label>Descripción *</label>
                                <InputText
                                    value={descripcion}
                                    onChange={(e) => setDescripcion(e.target.value)}
                                    placeholder="Descripción del préstamo"
                                    className="w-full"
                                />
                            </div>

                            <div className="field col-12 md:col-6">
                                <label>Tipo de Préstamo</label>
                                <Dropdown
                                    value={tipo}
                                    options={tiposPrestamo}
                                    onChange={(e) => setTipo(e.value)}
                                    className="w-full"
                                />
                            </div>

                            <div className="field col-12 md:col-6">
                                <label>Tasa de Interés %</label>
                                <InputNumber
                                    value={tasaInteres}
                                    onValueChange={(e) => setTasaInteres(e.value || 0)}
                                    min={0}
                                    max={100}
                                    suffix="%"
                                    className="w-full"
                                />
                            </div>

                            <div className="field col-12 md:col-6">
                                <label>Plazo (meses)</label>
                                <InputNumber
                                    value={plazoMeses}
                                    onValueChange={(e) => setPlazoMeses(e.value || 1)}
                                    min={1}
                                    className="w-full"
                                />
                            </div>

                            <div className="field col-12 md:col-6">
                                <label>Fecha Préstamo</label>
                                <Calendar
                                    value={fechaPrestamo}
                                    onChange={(e) => setFechaPrestamo(e.value as Date)}
                                    dateFormat="dd/mm/yy"
                                    className="w-full"
                                />
                            </div>

                            <div className="field col-12">
                                <label>Estado</label>
                                <Dropdown
                                    value={estatus}
                                    options={estatusOptions}
                                    onChange={(e) => setEstatus(e.value)}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </Dialog>

                    <Dialog
                        visible={showPagoDialog}
                        style={{ width: '400px' }}
                        header="Aplicar Pago a Préstamo"
                        modal
                        footer={footerPagoDialog}
                        onHide={() => setShowPagoDialog(false)}
                    >
                        {prestamoPago && (
                            <div className="p-fluid grid">
                                <div className="field col-12">
                                    <label>Operador</label>
                                    <InputText value={prestamoPago.operador_nombre || ''} readOnly />
                                </div>

                                <div className="field col-12">
                                    <label>Saldo Pendiente</label>
                                    <InputText 
                                        value={new Intl.NumberFormat('es-MX', {
                                            style: 'currency',
                                            currency: 'MXN'
                                        }).format(prestamoPago.saldo_pendiente)} 
                                        readOnly 
                                    />
                                </div>

                                <div className="field col-12">
                                    <label>Monto a Pagar *</label>
                                    <InputNumber
                                        value={montoPago}
                                        onValueChange={(e) => setMontoPago(e.value || 0)}
                                        mode="currency"
                                        currency="MXN"
                                        locale="es-MX"
                                        min={0}
                                        max={prestamoPago.saldo_pendiente}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        )}
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default PrestamoModule;