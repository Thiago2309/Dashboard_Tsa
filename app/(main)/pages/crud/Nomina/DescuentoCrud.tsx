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
import { 
    Descuento, 
    fetchDescuentos, 
    createDescuento, 
    updateDescuento, 
    deleteDescuento 
} from '../../../../../Services/BD/Nomina/descuentoService';

const DescuentoCrud = () => {
    const [descuentos, setDescuentos] = useState<Descuento[]>([]);
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [showDialog, setShowDialog] = useState(false);
    const [editingDescuento, setEditingDescuento] = useState<Descuento | null>(null);
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);

    // Form state
    const [idOperador, setIdOperador] = useState<number | null>(null);
    const [monto, setMonto] = useState<number>(0);
    const [tipo, setTipo] = useState<'infonavit' | 'fonacot' | 'prestamo' | 'viaticos' | 'otros'>('infonavit');
    const [descripcion, setDescripcion] = useState('');
    const [fechaInicio, setFechaInicio] = useState<Date>(new Date());
    const [fechaFin, setFechaFin] = useState<Date | null>(null);
    const [activo, setActivo] = useState(true);

    const tiposDescuento = [
        { label: 'Infonavit', value: 'infonavit' },
        { label: 'Fonacot', value: 'fonacot' },
        // { label: 'Préstamo', value: 'prestamo' },
        { label: 'Viaticos', value: 'viaticos' },
        { label: 'Otros', value: 'otros' }
    ];

    useEffect(() => {
        cargarDatos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [descuentosData, operadoresData] = await Promise.all([
                fetchDescuentos(),
                fetchOperadores()
            ]);
            setDescuentos(descuentosData);
            setOperadores(operadoresData.filter(op => op.estatus));
        } catch (error) {
            mostrarToast('error', 'Error', 'No se pudieron cargar los datos');
        } finally {
            setLoading(false);
        }
    };

    const mostrarToast = (severity: 'success' | 'error' | 'warn' | 'info', summary: string, detail: string) => {
        toast.current?.show({ severity, summary, detail, life: 3000 });
    };

    const resetForm = () => {
        setIdOperador(null);
        setMonto(0);
        setTipo('infonavit');
        setDescripcion('');
        setFechaInicio(new Date());
        setFechaFin(null);
        setActivo(true);
        setEditingDescuento(null);
    };

    const abrirDialogoNuevo = () => {
        resetForm();
        setShowDialog(true);
    };

    const abrirDialogoEditar = (descuento: Descuento) => {
        setEditingDescuento(descuento);
        setIdOperador(descuento.id_operador);
        setMonto(descuento.monto);
        setTipo(descuento.tipo);
        setDescripcion(descuento.descripcion);
        setFechaInicio(new Date(descuento.fecha_inicio));
        setFechaFin(descuento.fecha_fin ? new Date(descuento.fecha_fin) : null);
        setActivo(descuento.activo);
        setShowDialog(true);
    };

    const guardarDescuento = async () => {
        if (!idOperador) {
            mostrarToast('warn', 'Validación', 'Seleccione un operador');
            return;
        }
        
        if (monto <= 0) {
            mostrarToast('warn', 'Validación', 'El monto debe ser mayor a 0');
            return;
        }

        if (!descripcion.trim()) {
            mostrarToast('warn', 'Validación', 'Ingrese una descripción');
            return;
        }

        setLoading(true);
        try {
            const descuentoData = {
                id_operador: idOperador,
                monto,
                tipo,
                descripcion: descripcion.trim(),
                fecha_inicio: fechaInicio.toISOString().split('T')[0],
                fecha_fin: fechaFin ? fechaFin.toISOString().split('T')[0] : undefined,
                activo
            };

            if (editingDescuento) {
                await updateDescuento({ 
                    ...editingDescuento, 
                    ...descuentoData 
                });
                mostrarToast('success', 'Éxito', 'Descuento actualizado correctamente');
            } else {
                await createDescuento(descuentoData);
                mostrarToast('success', 'Éxito', 'Descuento creado correctamente');
            }

            setShowDialog(false);
            resetForm();
            cargarDatos();
        } catch (error) {
            console.error('Error al guardar descuento:', error);
            mostrarToast('error', 'Error', 'No se pudo guardar el descuento');
        } finally {
            setLoading(false);
        }
    };

    const eliminarDescuento = async (descuento: Descuento) => {
        if (!confirm('¿Está seguro de eliminar este descuento?')) return;

        setLoading(true);
        try {
            await deleteDescuento(descuento.id!);
            mostrarToast('success', 'Éxito', 'Descuento eliminado correctamente');
            cargarDatos();
        } catch (error) {
            console.error('Error al eliminar descuento:', error);
            mostrarToast('error', 'Error', 'No se pudo eliminar el descuento');
        } finally {
            setLoading(false);
        }
    };

    // Templates para la tabla
    const operadorBodyTemplate = (rowData: Descuento) => {
        return rowData.operador_nombre || `ID: ${rowData.id_operador}`;
    };

    const montoBodyTemplate = (rowData: Descuento) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(rowData.monto);
    };

    const tipoBodyTemplate = (rowData: Descuento) => {
        const tiposMap = {
            'infonavit': 'Infonavit',
            'fonacot': 'Fonacot',
            'prestamo': 'Préstamo',
            'viaticos': 'Viáticos',
            'otros': 'Otros'
        };
        return tiposMap[rowData.tipo] || rowData.tipo;
    };

    const estadoBodyTemplate = (rowData: Descuento) => {
        return (
            <span className={`p-tag ${rowData.activo ? 'p-tag-success' : 'p-tag-danger'}`}>
                {rowData.activo ? 'Activo' : 'Inactivo'}
            </span>
        );
    };

    const fechaBodyTemplate = (rowData: Descuento, field: 'fecha_inicio' | 'fecha_fin') => {
        if (!rowData[field]) return '-';
        return new Date(rowData[field]!).toLocaleDateString('es-MX');
    };

    const actionBodyTemplate = (rowData: Descuento) => {
        return (
            <div className="flex gap-1">
                <Button
                    icon="pi pi-pencil"
                    rounded
                    severity="info"
                    tooltip="Editar"
                    onClick={() => abrirDialogoEditar(rowData)}
                    disabled={loading}
                />
                <Button
                    icon="pi pi-trash"
                    rounded
                    severity="danger"
                    tooltip="Eliminar"
                    onClick={() => eliminarDescuento(rowData)}
                    disabled={loading}
                />
            </div>
        );
    };

    const footerDialog = (
        <div>
            <Button 
                label="Cancelar" 
                icon="pi pi-times" 
                onClick={() => {
                    setShowDialog(false);
                    resetForm();
                }} 
                className="p-button-text" 
                disabled={loading}
            />
            <Button 
                label="Guardar" 
                icon="pi pi-check" 
                onClick={guardarDescuento} 
                loading={loading} 
                autoFocus 
            />
        </div>
    );

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    
                    <div className="flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 className="text-2xl font-bold mb-1">Gestión de Descuentos</h2>
                            <p className="text-gray-600 m-0">Administra descuentos para operadores (Infonavit, Fonacot, Otros)</p>
                        </div>
                        
                        <Button
                            label="Nuevo Descuento"
                            icon="pi pi-plus"
                            severity="info"
                            // className="p-button-danger"
                            onClick={abrirDialogoNuevo}
                            disabled={loading}
                        />
                    </div>

                    <Card>
                        <DataTable
                            value={descuentos}
                            paginator
                            rows={10}
                            rowsPerPageOptions={[5, 10, 25, 50]}
                            emptyMessage="No se encontraron descuentos"
                            loading={loading}
                            responsiveLayout="scroll"
                        >
                            <Column field="id" header="ID" sortable style={{ width: '80px' }} />
                            <Column 
                                field="operador_nombre" 
                                header="Operador" 
                                body={operadorBodyTemplate} 
                                sortable 
                                style={{ minWidth: '150px' }}
                            />
                            <Column 
                                field="monto" 
                                header="Monto" 
                                body={montoBodyTemplate} 
                                sortable 
                                style={{ width: '120px' }}
                            />
                            <Column 
                                field="tipo" 
                                header="Tipo" 
                                body={tipoBodyTemplate} 
                                sortable 
                                style={{ width: '120px' }}
                            />
                            <Column 
                                field="descripcion" 
                                header="Descripción" 
                                style={{ minWidth: '150px' }}
                            />
                            <Column 
                                field="fecha_inicio" 
                                header="Inicio" 
                                body={(row) => fechaBodyTemplate(row, 'fecha_inicio')} 
                                sortable 
                                style={{ width: '110px' }}
                            />
                            <Column 
                                field="fecha_fin" 
                                header="Fin" 
                                body={(row) => fechaBodyTemplate(row, 'fecha_fin')} 
                                sortable 
                                style={{ width: '110px' }}
                            />
                            <Column 
                                field="activo" 
                                header="Estado" 
                                body={estadoBodyTemplate} 
                                sortable 
                                style={{ width: '100px' }}
                            />
                            <Column 
                                header="Acciones" 
                                body={actionBodyTemplate} 
                                style={{ width: '120px' }} 
                                frozen
                            />
                        </DataTable>
                    </Card>

                    <Dialog
                        visible={showDialog}
                        style={{ width: '550px' }}
                        header={editingDescuento ? `Editar Descuento` : "Nuevo Descuento"}
                        modal
                        footer={footerDialog}
                        onHide={() => {
                            setShowDialog(false);
                            resetForm();
                        }}
                        closable={!loading}
                    >
                        <div className="p-fluid grid">
                            <div className="field col-12">
                                <label htmlFor="operador">Operador *</label>
                                <Dropdown
                                    id="operador"
                                    value={idOperador}
                                    options={operadores.map(op => ({ label: op.nombre, value: op.id }))}
                                    onChange={(e) => setIdOperador(e.value)}
                                    placeholder="Seleccione un operador"
                                    className="w-full"
                                    disabled={loading}
                                    filter
                                    showClear
                                />
                            </div>

                            <div className="field col-12">
                                <label htmlFor="tipo">Tipo de Descuento *</label>
                                <Dropdown
                                    id="tipo"
                                    value={tipo}
                                    options={tiposDescuento}
                                    onChange={(e) => setTipo(e.value)}
                                    className="w-full"
                                    placeholder="Seleccione tipo de descuento"
                                    disabled={loading}
                                />
                            </div>

                            <div className="field col-12">
                                <label htmlFor="monto">Monto *</label>
                                <InputNumber
                                    id="monto"
                                    value={monto}
                                    onValueChange={(e) => setMonto(e.value || 0)}
                                    mode="currency"
                                    currency="MXN"
                                    locale="es-MX"
                                    className="w-full"
                                    placeholder="$0.00"
                                    disabled={loading}
                                    min={0}
                                />
                            </div>

                            <div className="field col-12">
                                <label htmlFor="descripcion">Descripción *</label>
                                <InputText
                                    id="descripcion"
                                    value={descripcion}
                                    onChange={(e) => setDescripcion(e.target.value)}
                                    placeholder="Ej: Descuento mensual Infonavit"
                                    className="w-full"
                                    disabled={loading}
                                    maxLength={100}
                                />
                            </div>

                            <div className="field col-12 md:col-6">
                                <label htmlFor="fechaInicio">Fecha Inicio</label>
                                <Calendar
                                    id="fechaInicio"
                                    value={fechaInicio}
                                    onChange={(e) => setFechaInicio(e.value as Date)}
                                    dateFormat="dd/mm/yy"
                                    className="w-full"
                                    disabled={loading}
                                    showIcon
                                />
                            </div>

                            <div className="field col-12 md:col-6">
                                <label htmlFor="fechaFin">Fecha Fin (Opcional)</label>
                                <Calendar
                                    id="fechaFin"
                                    value={fechaFin}
                                    onChange={(e) => setFechaFin(e.value as Date)}
                                    dateFormat="dd/mm/yy"
                                    className="w-full"
                                    disabled={loading}
                                    showIcon
                                    minDate={fechaInicio}
                                />
                            </div>

                            <div className="field col-12">
                                <label htmlFor="activo">Estado</label>
                                <Dropdown
                                    id="activo"
                                    value={activo}
                                    options={[
                                        { label: 'Activo', value: true },
                                        { label: 'Inactivo', value: false }
                                    ]}
                                    onChange={(e) => setActivo(e.value)}
                                    className="w-full"
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default DescuentoCrud;