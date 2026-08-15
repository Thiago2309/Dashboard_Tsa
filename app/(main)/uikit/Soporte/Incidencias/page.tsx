// app/(main)/uikit/Soporte/Incidencias/page.tsx
'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import React, { useEffect, useRef, useState } from 'react';
import {
    createIncidencia,
    deleteIncidencia,
    fetchIncidencias,
    getUsuarioIdFromLocalStorage,
    updateEstatusIncidencia,
    Incidencia
} from '../../../../../Services/BD/incidenciasService';

const IncidenciasPage = () => {
    const emptyIncidencia = { titulo: '', nota: '' };

    const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
    const [incidenciaDialog, setIncidenciaDialog] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [nuevaIncidencia, setNuevaIncidencia] = useState(emptyIncidencia);
    const [incidenciaSeleccionada, setIncidenciaSeleccionada] = useState<Incidencia | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);

    useEffect(() => {
        cargarIncidencias();
    }, []);

    const cargarIncidencias = async () => {
        setLoading(true);
        try {
            const data = await fetchIncidencias();
            setIncidencias(data);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar las incidencias', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    const openNew = () => {
        setNuevaIncidencia(emptyIncidencia);
        setSubmitted(false);
        setIncidenciaDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setIncidenciaDialog(false);
    };

    const guardarIncidencia = async () => {
        setSubmitted(true);

        if (!nuevaIncidencia.titulo.trim()) {
            return;
        }

        try {
            setLoading(true);
            const idUsuario = getUsuarioIdFromLocalStorage();
            await createIncidencia({
                titulo: nuevaIncidencia.titulo,
                nota: nuevaIncidencia.nota,
                id_usuario_reporta: idUsuario
            });
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Incidencia reportada correctamente', life: 3000 });
            setIncidenciaDialog(false);
            cargarIncidencias();
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al reportar la incidencia', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    const cambiarEstatus = async (incidencia: Incidencia) => {
        const nuevoEstatus = incidencia.estatus === 'pendiente' ? 'completado' : 'pendiente';
        try {
            setLoading(true);
            await updateEstatusIncidencia(incidencia.id!, nuevoEstatus);
            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: `Incidencia marcada como ${nuevoEstatus}`,
                life: 3000
            });
            cargarIncidencias();
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al actualizar el estatus', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    const confirmarEliminar = (incidencia: Incidencia) => {
        setIncidenciaSeleccionada(incidencia);
        setDeleteDialog(true);
    };

    const eliminarIncidencia = async () => {
        if (!incidenciaSeleccionada) return;
        try {
            setLoading(true);
            await deleteIncidencia(incidenciaSeleccionada.id!);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Incidencia eliminada correctamente', life: 3000 });
            setDeleteDialog(false);
            cargarIncidencias();
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar la incidencia', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    const folioBodyTemplate = (rowData: Incidencia) => <span className="font-bold">{rowData.folio}</span>;

    const fechaBodyTemplate = (rowData: Incidencia) => {
        if (!rowData.created_at) return '-';
        const fecha = new Date(rowData.created_at);
        return `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
    };

    const reportadoPorBodyTemplate = (rowData: Incidencia) => {
        if (!rowData.usuario_nombre) return '-';
        return `${rowData.usuario_nombre} ${rowData.usuario_apellido || ''}`.trim();
    };

    const estatusBodyTemplate = (rowData: Incidencia) => (
        <Tag value={rowData.estatus === 'pendiente' ? 'Pendiente' : 'Completado'} severity={rowData.estatus === 'pendiente' ? 'warning' : 'success'} />
    );

    const actionBodyTemplate = (rowData: Incidencia) => (
        <div className="flex gap-1">
            <Button
                icon={rowData.estatus === 'pendiente' ? 'pi pi-check' : 'pi pi-undo'}
                rounded
                severity={rowData.estatus === 'pendiente' ? 'success' : 'warning'}
                size="small"
                tooltip={rowData.estatus === 'pendiente' ? 'Marcar como completado' : 'Marcar como pendiente'}
                onClick={() => cambiarEstatus(rowData)}
            />
            <Button icon="pi pi-trash" rounded severity="danger" size="small" tooltip="Eliminar" onClick={() => confirmarEliminar(rowData)} />
        </div>
    );

    const leftToolbarTemplate = () => (
        <div className="my-2">
            <Button label="Reportar Incidencia" icon="pi pi-plus" severity="danger" className="mr-2" onClick={openNew} />
            <Button label="Recargar" icon="pi pi-refresh" severity="secondary" onClick={cargarIncidencias} loading={loading} />
        </div>
    );

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} />

                    <DataTable
                        value={incidencias}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        className="datatable-responsive"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} incidencias"
                        emptyMessage="No se encontraron incidencias."
                        responsiveLayout="scroll"
                        loading={loading}
                    >
                        <Column field="folio" header="Folio" sortable body={folioBodyTemplate} />
                        <Column field="titulo" header="Título" sortable />
                        <Column field="nota" header="Nota" />
                        <Column field="created_at" header="Fecha" sortable body={fechaBodyTemplate} />
                        <Column header="Reportado por" body={reportadoPorBodyTemplate} />
                        <Column field="estatus" header="Estatus" sortable body={estatusBodyTemplate} />
                        <Column header="Acciones" body={actionBodyTemplate} headerStyle={{ minWidth: '8rem' }} />
                    </DataTable>

                    {/* Dialog para reportar incidencia */}
                    <Dialog
                        visible={incidenciaDialog}
                        style={{ width: '500px' }}
                        header="Reportar Incidencia"
                        modal
                        className="p-fluid"
                        footer={
                            <>
                                <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
                                <Button label="Guardar" icon="pi pi-check" text onClick={guardarIncidencia} loading={loading} />
                            </>
                        }
                        onHide={hideDialog}
                    >
                        <div className="field">
                            <label htmlFor="titulo">Título *</label>
                            <InputText
                                id="titulo"
                                value={nuevaIncidencia.titulo}
                                onChange={(e) => setNuevaIncidencia({ ...nuevaIncidencia, titulo: e.target.value })}
                                required
                                autoFocus
                                className={submitted && !nuevaIncidencia.titulo.trim() ? 'p-invalid' : ''}
                            />
                            {submitted && !nuevaIncidencia.titulo.trim() && <small className="p-error">El título es requerido</small>}
                        </div>

                        <div className="field">
                            <label htmlFor="nota">Nota</label>
                            <InputTextarea
                                id="nota"
                                value={nuevaIncidencia.nota}
                                onChange={(e) => setNuevaIncidencia({ ...nuevaIncidencia, nota: e.target.value })}
                                rows={5}
                            />
                        </div>
                    </Dialog>

                    {/* Dialog de confirmación para eliminar */}
                    <Dialog
                        visible={deleteDialog}
                        style={{ width: '450px' }}
                        header="Confirmar Eliminación"
                        modal
                        footer={
                            <>
                                <Button label="No" icon="pi pi-times" text onClick={() => setDeleteDialog(false)} />
                                <Button label="Sí" icon="pi pi-check" text onClick={eliminarIncidencia} loading={loading} />
                            </>
                        }
                        onHide={() => setDeleteDialog(false)}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: 'var(--orange-500)' }} />
                            <span>
                                ¿Estás seguro de eliminar la incidencia <b>{incidenciaSeleccionada?.folio}</b>?
                            </span>
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default IncidenciasPage;
