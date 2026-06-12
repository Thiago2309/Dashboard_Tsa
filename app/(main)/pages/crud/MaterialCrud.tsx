'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { DataTableFilterMeta } from 'primereact/datatable';
import React, { useEffect, useRef, useState } from 'react';
import {
    fetchMateriales,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    Material,
} from '../../../../Services/BD/materialService';

const MaterialCrud = () => {
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [materialDialog, setMaterialDialog] = useState(false);
    const [deleteMaterialDialog, setDeleteMaterialDialog] = useState(false);
    const [deleteMaterialesDialog, setDeleteMaterialesDialog] = useState(false);
    const [material, setMaterial] = useState<Material>({ nombre: '', descripcion: '' });
    const [selectedMateriales, setSelectedMateriales] = useState<Material[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
                global: { value: null, matchMode: 'contains' as const }
            });
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    // Cargar materiales al iniciar
    useEffect(() => {
        loadMateriales();
    }, []);

    const loadMateriales = async () => {
        try {
            const data = await fetchMateriales();
            setMateriales(data);
        } catch (error) {
            showToast('error', 'Error', 'Error al cargar los materiales');
        }
    };

    const showToast = (severity: 'success' | 'error' | 'warn', summary: string, detail: string) => {
        toast.current?.show({ severity, summary, detail, life: 3000 });
    };

    const openNew = () => {
        setMaterial({ nombre: '', descripcion: '' });
        setSubmitted(false);
        setMaterialDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setMaterialDialog(false);
    };

    const hideDeleteMaterialDialog = () => setDeleteMaterialDialog(false);
    const hideDeleteMaterialesDialog = () => setDeleteMaterialesDialog(false);

    // Guardar o actualizar material
    const saveMaterial = async () => {
        setSubmitted(true);

        if (!material.nombre.trim()) {
            showToast('error', 'Error', 'El nombre es requerido');
            return;
        }

        try {
            if (material.id) {
                // Editar
                const updatedMaterial = await updateMaterial(material);
                setMateriales(materiales.map((m) => (m.id === updatedMaterial.id ? updatedMaterial : m)));
                showToast('success', 'Éxito', 'Material actualizado correctamente');
            } else {
                // Crear nuevo
                const newMaterial = await createMaterial({
                    nombre: material.nombre,
                    descripcion: material.descripcion,
                });
                setMateriales((prev) => [newMaterial, ...prev]);
                showToast('success', 'Éxito', 'Material creado correctamente');
            }
            setMaterialDialog(false);
            setMaterial({ nombre: '', descripcion: '' });
        } catch (error) {
            console.error('Error al guardar material:', error);
            showToast('error', 'Error', 'Error al guardar el material');
        }
    };

    const editMaterial = (mat: Material) => {
        setMaterial({ ...mat });
        setMaterialDialog(true);
    };

    const confirmDeleteMaterial = (mat: Material) => {
        setMaterial(mat);
        setDeleteMaterialDialog(true);
    };

    const confirmDeleteSelected = () => {
        if (selectedMateriales.length === 0) {
            showToast('warn', 'Advertencia', 'Seleccione al menos un material');
            return;
        }
        setDeleteMaterialesDialog(true);
    };

    const deleteMaterialConfirmado = async () => {
        try {
            await deleteMaterial(material.id!);
            setMateriales(materiales.filter((m) => m.id !== material.id));
            setDeleteMaterialDialog(false);
            showToast('success', 'Éxito', 'Material eliminado correctamente');
        } catch (error) {
            console.error('Error al eliminar material:', error);
            showToast('error', 'Error', 'Error al eliminar el material');
        }
    };

    const deleteSelectedMateriales = async () => {
        try {
            await Promise.all(selectedMateriales.map((m) => deleteMaterial(m.id!)));
            setMateriales(materiales.filter((m) => !selectedMateriales.includes(m)));
            setDeleteMaterialesDialog(false);
            setSelectedMateriales([]);
            showToast('success', 'Éxito', 'Materiales eliminados correctamente');
        } catch (error) {
            console.error('Error al eliminar materiales:', error);
            showToast('error', 'Error', 'Error al eliminar los materiales');
        }
    };

    const exportCSV = () => dt.current?.exportCSV();

    // Templates para columnas
    const nombreBodyTemplate = (rowData: Material) => <span>{rowData.nombre}</span>;
    const descripcionBodyTemplate = (rowData: Material) => <span>{rowData.descripcion || '-'}</span>;
    const fechaBodyTemplate = (rowData: Material) => {
        if (!rowData.created_at) return '-';
        const fecha = new Date(rowData.created_at);
        return <span>{fecha.toLocaleDateString('es-ES')}</span>;
    };

    const actionBodyTemplate = (rowData: Material) => (
        <div className="flex gap-2">
            <Button
                icon="pi pi-pencil"
                rounded
                severity="info"
                onClick={() => editMaterial(rowData)}
                tooltip="Editar"
            />
            <Button
                icon="pi pi-trash"
                rounded
                severity="danger"
                onClick={() => confirmDeleteMaterial(rowData)}
                tooltip="Eliminar"
            />
        </div>
    );

    // Toolbars
    const leftToolbarTemplate = () => (
        <div className="my-2 flex gap-2">
            <Button label="Nuevo" icon="pi pi-plus" severity="info" onClick={openNew} />
            <Button
                label="Eliminar"
                icon="pi pi-trash"
                severity="danger"
                onClick={confirmDeleteSelected}
                disabled={!selectedMateriales || selectedMateriales.length === 0}
            />
        </div>
    );

    const rightToolbarTemplate = () => (
        <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={exportCSV} />
    );

    // Header tabla
    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Materiales</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText
                    type="search"
                    onInput={(e) =>
                        setFilters({
                            ...filters,
                            global: { value: e.currentTarget.value, matchMode: 'contains' }
                        })
                    }
                    placeholder="Buscar..."
                />
            </span>
        </div>
    );

    const materialDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveMaterial} />
        </>
    );

    const deleteMaterialDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteMaterialDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteMaterialConfirmado} />
        </>
    );

    const deleteMaterialesDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteMaterialesDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteSelectedMateriales} />
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
                        value={materiales}
                        selection={selectedMateriales}
                        onSelectionChange={(e) => setSelectedMateriales(e.value || [])}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} materiales"
                        filters={filters} // PARA EL DE BUSQUEDA
                        filterDisplay="menu"
                        emptyMessage="No se encontraron materiales"
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} exportable={false} />
                        <Column field="nombre" header="Nombre" sortable body={nombreBodyTemplate} />
                        <Column field="descripcion" header="Descripción" body={descripcionBodyTemplate} />
                        <Column field="created_at" header="Fecha de Registro" sortable body={fechaBodyTemplate} />
                        <Column
                            header="Acciones"
                            body={actionBodyTemplate}
                            headerStyle={{ minWidth: '10rem' }}
                            exportable={false}
                        />
                    </DataTable>

                    {/* Diálogo Crear / Editar */}
                    <Dialog
                        visible={materialDialog}
                        style={{ width: '500px' }}
                        header={material.id ? 'Editar Material' : 'Nuevo Material'}
                        modal
                        className="p-fluid"
                        footer={materialDialogFooter}
                        onHide={hideDialog}
                    >
                        <div className="field">
                            <label htmlFor="nombre">Nombre del material</label>
                            <InputText
                                id="nombre"
                                value={material.nombre}
                                onChange={(e) => setMaterial({ ...material, nombre: e.target.value })}
                                required
                                autoFocus
                                className={submitted && !material.nombre ? 'p-invalid' : ''}
                                placeholder="Ingrese el nombre del material"
                            />
                            {submitted && !material.nombre && (
                                <small className="p-error">El nombre es requerido.</small>
                            )}
                        </div>

                        <div className="field">
                            <label htmlFor="descripcion">Descripción</label>
                            <InputText
                                id="descripcion"
                                value={material.descripcion || ''}
                                onChange={(e) => setMaterial({ ...material, descripcion: e.target.value })}
                                placeholder="Ingrese la descripción (opcional)"
                            />
                        </div>
                    </Dialog>

                    {/* Confirmar eliminación individual */}
                    <Dialog
                        visible={deleteMaterialDialog}
                        style={{ width: '450px' }}
                        header="Confirmar Eliminación"
                        modal
                        footer={deleteMaterialDialogFooter}
                        onHide={hideDeleteMaterialDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            {material && (
                                <span>
                                    ¿Está seguro de eliminar el material <b>{material.nombre}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    {/* Confirmar eliminación múltiple */}
                    <Dialog
                        visible={deleteMaterialesDialog}
                        style={{ width: '450px' }}
                        header="Confirmar Eliminación Múltiple"
                        modal
                        footer={deleteMaterialesDialogFooter}
                        onHide={hideDeleteMaterialesDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            <span>
                                ¿Está seguro de eliminar los {selectedMateriales.length} materiales seleccionados?
                            </span>
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default MaterialCrud;
