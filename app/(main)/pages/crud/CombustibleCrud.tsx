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
import { DataTableFilterMeta } from 'primereact/datatable';
import React, { useEffect, useRef, useState } from 'react';
import { fetchCombustible, createCombustible, updateCombustible, deleteCombustible, Combustible, fetchViajes, fetchOperadores } from '../../../../Services/BD/combustibleService';
import { InputNumber } from 'primereact/inputnumber';

const CombustibleCrud = () => {
    let emptyCombustible: Combustible = {
        id_viaje: null,
        fecha: '',
        id_operador: null,
        litros: null,
        importe: null,
    };

    const [combustibles, setCombustibles] = useState<Combustible[]>([]);
    const [combustibleDialog, setCombustibleDialog] = useState(false);
    const [deleteCombustibleDialog, setDeleteCombustibleDialog] = useState(false);
    const [deleteCombustiblesDialog, setDeleteCombustiblesDialog] = useState(false);
    const [combustible, setCombustible] = useState<Combustible>(emptyCombustible);
    const [selectedCombustibles, setSelectedCombustibles] = useState<Combustible[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);
    const [totalImporteCombustible, setTotalImporteCombustible] = useState<number>(0);

    // CALCULO DE COMBUSTIBLE TOTAL
    const calcularTotalImporteCombustible = (combustibles: Combustible[]): number => {
        return combustibles.reduce((total, item) => {
            const importe = item.importe || 0; // Si importe es null, usa 0
            return total + importe;
        }, 0);
    };

    // CALCULO DE LITROS DE COMBUSTIBLE TOTAL AL MES
    const calcularLitrosUltimoMes = (combustibles: Combustible[]): { litros: number; mes: string; año: number } => {
        const hoy = new Date();
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1); // Primer día del mes actual
        const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0); // Último día del mes actual
    
        // Obtener el nombre del mes y el año
        const nombreMes = primerDiaMes.toLocaleString('es', { month: 'long' }); // Nombre del mes en español
        const año = primerDiaMes.getFullYear(); // Año
    
        // Filtrar registros del último mes
        const registrosFiltrados = combustibles.filter((c) => {
            const fechaCombustible = new Date(c.fecha).toISOString().split('T')[0]; // Solo la fecha (YYYY-MM-DD)
            const primerDiaMesISO = primerDiaMes.toISOString().split('T')[0];
            const ultimoDiaMesISO = ultimoDiaMes.toISOString().split('T')[0];
    
            return fechaCombustible >= primerDiaMesISO && fechaCombustible <= ultimoDiaMesISO;
        });
    
        // Sumar los litros
        const litrosUltimoMes = registrosFiltrados.reduce((total, c) => {
            const litros = c.litros || 0; // Si litros es null, usa 0
            return total + litros;
        }, 0);
    
        return {
            litros: litrosUltimoMes,
            mes: nombreMes,
            año: año,
        };
    };

    // QUE OPERADOR GASTO MAS LITRO EN EL ULTIMO MES
    const encontrarOperadorConMasLitros = (combustibles: Combustible[]): { operador: string; litros: number } | null => {
        const hoy = new Date();
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1); // Primer día del mes actual
        const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0); // Último día del mes actual
    
        // Filtrar registros del último mes
        const registrosUltimoMes = combustibles.filter((c) => {
            const fechaCombustible = new Date(c.fecha);
            return fechaCombustible >= primerDiaMes && fechaCombustible <= ultimoDiaMes;
        });
    
        // Agrupar litros por operador
        const litrosPorOperador: { [key: string]: number } = {};
        registrosUltimoMes.forEach((c) => {
            if (c.id_operador !== null) {
                const operadorNombre = c.operador_nombre || `Operador ${c.id_operador}`;
                litrosPorOperador[operadorNombre] = (litrosPorOperador[operadorNombre] || 0) + (c.litros || 0);
            }
        });
    
        // Encontrar el operador con más litros
        let operadorConMasLitros: string | null = null;
        let maxLitros = 0;
        for (const [operador, litros] of Object.entries(litrosPorOperador)) {
            if (litros > maxLitros) {
                maxLitros = litros;
                operadorConMasLitros = operador;
            }
        }
    
        return operadorConMasLitros ? { operador: operadorConMasLitros, litros: maxLitros } : null;
    };
    const { litros, mes, año } = calcularLitrosUltimoMes(combustibles);
    const operadorConMasLitros = encontrarOperadorConMasLitros(combustibles);

    // State for dropdown options
    const [viajes, setViajes] = useState<{ id: number; folio: string }[]>([]);
    const [operadores, setOperadores] = useState<{ id: number; nombre: string }[]>([]);

    useEffect(() => {
        fetchCombustible().then(setCombustibles);
        fetchViajes().then(setViajes);
        fetchOperadores().then(setOperadores);
    }, []);

    useEffect(() => {
        const total = calcularTotalImporteCombustible(combustibles);
        setTotalImporteCombustible(total);
    }, [combustibles]);

    const openNew = () => {
        setCombustible(emptyCombustible);
        setSubmitted(false);
        setCombustibleDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setCombustibleDialog(false);
    };

    const hideDeleteCombustibleDialog = () => {
        setDeleteCombustibleDialog(false);
    };

    const hideDeleteCombustiblesDialog = () => {
        setDeleteCombustiblesDialog(false);
    };

    const saveCombustible = async () => {
        setSubmitted(true);
    
        if (
            combustible.fecha &&
            combustible.id_operador !== null &&
            combustible.litros !== null &&
            combustible.importe !== null
        ) {
            try {
                if (combustible.id) {
                    const updatedCombustible = await updateCombustible(combustible);
                    const updatedList = combustibles.map(c => c.id === updatedCombustible.id ? updatedCombustible : c);
                    setCombustibles(updatedList);
                    setTotalImporteCombustible(calcularTotalImporteCombustible(updatedList)); // Recalcular total
                    toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Combustible Updated', life: 3000 });
                } else {
                    const newCombustible = await createCombustible(combustible);
                    const updatedList = [...combustibles, newCombustible];
                    setCombustibles(updatedList);
                    setTotalImporteCombustible(calcularTotalImporteCombustible(updatedList)); // Recalcular total
                    toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Combustible Created', life: 3000 });
                }
                setCombustibleDialog(false);
                setCombustible(emptyCombustible);
                fetchCombustible().then(setCombustibles);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error saving combustible', life: 3000 });
            }
        }
    };

    const editCombustible = (combustible: Combustible) => {
        setCombustible({ ...combustible });
        setCombustibleDialog(true);
    };

    const confirmDeleteCombustible = (combustible: Combustible) => {
        setCombustible(combustible);
        setDeleteCombustibleDialog(true);
    };

    const deleteCombustibleConfirmado = async () => {
        try {
            await deleteCombustible(combustible.id!);
            setCombustibles(combustibles.filter(c => c.id !== combustible.id));
            setDeleteCombustibleDialog(false);
            setCombustible(emptyCombustible);
            toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Combustible Deleted', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error deleting combustible', life: 3000 });
        }
    };

    const exportCSV = () => {
        dt.current?.exportCSV();
    };

    const confirmDeleteSelected = () => {
        setDeleteCombustiblesDialog(true);
    };

    const deleteSelectedCombustibles = async () => {
        try {
            await Promise.all(selectedCombustibles.map(c => deleteCombustible(c.id!)));
            setCombustibles(combustibles.filter(c => !selectedCombustibles.includes(c)));
            setDeleteCombustiblesDialog(false);
            setSelectedCombustibles([]);
            toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Combustibles Deleted', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error deleting combustibles', life: 3000 });
        }
    };

    const leftToolbarTemplate = () => {
        return (
            <React.Fragment>
                <div className="my-2">
                    <Button label="Nuevo" icon="pi pi-plus" severity="info" className="mr-2" onClick={openNew} />
                    <Button label="Eliminar" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} disabled={!selectedCombustibles || !selectedCombustibles.length} />
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

    const IdBodyTemplate = (rowData: Combustible) => {
        return (
            <>
                <span className="p-column-title">Id</span>
                {rowData.id}
            </>
        );
    };

    const fechaBodyTemplate = (rowData: Combustible) => {
        return (
            <>
                <span className="p-column-title">Fecha</span>
                {rowData.fecha}
            </>
        );
    };

    const viajeBodyTemplate = (rowData: Combustible) => {
        return (
            <>
                <span className="p-column-title">Viaje</span>
                {rowData.viaje_folio ?? '-'}
            </>
        );
    };

    const operadorBodyTemplate = (rowData: Combustible) => {
        return (
            <>
                <span className="p-column-title">Operador</span>
                {rowData.operador_nombre}
            </>
        );
    };

    const litrosBodyTemplate = (rowData: Combustible) => {
        return (
            <>
                <span className="p-column-title">Litros</span>
                {rowData.litros}
            </>
        );
    };

    const importeBodyTemplate = (rowData: Combustible) => {
        return (
            <>
                <span className="p-column-title">Importe</span>
                $ {rowData.importe}
            </>
        );
    };

    const actionBodyTemplate = (rowData: Combustible) => {
        return (
            <>
                <Button icon="pi pi-pencil" rounded severity="info" className="mr-2" onClick={() => editCombustible(rowData)} />
                <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteCombustible(rowData)} />
            </>
        );
    };

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Combustible</h5>
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

    const combustibleDialogFooter = (
        <>
            <Button label="Cancel" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Save" icon="pi pi-check" text onClick={saveCombustible} />
        </>
    );
    const deleteCombustibleDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteCombustibleDialog} />
            <Button label="Yes" icon="pi pi-check" text onClick={deleteCombustibleConfirmado} />
        </>
    );
    const deleteCombustiblesDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteCombustiblesDialog} />
            <Button label="Yes" icon="pi pi-check" text onClick={deleteSelectedCombustibles} />
        </>
    );

    return (
        <div className="grid crud-demo">
            {/* Total de combustible */}
            <div className="col-12 lg:col-6 xl:col-3">
                <div className="card mb-0">
                    <div className="flex justify-content-between mb-3">
                        <div>
                            <span className="block text-500 font-medium mb-3">Total de Importe de Combustible</span>
                            <div
                                className="text-900 font-medium text-xl"
                                style={{ color: totalImporteCombustible >= 0 ? 'green' : 'red' }}
                            >
                                $ {totalImporteCombustible.toLocaleString()} Pesos
                            </div>
                        </div>
                        <div
                            className="flex align-items-center justify-content-center border-round"
                            style={{
                                width: '2.5rem',
                                height: '2.5rem',
                                backgroundColor: totalImporteCombustible >= 0 ? 'var(--green-100)' : 'var(--red-100)',
                            }}
                        >
                            <i
                                className={`pi pi-dollar text-xl`}
                                style={{ color: totalImporteCombustible >= 0 ? 'var(--green-500)' : 'var(--red-500)' }}
                            />
                        </div>
                    </div>
                    <span className="text-500">Total actual</span>
                </div>
            </div>
            {/* Mostrar litros gastados en el último mes */}
            <div className="col-12 lg:col-6 xl:col-3">
                <div className="card mb-0">
                    <div className="flex justify-content-between mb-3">
                        <div>
                            <span className="block text-500 font-medium mb-3">Litros gastados en {mes} de {año}</span>
                            <div className="text-900 font-medium text-xl">{litros} L</div>
                        </div>
                        <div className="flex align-items-center justify-content-center bg-blue-100 border-round" style={{ width: '2.5rem', height: '2.5rem' }}>
                            <i className="pi pi-truck text-blue-500 text-xl" />
                        </div>
                    </div>
                    <span className="text-500">Total de litros consumidos este mes</span>
                </div>
            </div>
            {/* Mostrar el operador que gastó más litros */}
             <div className="col-12 lg:col-6 xl:col-3">
                <div className="card mb-0">
                    <div className="flex justify-content-between mb-3">
                        <div>
                            <span className="block text-500 font-medium mb-3">Operador con más litros gastados</span>
                            <div className="text-900 font-medium text-xl">
                                {operadorConMasLitros ? `${operadorConMasLitros.operador} (${operadorConMasLitros.litros} L)` : "N/A"}
                            </div>
                        </div>
                        <div className="flex align-items-center justify-content-center bg-orange-100 border-round" style={{ width: '2.5rem', height: '2.5rem' }}>
                            <i className="pi pi-user text-orange-500 text-xl" />
                        </div>
                    </div>
                    <span className="text-500">Operador con mayor consumo este mes</span>
                </div>
            </div>
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} right={rightToolbarTemplate}></Toolbar>

                    <DataTable
                        ref={dt}
                        value={combustibles}
                        selection={selectedCombustibles}
                        onSelectionChange={(e) => setSelectedCombustibles(e.value)}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        className="datatable-responsive"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Showing {first} to {last} of {totalRecords} combustibles"
                        filters={filters} // PARA EL DE BUSQUEDA
                        filterDisplay="menu"
                        emptyMessage="No combustibles found."
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '4rem' }}></Column>
                        <Column field="id" header="Id" sortable body={IdBodyTemplate} exportable={true}></Column>
                        <Column field="fecha" header="Fecha" sortable body={fechaBodyTemplate}></Column>
                        <Column field="viaje_folio" header="Viaje" sortable body={viajeBodyTemplate}></Column>
                        <Column field="operador_nombre" header="Operador" sortable body={operadorBodyTemplate}></Column>
                        <Column field="litros" header="Litros" sortable body={litrosBodyTemplate}></Column>
                        <Column field="importe" header="Importe" sortable body={importeBodyTemplate}></Column>
                        <Column body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }}></Column>
                    </DataTable>

                    <Dialog visible={combustibleDialog} style={{ width: '450px' }} header="Combustible Details" modal className="p-fluid" footer={combustibleDialogFooter} onHide={hideDialog}>
                        <div className="field">
                            <label htmlFor="fecha">Fecha</label><span style={{ color: 'red' }}> *</span>
                            <Calendar
                                id="fecha"
                                value={
                                    combustible.fecha
                                        ? (() => {
                                            const [year, month, day] = combustible.fecha.split('-').map(Number);
                                            return new Date(year, month - 1, day);
                                        })()
                                        : null
                                }
                                onChange={(e) =>
                                    setCombustible({
                                        ...combustible,
                                        fecha: e.value
                                            ? `${e.value.getFullYear()}-${String(e.value.getMonth() + 1).padStart(2, '0')}-${String(e.value.getDate()).padStart(2, '0')}`
                                            : ''
                                    })
                                }
                                dateFormat="yy-mm-dd"
                                showIcon
                                required
                                className={submitted && !combustible.fecha ? 'p-invalid' : ''}
                            />
                            {submitted && !combustible.fecha && <small className="p-invalid">Fecha es requerido.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="id_viaje">Viaje</label>
                            <Dropdown
                                id="id_viaje"
                                value={combustible.id_viaje}
                                options={viajes.map(v => ({ label: v.folio, value: v.id }))}
                                onChange={(e) => setCombustible({ ...combustible, id_viaje: e.value })}
                                placeholder="Selecciona un viaje"
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="id_operador">Operador</label><span style={{ color: 'red' }}> *</span>
                            <Dropdown
                                id="id_operador"
                                value={combustible.id_operador}
                                options={operadores.map(o => ({ label: o.nombre, value: o.id }))}
                                onChange={(e) => setCombustible({ ...combustible, id_operador: e.value })}
                                placeholder="Selecciona un operador"
                                required
                                className={submitted && !combustible.id_operador ? 'p-invalid' : ''}
                            />
                            {submitted && !combustible.id_operador && <small className="p-invalid">Operador es requerido.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="litros">Litros</label><span style={{ color: 'red' }}> *</span>
                            <InputNumber
                                id="litros"
                                value={combustible.litros ?? null}
                                onValueChange={(e) => setCombustible({ ...combustible, litros: e.value ?? null })}
                                mode="decimal"
                                minFractionDigits={0}   // si aceptas enteros (ej: 50 litros)
                                maxFractionDigits={2}   // si aceptas decimales (ej: 50.75 litros)
                                required
                                className={submitted && !combustible.litros ? 'p-invalid' : ''}
                            />
                            {submitted && !combustible.litros && <small className="p-invalid">Litros es requerido.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="importe">Importe</label><span style={{ color: 'red' }}> *</span>
                            <InputNumber
                                id="importe"
                                value={combustible.importe ?? null}
                                onValueChange={(e) => setCombustible({ ...combustible, importe: e.value ?? null })}
                                mode="currency"
                                currency="MXN"     // o USD, EUR, etc.
                                locale="es-MX"     // formato mexicano: $ 1,234.56
                                minFractionDigits={2}
                                maxFractionDigits={2}
                                required
                                className={submitted && !combustible.importe ? 'p-invalid' : ''}
                            />
                            {submitted && !combustible.importe && <small className="p-invalid">Importe es requerido.</small>}
                        </div>
                    </Dialog>

                    <Dialog visible={deleteCombustibleDialog} style={{ width: '450px' }} header="Confirm" modal footer={deleteCombustibleDialogFooter} onHide={hideDeleteCombustibleDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {combustible && (
                                <span>
                                    Are you sure you want to delete <b>{combustible.id}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <Dialog visible={deleteCombustiblesDialog} style={{ width: '450px' }} header="Confirm" modal footer={deleteCombustiblesDialogFooter} onHide={hideDeleteCombustiblesDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {combustible && <span>Are you sure you want to delete the selected combustibles?</span>}
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default CombustibleCrud;