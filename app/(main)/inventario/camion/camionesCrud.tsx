'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { DataTableFilterMeta } from 'primereact/datatable';
import {
    fetchCamiones,
    createCamion,
    updateCamion,
    deleteCamion,
    Camion
} from '../../../../Services/BD/inventario/camion/camionService';

const CamionesCrud = () => {
    const emptyCamion: Camion = {
        numero_economico: '',
        placa: '',
        tipo: 'Camión',
        marca: '',
        modelo: '',
        año: null,
        serie: '',
        capacidad_toneladas: null,
        numero_motor: '',
        numero_cilindros: null,
        color: '',
        estatus: 'Activo',
        ultimo_servicio: null,
        kilometraje_actual: null,
        observaciones: ''
    };

    const [camiones, setCamiones] = useState<Camion[]>([]);
    const [camionDialog, setCamionDialog] = useState(false);
    const [deleteCamionDialog, setDeleteCamionDialog] = useState(false);
    const [deleteCamionesDialog, setDeleteCamionesDialog] = useState(false);
    const [camion, setCamion] = useState<Camion>(emptyCamion);
    const [selectedCamiones, setSelectedCamiones] = useState<Camion[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    // Opciones para dropdowns
    const tipoOptions = [
        { label: 'Camión', value: 'Camión' },
        { label: 'Tractor', value: 'Tractor' },
        { label: 'Remolque', value: 'Remolque' },
        { label: 'Otro', value: 'Otro' }
    ];

    const estatusOptions = [
        { label: 'Activo', value: 'Activo' },
        { label: 'Mantenimiento', value: 'Mantenimiento' },
        { label: 'Inactivo', value: 'Inactivo' },
        { label: 'Dado de Baja', value: 'Dado de Baja' }
    ];

    // Cargar camiones
    const loadCamiones = async () => {
        setLoading(true);
        try {
            const data = await fetchCamiones();
            setCamiones(data);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    const parseLocalDate = (dateString: string | null): Date | null => {
        if (!dateString) return null;
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const formatLocalDate = (date: Date | null): string | null => {
        if (!date) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    useEffect(() => {
        loadCamiones();
    }, []);

    const openNew = () => {
        setCamion(emptyCamion);
        setSubmitted(false);
        setCamionDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setCamionDialog(false);
    };

    const hideDeleteCamionDialog = () => setDeleteCamionDialog(false);
    const hideDeleteCamionesDialog = () => setDeleteCamionesDialog(false);

    const saveCamion = async () => {
        setSubmitted(true);

        if (!camion.numero_economico?.trim() || !camion.placa?.trim()) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Número económico y placa son requeridos', life: 3000 });
            return;
        }

        try {
            if (camion.id) {
                const updated = await updateCamion(camion.id, camion);
                setCamiones(camiones.map(c => c.id === updated.id ? updated : c));
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Camión actualizado', life: 3000 });
            } else {
                const newCamion = await createCamion(camion);
                setCamiones([newCamion, ...camiones]);
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Camión creado', life: 3000 });
            }
            setCamionDialog(false);
            setCamion(emptyCamion);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const editCamion = (camion: Camion) => {
        setCamion({ ...camion });
        setCamionDialog(true);
    };

    const confirmDeleteCamion = (camion: Camion) => {
        setCamion(camion);
        setDeleteCamionDialog(true);
    };

    const deleteCamionConfirmado = async () => {
        try {
            await deleteCamion(camion.id!);
            setCamiones(camiones.filter(c => c.id !== camion.id));
            setDeleteCamionDialog(false);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Camión eliminado', life: 3000 });
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const confirmDeleteSelected = () => {
        if (selectedCamiones.length === 0) {
            toast.current?.show({ severity: 'warn', summary: 'Advertencia', detail: 'Seleccione al menos un camión', life: 3000 });
            return;
        }
        setDeleteCamionesDialog(true);
    };

    const deleteSelectedCamiones = async () => {
        try {
            await Promise.all(selectedCamiones.map(c => deleteCamion(c.id!)));
            setCamiones(camiones.filter(c => !selectedCamiones.includes(c)));
            setDeleteCamionesDialog(false);
            setSelectedCamiones([]);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Camiones eliminados', life: 3000 });
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const exportCSV = () => dt.current?.exportCSV();

    // Templates para la tabla
    const estatusBodyTemplate = (rowData: Camion) => {
        let severity: 'success' | 'warning' | 'danger' | 'info' = 'success';
        if (rowData.estatus === 'Mantenimiento') severity = 'warning';
        if (rowData.estatus === 'Inactivo') severity = 'info';
        if (rowData.estatus === 'Dado de Baja') severity = 'danger';
        return <Tag severity={severity} value={rowData.estatus} />;
    };

    const tipoBodyTemplate = (rowData: Camion) => {
        let icon = '';
        switch (rowData.tipo) {
            case 'Camión': icon = 'pi pi-truck'; break;
            case 'Tractor': icon = 'pi pi-github'; break;
            case 'Remolque': icon = 'pi pi-box'; break;
            default: icon = 'pi pi-question';
        }
        return (
            <div className="flex align-items-center gap-2">
                <i className={icon} />
                <span>{rowData.tipo}</span>
            </div>
        );
    };

    const actionBodyTemplate = (rowData: Camion) => (
        <div className="flex gap-2">
            <Button icon="pi pi-pencil" rounded severity="info" onClick={() => editCamion(rowData)} tooltip="Editar" />
            <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteCamion(rowData)} tooltip="Eliminar" />
        </div>
    );

    const leftToolbarTemplate = () => (
        <div className="my-2 flex gap-2">
            <Button label="Nuevo Camión" icon="pi pi-plus" severity="info" onClick={openNew} />
            <Button label="Eliminar" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} disabled={!selectedCamiones || selectedCamiones.length === 0} />
        </div>
    );

    const rightToolbarTemplate = () => (
        <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={exportCSV} />
    );

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Camiones y Tractores</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })} placeholder="Buscar..." />
            </span>
        </div>
    );

    const camionDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveCamion} />
        </>
    );

    const deleteCamionDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteCamionDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteCamionConfirmado} />
        </>
    );

    const deleteCamionesDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteCamionesDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteSelectedCamiones} />
        </>
    );

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} right={rightToolbarTemplate} />

                    <DataTable
                        ref={dt}
                        value={camiones}
                        selection={selectedCamiones}
                        onSelectionChange={(e) => setSelectedCamiones(e.value || [])}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        loading={loading}
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No se encontraron camiones"
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} exportable={false} />
                        <Column field="id" header="ID" sortable style={{ width: '80px' }} />
                        <Column field="numero_economico" header="N° Camion" sortable style={{ width: '130px' }} />
                        <Column field="placa" header="Placa" sortable style={{ width: '120px' }} />
                        <Column field="tipo" header="Tipo" body={tipoBodyTemplate} sortable style={{ width: '120px' }} />
                        <Column field="marca" header="Marca" sortable style={{ width: '120px' }} />
                        <Column field="modelo" header="Modelo" sortable style={{ width: '100px' }} />
                        <Column field="año" header="Año" sortable style={{ width: '80px' }} />
                        <Column field="capacidad_toneladas" header="Capacidad (Ton)" sortable style={{ width: '130px' }} />
                        <Column field="color" header="Color" sortable style={{ width: '100px' }} />
                        <Column field="estatus" header="Estatus" body={estatusBodyTemplate} sortable style={{ width: '130px' }} />
                        <Column header="Acciones" body={actionBodyTemplate} style={{ width: '120px' }} exportable={false} />
                    </DataTable>

                    <Dialog visible={camionDialog} style={{ width: '650px' }} header={camion.id ? 'Editar Camión' : 'Nuevo Camión'} modal className="p-fluid" footer={camionDialogFooter} onHide={hideDialog}>
                        <div className="grid">
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="numero_economico">N° Camion <span style={{ color: 'red' }}>*</span></label>
                                    <InputText id="numero_economico" value={camion.numero_economico} onChange={(e) => setCamion({ ...camion, numero_economico: e.target.value })} required autoFocus className={submitted && !camion.numero_economico ? 'p-invalid' : ''} />
                                    {submitted && !camion.numero_economico && <small className="p-error">Requerido</small>}
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="placa">Placa <span style={{ color: 'red' }}>*</span></label>
                                    <InputText id="placa" value={camion.placa} onChange={(e) => setCamion({ ...camion, placa: e.target.value })} required className={submitted && !camion.placa ? 'p-invalid' : ''} />
                                    {submitted && !camion.placa && <small className="p-error">Requerido</small>}
                                </div>
                            </div>
                        </div>

                        <div className="grid">
                            <div className="col-4">
                                <div className="field">
                                    <label htmlFor="tipo">Tipo</label>
                                    <Dropdown id="tipo" value={camion.tipo} options={tipoOptions} onChange={(e) => setCamion({ ...camion, tipo: e.value })} className="w-full" />
                                </div>
                            </div>
                            <div className="col-4">
                                <div className="field">
                                    <label htmlFor="marca">Marca</label>
                                    <InputText id="marca" value={camion.marca || ''} onChange={(e) => setCamion({ ...camion, marca: e.target.value })} />
                                </div>
                            </div>
                            <div className="col-4">
                                <div className="field">
                                    <label htmlFor="modelo">Modelo</label>
                                    <InputText id="modelo" value={camion.modelo || ''} onChange={(e) => setCamion({ ...camion, modelo: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="grid">
                            <div className="col-3">
                                <div className="field">
                                    <label htmlFor="año">Año</label>
                                    <InputNumber id="año" value={camion.año} onValueChange={(e) => setCamion({ ...camion, año: e.value || null })} min={1980} max={new Date().getFullYear() + 1} useGrouping={false} className="w-full" />
                                </div>
                            </div>
                            <div className="col-3">
                                <div className="field">
                                    <label htmlFor="color">Color</label>
                                    <InputText id="color" value={camion.color || ''} onChange={(e) => setCamion({ ...camion, color: e.target.value })} />
                                </div>
                            </div>
                            <div className="col-3">
                                <div className="field">
                                    <label htmlFor="capacidad_toneladas">Capacidad (Ton)</label>
                                    <InputNumber id="capacidad_toneladas" value={camion.capacidad_toneladas} onValueChange={(e) => setCamion({ ...camion, capacidad_toneladas: e.value || null })} min={0} mode="decimal" minFractionDigits={2} maxFractionDigits={2} className="w-full" />
                                </div>
                            </div>
                            <div className="col-3">
                                <div className="field">
                                    <label htmlFor="estatus">Estatus</label>
                                    <Dropdown id="estatus" value={camion.estatus} options={estatusOptions} onChange={(e) => setCamion({ ...camion, estatus: e.value })} className="w-full" />
                                </div>
                            </div>
                        </div>

                        <div className="grid">
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="serie">N° Serie</label>
                                    <InputText id="serie" value={camion.serie || ''} onChange={(e) => setCamion({ ...camion, serie: e.target.value })} />
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="numero_motor">N° Motor</label>
                                    <InputText id="numero_motor" value={camion.numero_motor || ''} onChange={(e) => setCamion({ ...camion, numero_motor: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="grid">
                            <div className="col-4">
                                <div className="field">
                                    <label htmlFor="numero_cilindros">Cilindros</label>
                                    <InputNumber id="numero_cilindros" value={camion.numero_cilindros} onValueChange={(e) => setCamion({ ...camion, numero_cilindros: e.value || null })} min={0} className="w-full" />
                                </div>
                            </div>
                            <div className="col-4">
                                <div className="field">
                                    <label htmlFor="ultimo_servicio">Último Servicio</label>
                                    <Calendar
                                        id="ultimo_servicio"
                                        value={parseLocalDate(camion.ultimo_servicio)}
                                        onChange={(e) => setCamion({ ...camion, ultimo_servicio: e.value ? formatLocalDate(e.value) : null })}
                                        dateFormat="yy-mm-dd"
                                        showIcon
                                        className="w-full"
                                    />
                                </div>
                            </div>
                            <div className="col-4">
                                <div className="field">
                                    <label htmlFor="kilometraje_actual">Kilometraje</label>
                                    <InputNumber id="kilometraje_actual" value={camion.kilometraje_actual} onValueChange={(e) => setCamion({ ...camion, kilometraje_actual: e.value || null })} min={0} className="w-full" />
                                </div>
                            </div>
                        </div>

                        <div className="field">
                            <label htmlFor="observaciones">Observaciones</label>
                            <InputText id="observaciones" value={camion.observaciones || ''} onChange={(e) => setCamion({ ...camion, observaciones: e.target.value })} placeholder="Notas adicionales..." />
                        </div>
                    </Dialog>

                    <Dialog visible={deleteCamionDialog} style={{ width: '450px' }} header="Confirmar Eliminación" modal footer={deleteCamionDialogFooter} onHide={hideDeleteCamionDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            <span>¿Está seguro de eliminar el camión <b>{camion.numero_economico}</b>?</span>
                        </div>
                    </Dialog>

                    <Dialog visible={deleteCamionesDialog} style={{ width: '450px' }} header="Confirmar Eliminación Múltiple" modal footer={deleteCamionesDialogFooter} onHide={hideDeleteCamionesDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            <span>¿Eliminar {selectedCamiones.length} camión(es)?</span>
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default CamionesCrud;