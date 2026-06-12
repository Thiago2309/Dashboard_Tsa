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
import { Bono, fetchBonos, createBono, updateBono, deleteBono } from '../../../../../Services/BD/Nomina/bonosService';

const BonoModule = () => {
    const [bonos, setBonos] = useState<Bono[]>([]);
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [showDialog, setShowDialog] = useState(false);
    const [editingBono, setEditingBono] = useState<Bono | null>(null);
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);

    // Form state
    const [idOperador, setIdOperador] = useState<number | null>(null);
    const [monto, setMonto] = useState<number>(0);
    const [tipo, setTipo] = useState<'fijo' | 'variable'>('fijo');
    const [descripcion, setDescripcion] = useState('');
    const [fechaInicio, setFechaInicio] = useState<Date>(new Date());
    const [fechaFin, setFechaFin] = useState<Date | null>(null);
    const [activo, setActivo] = useState(true);

    const tiposBono = [
        { label: 'Bono Fijo', value: 'fijo' },
        { label: 'Bono Variable', value: 'variable' }
    ];

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            const [bonosData, operadoresData] = await Promise.all([
                fetchBonos(),
                fetchOperadores()
            ]);
            setBonos(bonosData);
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
        setTipo('fijo');
        setDescripcion('');
        setFechaInicio(new Date());
        setFechaFin(null);
        setActivo(true);
        setEditingBono(null);
    };

    const abrirDialogoNuevo = () => {
        resetForm();
        setShowDialog(true);
    };

    const abrirDialogoEditar = (bono: Bono) => {
        setEditingBono(bono);
        setIdOperador(bono.id_operador);
        setMonto(bono.monto);
        setTipo(bono.tipo);
        setDescripcion(bono.descripcion);
        setFechaInicio(new Date(bono.fecha_inicio));
        setFechaFin(bono.fecha_fin ? new Date(bono.fecha_fin) : null);
        setActivo(bono.activo);
        setShowDialog(true);
    };

    const guardarBono = async () => {
        if (!idOperador || monto <= 0 || !descripcion) {
            mostrarToast('warn', 'Validación', 'Complete todos los campos obligatorios');
            return;
        }

        setLoading(true);
        try {
            const bonoData = {
                id_operador: idOperador,
                monto,
                tipo,
                descripcion,
                fecha_inicio: fechaInicio.toISOString().split('T')[0],
                fecha_fin: fechaFin ? fechaFin.toISOString().split('T')[0] : undefined,
                activo
            };

            if (editingBono) {
                await updateBono({ ...editingBono, ...bonoData });
                mostrarToast('success', 'Éxito', 'Bono actualizado correctamente');
            } else {
                await createBono(bonoData);
                mostrarToast('success', 'Éxito', 'Bono creado correctamente');
            }

            setShowDialog(false);
            resetForm();
            cargarDatos();
        } catch (error) {
            mostrarToast('error', 'Error', 'No se pudo guardar el bono');
        } finally {
            setLoading(false);
        }
    };

    const eliminarBono = async (bono: Bono) => {
        if (!confirm('¿Está seguro de eliminar este bono?')) return;

        try {
            await deleteBono(bono.id!);
            mostrarToast('success', 'Éxito', 'Bono eliminado correctamente');
            cargarDatos();
        } catch (error) {
            mostrarToast('error', 'Error', 'No se pudo eliminar el bono');
        }
    };

    const operadorBodyTemplate = (rowData: Bono) => {
        return rowData.operador_nombre || `ID: ${rowData.id_operador}`;
    };

    const montoBodyTemplate = (rowData: Bono) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(rowData.monto);
    };

    const estadoBodyTemplate = (rowData: Bono) => {
        return (
            <span className={`p-tag ${rowData.activo ? 'p-tag-success' : 'p-tag-secondary'}`}>
                {rowData.activo ? 'Activo' : 'Inactivo'}
            </span>
        );
    };

    const fechaBodyTemplate = (rowData: Bono, field: 'fecha_inicio' | 'fecha_fin') => {
        if (!rowData[field]) return '-';
        return new Date(rowData[field]!).toLocaleDateString('es-MX');
    };

    const actionBodyTemplate = (rowData: Bono) => {
        return (
            <div className="flex gap-1">
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
                    onClick={() => eliminarBono(rowData)}
                />
            </div>
        );
    };

    const footerDialog = (
        <div>
            <Button label="Cancelar" icon="pi pi-times" onClick={() => setShowDialog(false)} className="p-button-text" />
            <Button label="Guardar" icon="pi pi-check" onClick={guardarBono} loading={loading} autoFocus />
        </div>
    );

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    
                    <div className="flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 className="text-2xl font-bold mb-1">Módulo de Bonos</h2>
                            <p className="text-gray-600 m-0">Gestiona bonos fijos y variables para empleados</p>
                        </div>
                        
                        <Button
                            label="Nuevo Bono"
                            icon="pi pi-plus"
                            className="p-button-success"
                            onClick={abrirDialogoNuevo}
                        />
                    </div>

                    <Card>
                        <DataTable
                            value={bonos}
                            paginator
                            rows={10}
                            emptyMessage="No se encontraron bonos"
                            loading={loading}
                        >
                            <Column field="id" header="ID" sortable />
                            <Column field="operador_nombre" header="Operador" body={operadorBodyTemplate} sortable />
                            <Column field="monto" header="Monto" body={montoBodyTemplate} sortable />
                            <Column field="tipo" header="Tipo" sortable />
                            <Column field="descripcion" header="Descripción" />
                            <Column field="fecha_inicio" header="Inicio" body={(row) => fechaBodyTemplate(row, 'fecha_inicio')} />
                            <Column field="fecha_fin" header="Fin" body={(row) => fechaBodyTemplate(row, 'fecha_fin')} />
                            <Column field="activo" header="Estado" body={estadoBodyTemplate} />
                            <Column header="Acciones" body={actionBodyTemplate} style={{ width: '120px' }} />
                        </DataTable>
                    </Card>

                    <Dialog
                        visible={showDialog}
                        style={{ width: '500px' }}
                        header={editingBono ? "Editar Bono" : "Nuevo Bono"}
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

                            <div className="field col-12">
                                <label>Tipo de Bono</label>
                                <Dropdown
                                    value={tipo}
                                    options={tiposBono}
                                    onChange={(e) => setTipo(e.value)}
                                    className="w-full"
                                />
                            </div>

                            <div className="field col-12">
                                <label>Descripción *</label>
                                <InputText
                                    value={descripcion}
                                    onChange={(e) => setDescripcion(e.target.value)}
                                    placeholder="Descripción del bono"
                                    className="w-full"
                                />
                            </div>

                            <div className="field col-12 md:col-6">
                                <label>Fecha Inicio</label>
                                <Calendar
                                    value={fechaInicio}
                                    onChange={(e) => setFechaInicio(e.value as Date)}
                                    dateFormat="dd/mm/yy"
                                    className="w-full"
                                />
                            </div>

                            <div className="field col-12 md:col-6">
                                <label>Fecha Fin (Opcional)</label>
                                <Calendar
                                    value={fechaFin}
                                    onChange={(e) => setFechaFin(e.value as Date)}
                                    dateFormat="dd/mm/yy"
                                    className="w-full"
                                />
                            </div>

                            <div className="field col-12">
                                <label>Estado</label>
                                <Dropdown
                                    value={activo}
                                    options={[
                                        { label: 'Activo', value: true },
                                        { label: 'Inactivo', value: false }
                                    ]}
                                    onChange={(e) => setActivo(e.value)}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default BonoModule;