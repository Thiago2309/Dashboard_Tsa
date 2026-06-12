'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import React, { useEffect, useRef, useState } from 'react';
import { 
  fetchProveedores, 
  createProveedor, 
  updateProveedor, 
  deleteProveedor, 
  Proveedor 
} from '../../../../Services/BD/provedoresService';
import { DataTableFilterMeta } from 'primereact/datatable';

const ProveedoresCrud = () => {
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [proveedorDialog, setProveedorDialog] = useState(false);
    const [deleteProveedorDialog, setDeleteProveedorDialog] = useState(false);
    const [deleteProveedoresDialog, setDeleteProveedoresDialog] = useState(false);
    const [proveedor, setProveedor] = useState<Proveedor>({ 
      nombre: '', 
      descripcion: ''
    });
    const [selectedProveedores, setSelectedProveedores] = useState<Proveedor[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    useEffect(() => {
        fetchProveedores().then(setProveedores);
    }, []);

    const openNew = () => {
        setProveedor({ 
          nombre: '', 
          descripcion: ''
        });
        setSubmitted(false);
        setProveedorDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setProveedorDialog(false);
    };

    const hideDeleteProveedorDialog = () => {
        setDeleteProveedorDialog(false);
    };

    const hideDeleteProveedoresDialog = () => {
        setDeleteProveedoresDialog(false);
    };

    const saveProveedor = async () => {
        setSubmitted(true);

        if (proveedor.nombre.trim()) {
            try {
                if (proveedor.id) {
                    const updatedProveedor = await updateProveedor(proveedor);
                    setProveedores(proveedores.map(p => p.id === updatedProveedor.id ? updatedProveedor : p));
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Proveedor actualizado', life: 3000 });
                } else {
                    const newProveedor = await createProveedor(proveedor);
                    setProveedores([...proveedores, newProveedor]);
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Proveedor creado', life: 3000 });
                }
                setProveedorDialog(false);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar proveedor', life: 3000 });
            }
        }
    };

    const editProveedor = (proveedor: Proveedor) => {
        setProveedor({ ...proveedor });
        setProveedorDialog(true);
    };

    const confirmDeleteProveedor = (proveedor: Proveedor) => {
        setProveedor(proveedor);
        setDeleteProveedorDialog(true);
    };

    const confirmDeleteSelected = () => {
        setDeleteProveedoresDialog(true);
    };

    const deleteProveedorConfirmado = async () => {
        try {
            await deleteProveedor(proveedor.id!);
            setProveedores(proveedores.filter(p => p.id !== proveedor.id));
            setDeleteProveedorDialog(false);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Proveedor eliminado', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar proveedor', life: 3000 });
        }
    };

    const deleteSelectedProveedores = async () => {
        try {
            await Promise.all(selectedProveedores.map(p => deleteProveedor(p.id!)));
            setProveedores(proveedores.filter(p => !selectedProveedores.includes(p)));
            setDeleteProveedoresDialog(false);
            setSelectedProveedores([]);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Proveedores eliminados', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar proveedores', life: 3000 });
        }
    };

    const exportCSV = () => {
        dt.current?.exportCSV();
    };

    const nombreBodyTemplate = (rowData: Proveedor) => {
        return <span>{rowData.nombre}</span>;
    };

    const descripcionBodyTemplate = (rowData: Proveedor) => {
        return <span>{rowData.descripcion || '-'}</span>;
    };

    const fechaBodyTemplate = (rowData: Proveedor) => {
        if (!rowData.created_at) return '-';
        
        const fecha = new Date(rowData.created_at);
        return <span>{fecha.toLocaleDateString('es-ES')}</span>;
    };

    const actionBodyTemplate = (rowData: Proveedor) => {
        return (
            <div className="flex gap-2">
                <Button icon="pi pi-pencil" rounded severity="info" onClick={() => editProveedor(rowData)} />
                <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteProveedor(rowData)} />
            </div>
        );
    };

    const leftToolbarTemplate = () => {
        return (
            <div className="my-2">
                <Button label="Nuevo" icon="pi pi-plus" severity="info" className="mr-2" onClick={openNew} />
                <Button label="Eliminar" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} 
                    disabled={!selectedProveedores || selectedProveedores.length === 0} />
            </div>
        );
    };

    const rightToolbarTemplate = () => {
        return (
            <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={exportCSV} />
        );
    };

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Proveedores</h5>
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

    const proveedorDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveProveedor} />
        </>
    );

    const deleteProveedorDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteProveedorDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteProveedorConfirmado} />
        </>
    );

    const deleteProveedoresDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteProveedoresDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteSelectedProveedores} />
        </>
    );

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} right={rightToolbarTemplate}></Toolbar>

                    <DataTable
                        ref={dt}
                        value={proveedores}
                        selection={selectedProveedores}
                        onSelectionChange={(e) => setSelectedProveedores(e.value)}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        className="datatable-responsive"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} proveedores"
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No se encontraron proveedores"
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                        <Column field="nombre" header="Nombre" sortable body={nombreBodyTemplate}></Column>
                        <Column field="descripcion" header="Descripción" body={descripcionBodyTemplate}></Column>
                        <Column field="created_at" header="Fecha de Registro" sortable body={fechaBodyTemplate}></Column>
                        <Column header="Acciones" body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }}></Column>
                    </DataTable>

                    <Dialog
                        visible={proveedorDialog}
                        style={{ width: '500px' }}
                        header={proveedor.id ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                        modal
                        className="p-fluid"
                        footer={proveedorDialogFooter}
                        onHide={hideDialog}
                    >
                        <div className="field">
                            <label htmlFor="nombre">Nombre del proveedor</label>
                            <InputText
                                id="nombre"
                                value={proveedor.nombre}
                                onChange={(e) => setProveedor({ ...proveedor, nombre: e.target.value })}
                                required
                                autoFocus
                                className={submitted && !proveedor.nombre ? 'p-invalid' : ''}
                            />
                            {submitted && !proveedor.nombre && (
                                <small className="p-invalid">Nombre es requerido.</small>
                            )}
                        </div>

                        <div className="field">
                            <label htmlFor="descripcion">Descripción</label>
                            <InputText
                                id="descripcion"
                                value={proveedor.descripcion || ''}
                                onChange={(e) => setProveedor({ ...proveedor, descripcion: e.target.value })}
                            />
                        </div>
                    </Dialog>

                    <Dialog
                        visible={deleteProveedorDialog}
                        style={{ width: '450px' }}
                        header="Confirmar"
                        modal
                        footer={deleteProveedorDialogFooter}
                        onHide={hideDeleteProveedorDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {proveedor && (
                                <span>
                                    ¿Estás seguro de eliminar al proveedor <b>{proveedor.nombre}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <Dialog
                        visible={deleteProveedoresDialog}
                        style={{ width: '450px' }}
                        header="Confirmar"
                        modal
                        footer={deleteProveedoresDialogFooter}
                        onHide={hideDeleteProveedoresDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {proveedor && (
                                <span>
                                    ¿Estás seguro de eliminar los {selectedProveedores.length} proveedores seleccionados?
                                </span>
                            )}
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default ProveedoresCrud;