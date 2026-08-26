'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { DataTableFilterMeta } from 'primereact/datatable';
import {
    fetchMaquinarias,
    fetchOperadoresParaMaquinaria,
    createMaquinaria,
    updateMaquinaria,
    deleteMaquinaria,
    Maquinaria
} from '../../../../Services/BD/inventario/maquinaria/maquinariaService';
import { crearBitacoraPorMantenimiento } from '../../../../Services/BD/taller/bitacoraTallerService';
import { getUserNombreFromLocalStorage } from '../../../../Services/BD/userService';
import { ModalDocumentosEquipo } from '../ModalDocumentosEquipo';
import { fetchDocumentosByMaquinaria, subirDocumentoMaquinaria, eliminarDocumentoMaquinaria } from '../../../../Services/BD/inventario/maquinaria/maquinariaDocumentoService';

const estatusOptions = [
    { label: 'Activo', value: 'Activo' },
    { label: 'Mantenimiento', value: 'Mantenimiento' },
    { label: 'Inactivo', value: 'Inactivo' },
    { label: 'Dado de Baja', value: 'Dado de Baja' }
];

const MaquinariaCrud = () => {
    const emptyMaquinaria: Maquinaria = {
        eco: '',
        equipo: '',
        año: null,
        modelo: '',
        no_serie: '',
        ubicacion: '',
        obra: '',
        operador_id: null,
        responsable_id: null,
        estatus: 'Activo'
    };

    const [maquinarias, setMaquinarias] = useState<Maquinaria[]>([]);
    const [operadores, setOperadores] = useState<{ id: number; nombre: string }[]>([]);
    const [maquinariaDialog, setMaquinariaDialog] = useState(false);
    const [deleteMaquinariaDialog, setDeleteMaquinariaDialog] = useState(false);
    const [deleteMaquinariasDialog, setDeleteMaquinariasDialog] = useState(false);
    const [maquinaria, setMaquinaria] = useState<Maquinaria>(emptyMaquinaria);
    const [selectedMaquinarias, setSelectedMaquinarias] = useState<Maquinaria[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const [documentosDialog, setDocumentosDialog] = useState(false);
    const [maquinariaDocumentos, setMaquinariaDocumentos] = useState<Maquinaria | null>(null);
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    const loadMaquinarias = async () => {
        setLoading(true);
        try {
            const data = await fetchMaquinarias();
            setMaquinarias(data);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMaquinarias();
        fetchOperadoresParaMaquinaria().then(setOperadores);
    }, []);

    const openNew = () => {
        setMaquinaria(emptyMaquinaria);
        setSubmitted(false);
        setMaquinariaDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setMaquinariaDialog(false);
    };

    const hideDeleteMaquinariaDialog = () => setDeleteMaquinariaDialog(false);
    const hideDeleteMaquinariasDialog = () => setDeleteMaquinariasDialog(false);

    const saveMaquinaria = async () => {
        setSubmitted(true);

        if (!maquinaria.eco?.trim() || !maquinaria.equipo?.trim()) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'ECO y Equipo son requeridos', life: 3000 });
            return;
        }

        try {
            let guardada: Maquinaria;
            const estatusPrevio = maquinaria.id ? maquinarias.find(m => m.id === maquinaria.id)?.estatus : undefined;

            if (maquinaria.id) {
                guardada = await updateMaquinaria(maquinaria.id, maquinaria);
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Maquinaria actualizada', life: 3000 });
            } else {
                guardada = await createMaquinaria(maquinaria);
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Maquinaria creada', life: 3000 });
            }

            if (guardada.estatus === 'Mantenimiento' && estatusPrevio !== 'Mantenimiento' && guardada.id) {
                await crearBitacoraPorMantenimiento('maquinaria', guardada.id, getUserNombreFromLocalStorage());
                toast.current?.show({ severity: 'info', summary: 'Bitácora creada', detail: 'Se generó una bitácora en Taller para este equipo', life: 4000 });
            }

            setMaquinariaDialog(false);
            setMaquinaria(emptyMaquinaria);
            loadMaquinarias();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const editMaquinaria = (maquinaria: Maquinaria) => {
        setMaquinaria({ ...maquinaria });
        setMaquinariaDialog(true);
    };

    const confirmDeleteMaquinaria = (maquinaria: Maquinaria) => {
        setMaquinaria(maquinaria);
        setDeleteMaquinariaDialog(true);
    };

    const deleteMaquinariaConfirmada = async () => {
        try {
            await deleteMaquinaria(maquinaria.id!);
            setMaquinarias(maquinarias.filter(m => m.id !== maquinaria.id));
            setDeleteMaquinariaDialog(false);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Maquinaria eliminada', life: 3000 });
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const confirmDeleteSelected = () => {
        if (selectedMaquinarias.length === 0) {
            toast.current?.show({ severity: 'warn', summary: 'Advertencia', detail: 'Seleccione al menos una maquinaria', life: 3000 });
            return;
        }
        setDeleteMaquinariasDialog(true);
    };

    const deleteSelectedMaquinarias = async () => {
        try {
            await Promise.all(selectedMaquinarias.map(m => deleteMaquinaria(m.id!)));
            setMaquinarias(maquinarias.filter(m => !selectedMaquinarias.includes(m)));
            setDeleteMaquinariasDialog(false);
            setSelectedMaquinarias([]);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Maquinarias eliminadas', life: 3000 });
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const exportCSV = () => dt.current?.exportCSV();

    const textBodyTemplate = (value: string | null | undefined) => (
        <span>{value && value.toString().trim() !== '' ? value : '-'}</span>
    );

    const añoBodyTemplate = (rowData: Maquinaria) => (
        <span>{rowData.año ? rowData.año : '-'}</span>
    );

    const estatusBodyTemplate = (rowData: Maquinaria) => {
        let severity: 'success' | 'warning' | 'danger' | 'info' = 'success';
        if (rowData.estatus === 'Mantenimiento') severity = 'warning';
        if (rowData.estatus === 'Inactivo') severity = 'info';
        if (rowData.estatus === 'Dado de Baja') severity = 'danger';
        return <Tag severity={severity} value={rowData.estatus} />;
    };

    const actionBodyTemplate = (rowData: Maquinaria) => (
        <div className="flex gap-2">
            <Button icon="pi pi-pencil" rounded severity="info" onClick={() => editMaquinaria(rowData)} tooltip="Editar" />
            <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteMaquinaria(rowData)} tooltip="Eliminar" />
        </div>
    );

    const documentosBodyTemplate = (rowData: Maquinaria) => (
        <Button
            icon="pi pi-file-pdf"
            rounded
            text
            severity="info"
            tooltip="Ver Documentos"
            onClick={() => {
                setMaquinariaDocumentos(rowData);
                setDocumentosDialog(true);
            }}
        />
    );

    const leftToolbarTemplate = () => (
        <div className="my-2 flex gap-2">
            <Button label="Nueva Maquinaria" icon="pi pi-plus" severity="info" onClick={openNew} />
            <Button label="Eliminar" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} disabled={!selectedMaquinarias || selectedMaquinarias.length === 0} />
        </div>
    );

    const rightToolbarTemplate = () => (
        <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={exportCSV} />
    );

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Maquinaria</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })} placeholder="Buscar..." />
            </span>
        </div>
    );

    const maquinariaDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveMaquinaria} />
        </>
    );

    const deleteMaquinariaDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteMaquinariaDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteMaquinariaConfirmada} />
        </>
    );

    const deleteMaquinariasDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteMaquinariasDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteSelectedMaquinarias} />
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
                        value={maquinarias}
                        selection={selectedMaquinarias}
                        onSelectionChange={(e) => setSelectedMaquinarias(e.value || [])}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        loading={loading}
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No se encontraron maquinarias"
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} exportable={false} />
                        <Column field="id" header="ID" sortable style={{ width: '80px' }} />
                        <Column field="eco" header="ECO" sortable style={{ width: '100px' }} />
                        <Column field="equipo" header="Equipo" sortable style={{ width: '150px' }} />
                        <Column field="año" header="Año" body={añoBodyTemplate} sortable style={{ width: '80px' }} />
                        <Column field="modelo" header="Modelo" body={(r) => textBodyTemplate(r.modelo)} sortable style={{ width: '120px' }} />
                        <Column field="no_serie" header="No. Serie" body={(r) => textBodyTemplate(r.no_serie)} sortable style={{ width: '130px' }} />
                        <Column field="ubicacion" header="Ubicación" body={(r) => textBodyTemplate(r.ubicacion)} sortable style={{ width: '130px' }} />
                        <Column field="obra" header="Obra" body={(r) => textBodyTemplate(r.obra)} sortable style={{ width: '130px' }} />
                        <Column field="operador_nombre" header="Operador" body={(r) => textBodyTemplate(r.operador_nombre)} sortable style={{ width: '130px' }} />
                        <Column field="responsable_nombre" header="Responsable" body={(r) => textBodyTemplate(r.responsable_nombre)} sortable style={{ width: '130px' }} />
                        <Column field="estatus" header="Estatus" body={estatusBodyTemplate} sortable style={{ width: '130px' }} />
                        <Column header="Documentos" body={documentosBodyTemplate} style={{ width: '100px' }} exportable={false} />
                        <Column header="Acciones" body={actionBodyTemplate} style={{ width: '120px' }} exportable={false} />
                    </DataTable>

                    <Dialog visible={maquinariaDialog} style={{ width: '650px' }} header={maquinaria.id ? 'Editar Maquinaria' : 'Nueva Maquinaria'} modal className="p-fluid" footer={maquinariaDialogFooter} onHide={hideDialog}>
                        <div className="grid">
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="eco">ECO <span style={{ color: 'red' }}>*</span></label>
                                    <InputText id="eco" value={maquinaria.eco} onChange={(e) => setMaquinaria({ ...maquinaria, eco: e.target.value })} required autoFocus className={submitted && !maquinaria.eco ? 'p-invalid' : ''} />
                                    {submitted && !maquinaria.eco && <small className="p-error">Requerido</small>}
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="equipo">Equipo <span style={{ color: 'red' }}>*</span></label>
                                    <InputText id="equipo" value={maquinaria.equipo} onChange={(e) => setMaquinaria({ ...maquinaria, equipo: e.target.value })} required className={submitted && !maquinaria.equipo ? 'p-invalid' : ''} />
                                    {submitted && !maquinaria.equipo && <small className="p-error">Requerido</small>}
                                </div>
                            </div>
                        </div>

                        <div className="grid">
                            <div className="col-4">
                                <div className="field">
                                    <label htmlFor="año">Año</label>
                                    <InputNumber id="año" value={maquinaria.año} onValueChange={(e) => setMaquinaria({ ...maquinaria, año: e.value || null })} min={1980} max={new Date().getFullYear() + 1} useGrouping={false} className="w-full" />
                                </div>
                            </div>
                            <div className="col-4">
                                <div className="field">
                                    <label htmlFor="modelo">Modelo</label>
                                    <InputText id="modelo" value={maquinaria.modelo || ''} onChange={(e) => setMaquinaria({ ...maquinaria, modelo: e.target.value })} />
                                </div>
                            </div>
                            <div className="col-4">
                                <div className="field">
                                    <label htmlFor="no_serie">No. Serie</label>
                                    <InputText id="no_serie" value={maquinaria.no_serie || ''} onChange={(e) => setMaquinaria({ ...maquinaria, no_serie: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="grid">
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="ubicacion">Ubicación</label>
                                    <InputText id="ubicacion" value={maquinaria.ubicacion || ''} onChange={(e) => setMaquinaria({ ...maquinaria, ubicacion: e.target.value })} />
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="obra">Obra</label>
                                    <InputText id="obra" value={maquinaria.obra || ''} onChange={(e) => setMaquinaria({ ...maquinaria, obra: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="grid">
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="operador_id">Operador</label>
                                    <Dropdown
                                        id="operador_id"
                                        value={maquinaria.operador_id}
                                        options={operadores.map(o => ({ label: o.nombre, value: o.id }))}
                                        onChange={(e) => setMaquinaria({ ...maquinaria, operador_id: e.value })}
                                        placeholder="Selecciona un operador"
                                        showClear
                                        filter
                                        className="w-full"
                                    />
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="responsable_id">Responsable</label>
                                    <Dropdown
                                        id="responsable_id"
                                        value={maquinaria.responsable_id}
                                        options={operadores.map(o => ({ label: o.nombre, value: o.id }))}
                                        onChange={(e) => setMaquinaria({ ...maquinaria, responsable_id: e.value })}
                                        placeholder="Selecciona un responsable"
                                        showClear
                                        filter
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid">
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="estatus">Estatus</label>
                                    <Dropdown id="estatus" value={maquinaria.estatus} options={estatusOptions} onChange={(e) => setMaquinaria({ ...maquinaria, estatus: e.value })} className="w-full" />
                                    {maquinaria.estatus === 'Mantenimiento' && (
                                        <small className="text-500">Al guardar se generará (o reutilizará) una bitácora en Taller.</small>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Dialog>

                    <Dialog visible={deleteMaquinariaDialog} style={{ width: '450px' }} header="Confirmar Eliminación" modal footer={deleteMaquinariaDialogFooter} onHide={hideDeleteMaquinariaDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            <span>¿Está seguro de eliminar la maquinaria <b>{maquinaria.equipo}</b>?</span>
                        </div>
                    </Dialog>

                    <Dialog visible={deleteMaquinariasDialog} style={{ width: '450px' }} header="Confirmar Eliminación Múltiple" modal footer={deleteMaquinariasDialogFooter} onHide={hideDeleteMaquinariasDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            <span>¿Eliminar {selectedMaquinarias.length} maquinaria(s)?</span>
                        </div>
                    </Dialog>

                    <ModalDocumentosEquipo
                        visible={documentosDialog}
                        onHide={() => setDocumentosDialog(false)}
                        entidadId={maquinariaDocumentos?.id ?? null}
                        titulo={`Documentos de ${maquinariaDocumentos?.equipo || ''}`}
                        fetchDocumentos={fetchDocumentosByMaquinaria}
                        subirDocumento={subirDocumentoMaquinaria}
                        eliminarDocumento={eliminarDocumentoMaquinaria}
                    />
                </div>
            </div>
        </div>
    );
};

export default MaquinariaCrud;
