        'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { DataTableFilterMeta } from 'primereact/datatable';
import { InputNumber } from 'primereact/inputnumber';
import { Checkbox } from 'primereact/checkbox';
import React, { useEffect, useRef, useState } from 'react';
import {
    fetchM3List,
    createM3,
    updateM3,
    deleteM3,
    M3,
} from '../../../../Services/BD/M3Service';

const M3Crud = () => {
    const [m3List, setM3List] = useState<M3[]>([]);
    const [m3Dialog, setM3Dialog] = useState(false);
    const [deleteM3Dialog, setDeleteM3Dialog] = useState(false);
    const [deleteM3sDialog, setDeleteM3sDialog] = useState(false);
    const [m3, setM3] = useState<M3>({ 
        nombre: '', 
        metros_cubicos: 0,
        descripcion: '',
        status: true        
    });
    const [selectedM3s, setSelectedM3s] = useState<M3[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    // Cargar registros al iniciar
    useEffect(() => {
        loadM3List();
    }, []);

    const loadM3List = async () => {
        try {
            const data = await fetchM3List();
            setM3List(data);
        } catch (error) {
            showToast('error', 'Error', 'Error al cargar los metros cúbicos');
        }
    };

    const showToast = (severity: 'success' | 'error' | 'warn', summary: string, detail: string) => {
        toast.current?.show({ severity, summary, detail, life: 3000 });
    };

    const openNew = () => {
        setM3({ 
            nombre: '', 
            metros_cubicos: 0,
            descripcion: '',
            status: true 
        });
        setSubmitted(false);
        setM3Dialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setM3Dialog(false);
    };

    const hideDeleteM3Dialog = () => setDeleteM3Dialog(false);
    const hideDeleteM3sDialog = () => setDeleteM3sDialog(false);

    // Guardar o actualizar
    const saveM3 = async () => {
        setSubmitted(true);

        if (!m3.nombre.trim()) {
            showToast('error', 'Error', 'El nombre es requerido');
            return;
        }

        if (!m3.metros_cubicos || m3.metros_cubicos <= 0) {
            showToast('error', 'Error', 'Los metros cúbicos deben ser mayor a 0');
            return;
        }

        try {
            if (m3.id) {
                // Editar
                const updatedM3 = await updateM3(m3);
                setM3List(m3List.map((m) => (m.id === updatedM3.id ? updatedM3 : m)));
                showToast('success', 'Éxito', 'Registro actualizado correctamente');
            } else {
                // Crear nuevo
                const newM3 = await createM3({
                    nombre: m3.nombre,
                    metros_cubicos: m3.metros_cubicos,
                    descripcion: m3.descripcion,
                    status: m3.status !== undefined ? m3.status : true,
                });
                setM3List((prev) => [newM3, ...prev]);
                showToast('success', 'Éxito', 'Registro creado correctamente');
            }
            setM3Dialog(false);
            setM3({ 
                nombre: '', 
                metros_cubicos: 0,
                descripcion: '',
                status: true 
            });
        } catch (error) {
            console.error('Error al guardar:', error);
            showToast('error', 'Error', 'Error al guardar el registro');
        }
    };

    const editM3 = (item: M3) => {
        setM3({ ...item });
        setM3Dialog(true);
    };

    const confirmDeleteM3 = (item: M3) => {
        setM3(item);
        setDeleteM3Dialog(true);
    };

    const confirmDeleteSelected = () => {
        if (selectedM3s.length === 0) {
            showToast('warn', 'Advertencia', 'Seleccione al menos un registro');
            return;
        }
        setDeleteM3sDialog(true);
    };

    const deleteM3Confirmado = async () => {
        try {
            await deleteM3(m3.id!);
            setM3List(m3List.filter((m) => m.id !== m3.id));
            setDeleteM3Dialog(false);
            showToast('success', 'Éxito', 'Registro eliminado correctamente');
        } catch (error) {
            console.error('Error al eliminar:', error);
            showToast('error', 'Error', 'Error al eliminar el registro');
        }
    };

    const deleteSelectedM3s = async () => {
        try {
            await Promise.all(selectedM3s.map((m) => deleteM3(m.id!)));
            setM3List(m3List.filter((m) => !selectedM3s.includes(m)));
            setDeleteM3sDialog(false);
            setSelectedM3s([]);
            showToast('success', 'Éxito', 'Registros eliminados correctamente');
        } catch (error) {
            console.error('Error al eliminar registros:', error);
            showToast('error', 'Error', 'Error al eliminar los registros');
        }
    };

    const exportCSV = () => dt.current?.exportCSV();

    // Templates para columnas
    const nombreBodyTemplate = (rowData: M3) => <span>{rowData.nombre}</span>;
    const metrosCubicosBodyTemplate = (rowData: M3) => (
        <span>{rowData.metros_cubicos?.toLocaleString('es-MX')} m³</span>
    );
    const descripcionBodyTemplate = (rowData: M3) => <span>{rowData.descripcion || '-'}</span>;
    const statusBodyTemplate = (rowData: M3) => (
        <span className={`p-tag ${rowData.status ? 'p-tag-success' : 'p-tag-danger'}`}>
            {rowData.status ? 'Activo' : 'Inactivo'}
        </span>
    );
    const fechaBodyTemplate = (rowData: M3) => {
        if (!rowData.created_at) return '-';
        const fecha = new Date(rowData.created_at);
        return <span>{fecha.toLocaleDateString('es-ES')}</span>;
    };

    const actionBodyTemplate = (rowData: M3) => (
        <div className="flex gap-2">
            <Button
                icon="pi pi-pencil"
                rounded
                severity="info"
                onClick={() => editM3(rowData)}
                tooltip="Editar"
            />
            <Button
                icon="pi pi-trash"
                rounded
                severity="danger"
                onClick={() => confirmDeleteM3(rowData)}
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
                disabled={!selectedM3s || selectedM3s.length === 0}
            />
        </div>
    );

    const rightToolbarTemplate = () => (
        <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={exportCSV} />
    );

    // Header tabla
    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Metros Cúbicos (m³)</h5>
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

    const m3DialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveM3} />
        </>
    );

    const deleteM3DialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteM3Dialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteM3Confirmado} />
        </>
    );

    const deleteM3sDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteM3sDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteSelectedM3s} />
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
                        value={m3List}
                        selection={selectedM3s}
                        onSelectionChange={(e) => setSelectedM3s(e.value || [])}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No se encontraron registros"
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} exportable={false} />
                        <Column field="nombre" header="Nombre" sortable body={nombreBodyTemplate} />
                        <Column field="metros_cubicos" header="Metros Cúbicos" sortable body={metrosCubicosBodyTemplate} />
                        <Column field="descripcion" header="Descripción" body={descripcionBodyTemplate} />
                        <Column field="status" header="Estatus" sortable body={statusBodyTemplate} />
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
                        visible={m3Dialog}
                        style={{ width: '500px' }}
                        header={m3.id ? 'Editar Metros Cúbicos' : 'Nuevo Metros Cúbicos'}
                        modal
                        className="p-fluid"
                        footer={m3DialogFooter}
                        onHide={hideDialog}
                    >
                        <div className="field">
                            <label htmlFor="nombre">Nombre</label>
                            <InputText
                                id="nombre"
                                value={m3.nombre}
                                onChange={(e) => setM3({ ...m3, nombre: e.target.value })}
                                required
                                autoFocus
                                className={submitted && !m3.nombre ? 'p-invalid' : ''}
                                placeholder="Ej: Camión pequeño, Volquete, etc."
                            />
                            {submitted && !m3.nombre && (
                                <small className="p-error">El nombre es requerido.</small>
                            )}
                        </div>

                        <div className="field">
                            <label htmlFor="metros_cubicos">Metros Cúbicos (m³)</label>
                            <InputNumber
                                id="metros_cubicos"
                                value={m3.metros_cubicos}
                                onValueChange={(e) => setM3({ ...m3, metros_cubicos: e.value || 0 })}
                                mode="decimal"
                                min={0}
                                minFractionDigits={2}
                                maxFractionDigits={2}
                                placeholder="0.00"
                                required
                                className={submitted && (!m3.metros_cubicos || m3.metros_cubicos <= 0) ? 'p-invalid' : ''}
                            />
                            {submitted && (!m3.metros_cubicos || m3.metros_cubicos <= 0) && (
                                <small className="p-error">Los metros cúbicos son requeridos y deben ser mayor a 0.</small>
                            )}
                        </div>

                        <div className="field">
                            <label htmlFor="descripcion">Descripción</label>
                            <InputText
                                id="descripcion"
                                value={m3.descripcion || ''}
                                onChange={(e) => setM3({ ...m3, descripcion: e.target.value })}
                                placeholder="Descripción opcional"
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="status" className="flex align-items-center">
                                <Checkbox
                                    id="status"
                                    checked={m3.status ?? false}
                                    onChange={(e) => setM3({ ...m3, status: e.checked ?? false })}
                                />
                                <span className="ml-2">Activo</span>
                            </label>
                        </div>
                    </Dialog>

                    {/* Confirmar eliminación individual */}
                    <Dialog
                        visible={deleteM3Dialog}
                        style={{ width: '450px' }}
                        header="Confirmar Eliminación"
                        modal
                        footer={deleteM3DialogFooter}
                        onHide={hideDeleteM3Dialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            {m3 && (
                                <span>
                                    ¿Está seguro de eliminar el registro <b>{m3.nombre}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    {/* Confirmar eliminación múltiple */}
                    <Dialog
                        visible={deleteM3sDialog}
                        style={{ width: '450px' }}
                        header="Confirmar Eliminación Múltiple"
                        modal
                        footer={deleteM3sDialogFooter}
                        onHide={hideDeleteM3sDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            <span>
                                ¿Está seguro de eliminar los {selectedM3s.length} registros seleccionados?
                            </span>
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default M3Crud;