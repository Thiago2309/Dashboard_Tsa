'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { Calendar } from 'primereact/calendar';
import { InputNumber } from 'primereact/inputnumber';
import { DataTableFilterMeta } from 'primereact/datatable';
import React, { useEffect, useRef, useState } from 'react';
import { fetchCajaChica, createCajaChica, updateCajaChica, deleteCajaChica, CajaChica } from '../../../../Services/BD/cajaChicaService';

const CajaChicaCrud = () => {
    let emptyCajaChica: CajaChica = {
        fecha: '',
        descripcion: '',
        ingreso: null,
        egreso: null,
    };

    const [cajaChicaList, setCajaChicaList] = useState<CajaChica[]>([]);
    const [cajaChicaDialog, setCajaChicaDialog] = useState(false);
    const [deleteCajaChicaDialog, setDeleteCajaChicaDialog] = useState(false);
    const [deleteCajaChicasDialog, setDeleteCajaChicasDialog] = useState(false);
    const [cajaChica, setCajaChica] = useState<CajaChica>(emptyCajaChica);
    const [selectedCajaChicas, setSelectedCajaChicas] = useState<CajaChica[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
                global: { value: null, matchMode: 'contains' as const }
            });
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);
    const [saldoTotal, setSaldoTotal] = useState<number>(0);

    // CALCULO DE GANANCIA TOTAL
    const calcularSaldoTotal = (cajaChicaList: CajaChica[]): number => {
        return cajaChicaList.reduce((total, item) => {
            const ingreso = item.ingreso || 0;
            const egreso = item.egreso || 0;
            return total + ingreso - egreso;
        }, 0);
    };

    useEffect(() => {
        fetchCajaChica().then(setCajaChicaList);
    }, []);

    useEffect(() => {
        const saldo = calcularSaldoTotal(cajaChicaList);
        setSaldoTotal(saldo);
    }, [cajaChicaList]);

    const openNew = () => {
        setCajaChica(emptyCajaChica);
        setSubmitted(false);
        setCajaChicaDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setCajaChicaDialog(false);
    };

    const hideDeleteCajaChicaDialog = () => {
        setDeleteCajaChicaDialog(false);
    };

    const hideDeleteCajaChicasDialog = () => {
        setDeleteCajaChicasDialog(false);
    };

    const saveCajaChica = async () => {
        setSubmitted(true);
    
        if (
            cajaChica.fecha &&
            cajaChica.descripcion.trim() &&
            (cajaChica.ingreso !== null || cajaChica.egreso !== null)
        ) {
            try {
                if (cajaChica.id) {
                    const updatedCajaChica = await updateCajaChica(cajaChica);
                    const updatedList = cajaChicaList.map(c => c.id === updatedCajaChica.id ? updatedCajaChica : c);
                    setCajaChicaList(updatedList);
                    setSaldoTotal(calcularSaldoTotal(updatedList)); // Recalcular saldo
                    toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Caja Chica Actualizada', life: 3000 });
                } else {
                    const newCajaChica = await createCajaChica(cajaChica);
                    const updatedList = [...cajaChicaList, newCajaChica];
                    setCajaChicaList(updatedList);
                    setSaldoTotal(calcularSaldoTotal(updatedList)); // Recalcular saldo
                    toast.current?.show({ severity: 'success', summary: 'Guardado Correctamente', detail: 'Caja Chica Creada', life: 3000 });
                }
                setCajaChicaDialog(false);
                setCajaChica(emptyCajaChica);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar la Caja Chica', life: 3000 });
            }
        }
    };

    const editCajaChica = (cajaChica: CajaChica) => {
        setCajaChica({ ...cajaChica });
        setCajaChicaDialog(true);
    };

    const confirmDeleteCajaChica = (cajaChica: CajaChica) => {
        setCajaChica(cajaChica);
        setDeleteCajaChicaDialog(true);
    };

    const deleteCajaChicaConfirmado = async () => {
        try {
            await deleteCajaChica(cajaChica.id!);
            const updatedList = cajaChicaList.filter(c => c.id !== cajaChica.id);
            setCajaChicaList(updatedList);
            setSaldoTotal(calcularSaldoTotal(updatedList)); // Recalcular saldo
            setDeleteCajaChicaDialog(false);
            setCajaChica(emptyCajaChica);
            toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Caja Chica Deleted', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error deleting Caja Chica', life: 3000 });
        }
    };

    const exportCSV = () => {
        dt.current?.exportCSV();
    };

    const confirmDeleteSelected = () => {
        setDeleteCajaChicasDialog(true);
    };

    const deleteSelectedCajaChicas = async () => {
        try {
            await Promise.all(selectedCajaChicas.map(c => deleteCajaChica(c.id!)));
            const updatedList = cajaChicaList.filter(c => !selectedCajaChicas.includes(c));
            setCajaChicaList(updatedList);
            setSaldoTotal(calcularSaldoTotal(updatedList)); // Recalcular saldo
            setDeleteCajaChicasDialog(false);
            setSelectedCajaChicas([]);
            toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Caja Chicas Deleted', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error deleting Caja Chicas', life: 3000 });
        }
    };

    const leftToolbarTemplate = () => {
        return (
            <React.Fragment>
                <div className="my-2">
                    <Button label="Nuevo" icon="pi pi-plus" severity="info" className="mr-2" onClick={openNew} />
                    <Button label="Eliminar" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} disabled={!selectedCajaChicas || !selectedCajaChicas.length} />
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

    const IdBodyTemplate = (rowData: CajaChica) => {
        return (
            <>
                <span className="p-column-title">Id</span>
                {rowData.id}
            </>
        );
    };

    const fechaBodyTemplate = (rowData: CajaChica) => {
        return (
            <>
                <span className="p-column-title">Fecha</span>
                {rowData.fecha}
            </>
        );
    };

    const descripcionBodyTemplate = (rowData: CajaChica) => {
        return (
            <>
                <span className="p-column-title">Descripción</span>
                {rowData.descripcion}
            </>
        );
    };

    const ingresoBodyTemplate = (rowData: CajaChica) => {
        return (
            <>
                <span className="p-column-title">Ingreso</span>
                $ {rowData.ingreso ?? "0"}
            </>
        );
    };

    const egresoBodyTemplate = (rowData: CajaChica) => {
        return (
            <>
                <span className="p-column-title">Egreso</span>
                $ {rowData.egreso ?? "0"}
            </>
        );
    };

    const actionBodyTemplate = (rowData: CajaChica) => {
        return (
            <>
                <Button icon="pi pi-pencil" rounded severity="info" className="mr-2" onClick={() => editCajaChica(rowData)} />
                <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteCajaChica(rowData)} />
            </>
        );
    };

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Caja Chica</h5>
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

    const cajaChicaDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveCajaChica} />
        </>
    );
    const deleteCajaChicaDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteCajaChicaDialog} />
            <Button label="Yes" icon="pi pi-check" text onClick={deleteCajaChicaConfirmado} />
        </>
    );
    const deleteCajaChicasDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteCajaChicasDialog} />
            <Button label="Yes" icon="pi pi-check" text onClick={deleteSelectedCajaChicas} />
        </>
    );


    return (
        <div className="grid crud-demo">
            <div className="col-12 lg:col-6 xl:col-3">
                <div className="card mb-0">
                    <div className="flex justify-content-between mb-3">
                        <div>
                            <span className="block text-500 font-medium mb-3">Resumen general del dinero de la empresa</span>
                            <div
                                className="text-900 font-medium text-xl"
                                style={{ color: saldoTotal >= 0 ? 'green' : 'red' }}
                            >
                                $ {saldoTotal.toLocaleString()} Pesos
                            </div>
                        </div>
                        <div
                            className="flex align-items-center justify-content-center border-round"
                            style={{
                                width: '2.5rem',
                                height: '2.5rem',
                                backgroundColor: saldoTotal >= 0 ? 'var(--green-100)' : 'var(--red-100)',
                            }}
                        >
                            <i
                                className={`pi pi-dollar text-xl`}
                                style={{ color: saldoTotal >= 0 ? 'var(--green-500)' : 'var(--red-500)' }}
                            />
                        </div>
                    </div>
                    <span className="text-500">Saldo actual</span>
                </div>
            </div>
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} right={rightToolbarTemplate}></Toolbar>

                    <DataTable
                        ref={dt}
                        value={cajaChicaList}
                        selection={selectedCajaChicas}
                        onSelectionChange={(e) => setSelectedCajaChicas(e.value)}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        className="datatable-responsive"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Showing {first} to {last} of {totalRecords} Caja Chica"
                        filters={filters} // PARA EL DE BUSQUEDA
                        filterDisplay="menu"
                        emptyMessage="No se encontraron resultados."
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '4rem' }}></Column>
                        <Column field="id" header="Id" sortable body={IdBodyTemplate} exportable={true}></Column>
                        <Column field="fecha" header="Fecha" sortable body={fechaBodyTemplate}></Column>
                        <Column field="descripcion" header="Descripción" sortable body={descripcionBodyTemplate}></Column>
                        <Column field="ingreso" header="Ingreso" sortable body={ingresoBodyTemplate}></Column>
                        <Column field="egreso" header="Egreso" sortable body={egresoBodyTemplate}></Column>
                        <Column body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }}></Column>
                    </DataTable>

                    <Dialog visible={cajaChicaDialog} style={{ width: '450px' }} header="Detalles de Caja Chica" modal className="p-fluid" footer={cajaChicaDialogFooter} onHide={hideDialog}>
                        <div className="field">
                            <label htmlFor="fecha">Fecha</label>
                            <Calendar
                                id="fecha"
                                value={
                                    cajaChica.fecha
                                        ? (() => {
                                            const [year, month, day] = cajaChica.fecha.split('-').map(Number);
                                            return new Date(year, month - 1, day);
                                        })()
                                        : null
                                }
                                onChange={(e) =>
                                    setCajaChica({
                                        ...cajaChica,
                                        fecha: e.value
                                            ? `${e.value.getFullYear()}-${String(e.value.getMonth() + 1).padStart(2, '0')}-${String(e.value.getDate()).padStart(2, '0')}`
                                            : ''
                                    })
                                }
                                dateFormat="yy-mm-dd"
                                showIcon
                                required
                                className={submitted && !cajaChica.fecha ? 'p-invalid' : ''}
                            />
                            {submitted && !cajaChica.fecha && <small className="p-invalid">Fecha es requerido.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="descripcion">Descripción</label>
                            <InputText
                                id="descripcion"
                                value={cajaChica.descripcion}
                                onChange={(e) => setCajaChica({ ...cajaChica, descripcion: e.target.value })}
                                required
                                className={submitted && !cajaChica.descripcion ? 'p-invalid' : ''}
                            />
                            {submitted && !cajaChica.descripcion && <small className="p-invalid">Descripción es requerido.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="ingreso">Ingreso</label>
                            <InputNumber
                                id="ingreso"
                                value={cajaChica.ingreso}
                                onValueChange={(e) => setCajaChica({ ...cajaChica, ingreso: e.value ?? null })}
                                mode="currency"
                                currency="MXN"   // puedes cambiarlo a "USD", "EUR", etc.
                                locale="es-MX"   // formato local (coma, punto, símbolo $)
                                minFractionDigits={2}
                                maxFractionDigits={2}
                                required
                                className="w-full"
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="egreso">Egreso</label>
                            <InputNumber
                                id="egreso"
                                value={cajaChica.egreso}
                                onValueChange={(e) => setCajaChica({ ...cajaChica, egreso: e.value ?? null })}
                                mode="currency"
                                currency="MXN"   // puedes cambiarlo a "USD", "EUR", etc.
                                locale="es-MX"   // formato local (coma, punto, símbolo $)
                                minFractionDigits={2}
                                maxFractionDigits={2}
                                required
                                className="w-full"
                            />
                        </div>
                    </Dialog>

                    <Dialog visible={deleteCajaChicaDialog} style={{ width: '450px' }} header="Confirm" modal footer={deleteCajaChicaDialogFooter} onHide={hideDeleteCajaChicaDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {cajaChica && (
                                <span>
                                    Esta seguro de eliminar ? <b>{cajaChica.descripcion}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <Dialog visible={deleteCajaChicasDialog} style={{ width: '450px' }} header="Confirm" modal footer={deleteCajaChicasDialogFooter} onHide={hideDeleteCajaChicasDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {cajaChica && <span>Esta seguro de eliminar lo seleccionado de la Caja chica?</span>}
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default CajaChicaCrud;