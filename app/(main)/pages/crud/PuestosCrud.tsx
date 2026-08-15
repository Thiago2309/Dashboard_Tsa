'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { ToggleButton } from 'primereact/togglebutton';
import { DataTableFilterMeta } from 'primereact/datatable';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    fetchPuestos,
    createPuesto,
    updatePuesto,
    deletePuesto,
    fetchEmpleadosPorPuesto,
    Puesto,
    EmpleadoResumenPuesto
} from '../../../../Services/BD/puestoService';

const PuestosCrud = () => {
    const [puestos, setPuestos] = useState<Puesto[]>([]);
    const [puestoDialog, setPuestoDialog] = useState(false);
    const [deletePuestoDialog, setDeletePuestoDialog] = useState(false);
    const [empleadosDialog, setEmpleadosDialog] = useState(false);
    const [empleadosPuestoActual, setEmpleadosPuestoActual] = useState<{ nombre: string; empleados: EmpleadoResumenPuesto[] }>({ nombre: '', empleados: [] });
    const [puesto, setPuesto] = useState<Puesto>({ nombre: '', estatus: true });
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    const cargarDatos = useCallback(async () => {
        try {
            const puestosData = await fetchPuestos();
            setPuestos(puestosData);
        } catch (error) {
            console.error('Error cargando datos:', error);
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar los datos', life: 3000 });
        }
    }, []);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    const openNew = useCallback(() => {
        setPuesto({ nombre: '', estatus: true });
        setSubmitted(false);
        setPuestoDialog(true);
    }, []);

    const hideDialog = useCallback(() => {
        setSubmitted(false);
        setPuestoDialog(false);
    }, []);

    const hideDeletePuestoDialog = useCallback(() => setDeletePuestoDialog(false), []);

    const savePuesto = useCallback(async () => {
        setSubmitted(true);

        if (!puesto.nombre.trim()) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'El nombre del puesto es requerido', life: 3000 });
            return;
        }

        try {
            setLoading(true);
            if (puesto.id) {
                await updatePuesto(puesto);
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Puesto actualizado correctamente', life: 3000 });
            } else {
                await createPuesto(puesto.nombre.trim());
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Puesto creado correctamente', life: 3000 });
            }
            setPuestoDialog(false);
            const puestosActualizados = await fetchPuestos();
            setPuestos(puestosActualizados);
        } catch (error: any) {
            console.error('Error:', error);
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message || 'Error al guardar el puesto', life: 3000 });
        } finally {
            setLoading(false);
        }
    }, [puesto]);

    const editPuesto = useCallback((p: Puesto) => {
        setPuesto({ ...p });
        setPuestoDialog(true);
    }, []);

    const confirmDeletePuesto = useCallback((p: Puesto) => {
        setPuesto(p);
        setDeletePuestoDialog(true);
    }, []);

    const deletePuestoConfirmado = useCallback(async () => {
        try {
            await deletePuesto(puesto.id!);
            setDeletePuestoDialog(false);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Puesto eliminado', life: 3000 });
            const puestosActualizados = await fetchPuestos();
            setPuestos(puestosActualizados);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar. Verifica que no tenga empleados asignados.', life: 4000 });
        }
    }, [puesto]);

    const verEmpleadosPuesto = useCallback(async (p: Puesto) => {
        try {
            const empleados = await fetchEmpleadosPorPuesto(p.id!);
            setEmpleadosPuestoActual({ nombre: p.nombre, empleados });
            setEmpleadosDialog(true);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la lista de empleados', life: 3000 });
        }
    }, []);

    const exportCSV = useCallback(() => {
        dt.current?.exportCSV();
    }, []);

    const nombreBodyTemplate = useCallback((rowData: Puesto) => <span>{rowData.nombre}</span>, []);

    const empleadosBodyTemplate = useCallback((rowData: Puesto) => (
        <Button
            label={String(rowData.total_empleados ?? 0)}
            icon="pi pi-users"
            text
            onClick={() => verEmpleadosPuesto(rowData)}
        />
    ), [verEmpleadosPuesto]);

    const estatusBodyTemplate = useCallback((rowData: Puesto) => (
        <span className={`px-3 py-1 border-round text-sm font-medium ${rowData.estatus ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {rowData.estatus ? 'Activo' : 'Inactivo'}
        </span>
    ), []);

    const actionBodyTemplate = useCallback((rowData: Puesto) => (
        <div className="flex gap-2">
            <Button icon="pi pi-pencil" rounded severity="info" onClick={() => editPuesto(rowData)} />
            <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeletePuesto(rowData)} />
        </div>
    ), [editPuesto, confirmDeletePuesto]);

    const leftToolbarTemplate = useCallback(() => (
        <div className="my-2">
            <Button label="Nuevo Puesto" icon="pi pi-plus" severity="info" onClick={openNew} />
        </div>
    ), [openNew]);

    const rightToolbarTemplate = useCallback(() => (
        <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={exportCSV} />
    ), [exportCSV]);

    const header = useCallback(() => (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Puestos</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText
                    type="search"
                    onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })}
                    placeholder="Buscar..."
                />
            </span>
        </div>
    ), [filters]);

    const puestoDialogFooter = useCallback(() => (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={savePuesto} loading={loading} />
        </>
    ), [hideDialog, savePuesto, loading]);

    const deletePuestoDialogFooter = useCallback(() => (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeletePuestoDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deletePuestoConfirmado} />
        </>
    ), [hideDeletePuestoDialog, deletePuestoConfirmado]);

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} right={rightToolbarTemplate}></Toolbar>

                    <DataTable
                        ref={dt}
                        value={puestos}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        className="datatable-responsive"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} puestos"
                        filters={filters}
                        emptyMessage="No se encontraron puestos"
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column field="nombre" header="Puesto" sortable body={nombreBodyTemplate}></Column>
                        <Column field="total_empleados" header="Empleados" body={empleadosBodyTemplate}></Column>
                        <Column field="estatus" header="Estatus" body={estatusBodyTemplate}></Column>
                        <Column header="Acciones" body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }}></Column>
                    </DataTable>

                    <Dialog
                        visible={puestoDialog}
                        style={{ width: '450px' }}
                        header={puesto.id ? 'Editar Puesto' : 'Nuevo Puesto'}
                        modal
                        className="p-fluid"
                        footer={puestoDialogFooter}
                        onHide={hideDialog}
                    >
                        <div className="field">
                            <label htmlFor="nombre">Nombre del puesto *</label>
                            <InputText
                                id="nombre"
                                value={puesto.nombre}
                                onChange={(e) => setPuesto({ ...puesto, nombre: e.target.value })}
                                required
                                autoFocus
                                className={submitted && !puesto.nombre ? 'p-invalid' : ''}
                            />
                            {submitted && !puesto.nombre && <small className="p-invalid">El nombre es requerido.</small>}
                        </div>

                        {puesto.id && (
                            <div className="field">
                                <ToggleButton
                                    checked={puesto.estatus}
                                    onChange={(e) => setPuesto({ ...puesto, estatus: e.value })}
                                    onLabel="Activo"
                                    offLabel="Inactivo"
                                    className="w-full md:w-8rem"
                                />
                            </div>
                        )}
                    </Dialog>

                    <Dialog
                        visible={deletePuestoDialog}
                        style={{ width: '450px' }}
                        header="Confirmar"
                        modal
                        footer={deletePuestoDialogFooter}
                        onHide={hideDeletePuestoDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {puesto && (
                                <span>
                                    ¿Estás seguro de eliminar el puesto <b>{puesto.nombre}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <Dialog
                        visible={empleadosDialog}
                        style={{ width: '500px' }}
                        header={`Empleados con el puesto de ${empleadosPuestoActual.nombre}`}
                        modal
                        onHide={() => setEmpleadosDialog(false)}
                    >
                        <DataTable value={empleadosPuestoActual.empleados} emptyMessage="No hay empleados con este puesto">
                            <Column field="nombre" header="Nombre"></Column>
                        </DataTable>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default PuestosCrud;
