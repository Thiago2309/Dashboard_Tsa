'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import React, { useEffect, useRef, useState } from 'react';
import { fetchGastos, createGasto, updateGasto, deleteGasto, Gasto, fetchViajes, fetchProveedores } from '../../../../Services/BD/gastoService';
import { InputNumber } from 'primereact/inputnumber';

const GastosCrud = () => {
    let emptyGasto: Gasto = {
        id_viaje: null,
        fecha: '',
        id_proveedor: null,
        refaccion: '',
        importe: null,
        descripcion: ''
    };

    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [gastoDialog, setGastoDialog] = useState(false);
    const [deleteGastoDialog, setDeleteGastoDialog] = useState(false);
    const [deleteGastosDialog, setDeleteGastosDialog] = useState(false);
    const [gasto, setGasto] = useState<Gasto>(emptyGasto);
    const [selectedGastos, setSelectedGastos] = useState<Gasto[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);
    const [totalGastos, setTotalGastos] = useState<number>(0);

    // State for dropdown options
    const [viajes, setViajes] = useState<{ id: number; folio: string }[]>([]);
    const [proveedores, setProveedores] = useState<{ id: number; nombre: string }[]>([]);

    // CALCULO DE GANANCIA TOTAL
    const calcularTotalGastos = (gastos: Gasto[]): number => {
        return gastos.reduce((total, item) => {
            const importe = item.importe || 0; // Si importe es null, usa 0
            return total + importe;
        }, 0);
    };

    useEffect(() => {
        fetchGastos().then(setGastos);
        fetchViajes().then(setViajes);
        fetchProveedores().then(setProveedores);
    }, []);

    useEffect(() => {
        const total = calcularTotalGastos(gastos);
        setTotalGastos(total);
    }, [gastos]);

    const openNew = () => {
        setGasto(emptyGasto);
        setSubmitted(false);
        setGastoDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setGastoDialog(false);
    };

    const hideDeleteGastoDialog = () => {
        setDeleteGastoDialog(false);
    };

    const hideDeleteGastosDialog = () => {
        setDeleteGastosDialog(false);
    };

    const saveGasto = async () => {
        setSubmitted(true);
    
        if (
            gasto.fecha &&
            gasto.id_proveedor !== null &&
            gasto.refaccion.trim() &&
            gasto.importe !== null
        ) {
            try {
                if (gasto.id) {
                    const updatedGasto = await updateGasto(gasto);
                    const updatedList = gastos.map(g => g.id === updatedGasto.id ? updatedGasto : g);
                    setGastos(updatedList);
                    setTotalGastos(calcularTotalGastos(updatedList)); // Recalcular total
                    toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Gasto Updated', life: 3000 });
                } else {
                    const newGasto = await createGasto(gasto);
                    const updatedList = [...gastos, newGasto];
                    setGastos(updatedList);
                    setTotalGastos(calcularTotalGastos(updatedList)); // Recalcular total
                    toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Gasto Created', life: 3000 });
                }
                fetchGastos().then(setGastos);
                setGastoDialog(false);
                setGasto(emptyGasto);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error saving gasto', life: 3000 });
            }
        }
    };

    const editGasto = (gasto: Gasto) => {
        setGasto({ ...gasto });
        setGastoDialog(true);
    };

    const confirmDeleteGasto = (gasto: Gasto) => {
        setGasto(gasto);
        setDeleteGastoDialog(true);
    };

    const deleteGastoConfirmado = async () => {
        try {
            await deleteGasto(gasto.id!);
            setGastos(gastos.filter(g => g.id !== gasto.id));
            setDeleteGastoDialog(false);
            setGasto(emptyGasto);
            toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Gasto Deleted', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error deleting gasto', life: 3000 });
        }
    };

    const exportCSV = () => {
        dt.current?.exportCSV();
    };

    const confirmDeleteSelected = () => {
        setDeleteGastosDialog(true);
    };

    const deleteSelectedGastos = async () => {
        try {
            await Promise.all(selectedGastos.map(g => deleteGasto(g.id!)));
            setGastos(gastos.filter(g => !selectedGastos.includes(g)));
            setDeleteGastosDialog(false);
            setSelectedGastos([]);
            toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Gastos Deleted', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error deleting gastos', life: 3000 });
        }
    };

    const leftToolbarTemplate = () => {
        return (
            <React.Fragment>
                <div className="my-2">
                    <Button label="Nuevo" icon="pi pi-plus" severity="info" className="mr-2" onClick={openNew} />
                    <Button label="Eliminar" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} disabled={!selectedGastos || !selectedGastos.length} />
                </div>
            </React.Fragment>
        );
    };

    const rightToolbarTemplate = () => {
        return (
            <React.Fragment>
                <Button label="Export" icon="pi pi-upload" severity="help" onClick={exportCSV} />
            </React.Fragment>
        );
    };

    const IdBodyTemplate = (rowData: Gasto) => {
        return (
            <>
                <span className="p-column-title">Id</span>
                {rowData.id}
            </>
        );
    };

    const fechaBodyTemplate = (rowData: Gasto) => {
        return (
            <>
                <span className="p-column-title">Fecha</span>
                {rowData.fecha}
            </>
        );
    };

    const viajeBodyTemplate = (rowData: Gasto) => {
        return (
            <>
                <span className="p-column-title">Viaje</span>
                {rowData.id_viaje ?? '-'}
            </>
        );
    };

    const proveedorBodyTemplate = (rowData: Gasto) => {
        return (
            <>
                <span className="p-column-title">Proveedor</span>
                {rowData.proveedor_nombre}
            </>
        );
    };

    const refaccionBodyTemplate = (rowData: Gasto) => {
        return (
            <>
                <span className="p-column-title">Refacción</span>
                {rowData.refaccion}
            </>
        );
    };

    const descripcionBodyTemplate = (rowData: Gasto) => {
        return (
            <>
                <span className="p-column-title">descripcion</span>
                {rowData.descripcion}
            </>
        );
    };

    const importeBodyTemplate = (rowData: Gasto) => {
        return (
            <>
                <span className="p-column-title">Importe</span>
                $ {rowData.importe}
            </>
        );
    };

    const actionBodyTemplate = (rowData: Gasto) => {
        return (
            <>
                <Button icon="pi pi-pencil" rounded severity="info" className="mr-2" onClick={() => editGasto(rowData)} />
                <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteGasto(rowData)} />
            </>
        );
    };

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Gastos</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setGlobalFilter(e.currentTarget.value)} placeholder="Search..." />
            </span>
        </div>
    );

    const gastoDialogFooter = (
        <>
            <Button label="Cancel" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Save" icon="pi pi-check" text onClick={saveGasto} />
        </>
    );
    const deleteGastoDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteGastoDialog} />
            <Button label="Yes" icon="pi pi-check" text onClick={deleteGastoConfirmado} />
        </>
    );
    const deleteGastosDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteGastosDialog} />
            <Button label="Yes" icon="pi pi-check" text onClick={deleteSelectedGastos} />
        </>
    );

    return (
        
        <div className="grid crud-demo">
            <div className="col-12 lg:col-6 xl:col-3">
                <div className="card mb-0">
                    <div className="flex justify-content-between mb-3">
                        <div>
                            <span className="block text-500 font-medium mb-3">Total de Gastos</span>
                            <div className="text-900 font-medium text-xl">$ {totalGastos.toLocaleString()} Pesos</div>
                        </div>
                        <div className="flex align-items-center justify-content-center bg-green-100 border-round" style={{ width: '2.5rem', height: '2.5rem' }}>
                            <i className="pi pi-dollar text-black-500 text-xl" />
                        </div>
                    </div>
                    <span className="text-500">Total gastado</span>
                </div>
            </div>
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} right={rightToolbarTemplate}></Toolbar>

                    <DataTable
                        ref={dt}
                        value={gastos}
                        selection={selectedGastos}
                        onSelectionChange={(e) => setSelectedGastos(e.value)}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        className="datatable-responsive"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Showing {first} to {last} of {totalRecords} gastos"
                        globalFilter={globalFilter}
                        emptyMessage="No gastos found."
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '4rem' }}></Column>
                        <Column field="id" header="Id" sortable body={IdBodyTemplate} exportable={true}></Column>
                        <Column field="fecha" header="Fecha" sortable body={fechaBodyTemplate}></Column>
                        <Column field="viaje_folio" header="Viaje" sortable body={viajeBodyTemplate}></Column>
                        <Column field="proveedor_nombre" header="Proveedor" sortable body={proveedorBodyTemplate}></Column>
                        <Column field="refaccion" header="Refacción" sortable body={refaccionBodyTemplate}></Column>
                        <Column field="descripcion" header="descripcion" sortable body={descripcionBodyTemplate}></Column>
                        <Column field="importe" header="Importe" sortable body={importeBodyTemplate}></Column>
                        <Column body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }}></Column>
                    </DataTable>

                    <Dialog visible={gastoDialog} style={{ width: '450px' }} header="Detalle de Gastos" modal className="p-fluid" footer={gastoDialogFooter} onHide={hideDialog}>
                        <div className="field">
                            <label htmlFor="fecha">Fecha</label><span style={{ color: 'red' }}> *</span>
                            <Calendar
                                id="fecha"
                                value={
                                    gasto.fecha
                                        ? (() => {
                                            const [year, month, day] = gasto.fecha.split('-').map(Number);
                                            return new Date(year, month - 1, day);
                                        })()
                                        : null
                                }
                                onChange={(e) =>
                                    setGasto({
                                        ...gasto,
                                        fecha: e.value
                                            ? `${e.value.getFullYear()}-${String(e.value.getMonth() + 1).padStart(2, '0')}-${String(e.value.getDate()).padStart(2, '0')}`
                                            : ''
                                    })
                                }
                                dateFormat="yy-mm-dd"
                                showIcon
                                required
                                className={submitted && !gasto.fecha ? 'p-invalid' : ''}
                            />
                            {submitted && !gasto.fecha && <small className="p-invalid">Fecha es requerido.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="id_viaje">Viaje</label>
                            <Dropdown
                                id="id_viaje"
                                value={gasto.id_viaje}
                                options={viajes.map(v => ({ label: v.folio, value: v.id }))}
                                onChange={(e) => setGasto({ ...gasto, id_viaje: e.value })}
                                placeholder="Selecciona un viaje"
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="id_proveedor">Proveedor</label><span style={{ color: 'red' }}> *</span>
                            <Dropdown
                                id="id_proveedor"
                                value={gasto.id_proveedor}
                                options={proveedores.map(p => ({ label: p.nombre, value: p.id }))}
                                onChange={(e) => setGasto({ ...gasto, id_proveedor: e.value })}
                                placeholder="Selecciona un proveedor"
                                required
                                className={submitted && !gasto.id_proveedor ? 'p-invalid' : ''}
                            />
                            {submitted && !gasto.id_proveedor && <small className="p-invalid">Proveedor es requerido.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="refaccion">Refacción</label><span style={{ color: 'red' }}> *</span>
                            <InputText
                                id="refaccion"
                                value={gasto.refaccion}
                                onChange={(e) => setGasto({ ...gasto, refaccion: e.target.value })}
                                required
                                className={submitted && !gasto.refaccion ? 'p-invalid' : ''}
                            />
                            {submitted && !gasto.refaccion && <small className="p-invalid">Refacción es requerido.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="descripcion">descripcion</label><span style={{ color: 'red' }}> *</span>
                            <InputText
                                id="descripcion"
                                value={gasto.descripcion}
                                onChange={(e) => setGasto({ ...gasto, descripcion: e.target.value })}
                                required
                                className={submitted && !gasto.descripcion ? 'p-invalid' : ''}
                            />
                            {submitted && !gasto.descripcion && <small className="p-invalid">descripcion es requerido.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="importe">Importe</label><span style={{ color: 'red' }}> *</span>
                            <InputNumber
                                id="importe"
                                value={gasto.importe ?? null}
                                onValueChange={(e) => setGasto({ ...gasto, importe: e.value ?? null })}
                                mode="currency"
                                currency="MXN"   // puedes cambiarlo a "USD", "EUR", etc.
                                locale="es-MX"   // formato local (coma, punto, símbolo $)
                                minFractionDigits={2}
                                maxFractionDigits={2}
                                required
                                className={submitted && !gasto.importe ? 'p-invalid' : ''}
                            />
                            {submitted && !gasto.importe && <small className="p-invalid">Importe es requerido.</small>}
                        </div>
                    </Dialog>

                    <Dialog visible={deleteGastoDialog} style={{ width: '450px' }} header="Confirm" modal footer={deleteGastoDialogFooter} onHide={hideDeleteGastoDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {gasto && (
                                <span>
                                    Are you sure you want to delete <b>{gasto.refaccion}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <Dialog visible={deleteGastosDialog} style={{ width: '450px' }} header="Confirm" modal footer={deleteGastosDialogFooter} onHide={hideDeleteGastosDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {gasto && <span>Are you sure you want to delete the selected gastos?</span>}
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default GastosCrud;