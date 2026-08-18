'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import React, { useEffect, useRef, useState } from 'react';
import { createInsumoApu, deleteInsumoApu, fetchInsumosApuCapturables, InsumoApu, TipoInsumoApu, updateInsumoApu } from '../../../../../Services/BD/apu/insumosApuService';

const tipoOptions: { label: string; value: TipoInsumoApu }[] = [
    { label: 'Material', value: 'MATERIAL' },
    { label: 'Mano de Obra', value: 'MANO_OBRA' }
];

const tipoSeverity: Record<TipoInsumoApu, 'info' | 'warning' | 'success' | 'danger'> = {
    MATERIAL: 'info',
    MANO_OBRA: 'warning',
    MAQUINARIA: 'success',
    HERRAMIENTA: 'danger'
};

const InsumosApuCrud = () => {
    const emptyInsumo: InsumoApu = {
        clave: '',
        descripcion: '',
        tipo: 'MATERIAL',
        unidad: '',
        precio_unitario: 0,
        status: true
    };

    const [insumos, setInsumos] = useState<InsumoApu[]>([]);
    const [insumoDialog, setInsumoDialog] = useState(false);
    const [deleteInsumoDialog, setDeleteInsumoDialog] = useState(false);
    const [insumo, setInsumo] = useState<InsumoApu>(emptyInsumo);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });

    const cargarInsumos = async () => {
        setLoading(true);
        try {
            const data = await fetchInsumosApuCapturables();
            setInsumos(data);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar Insumos', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarInsumos();
    }, []);

    const openNew = () => {
        setInsumo(emptyInsumo);
        setSubmitted(false);
        setInsumoDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setInsumoDialog(false);
    };

    const editInsumo = (row: InsumoApu) => {
        setInsumo({ ...row });
        setInsumoDialog(true);
    };

    const confirmDeleteInsumo = (row: InsumoApu) => {
        setInsumo(row);
        setDeleteInsumoDialog(true);
    };

    const saveInsumo = async () => {
        setSubmitted(true);

        if (insumo.clave.trim() && insumo.descripcion.trim() && insumo.unidad.trim() && insumo.precio_unitario >= 0) {
            try {
                if (insumo.id) {
                    const actualizado = await updateInsumoApu(insumo);
                    setInsumos((prev) => prev.map((i) => (i.id === actualizado.id ? actualizado : i)));
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Insumo actualizado', life: 3000 });
                } else {
                    const creado = await createInsumoApu(insumo);
                    setInsumos((prev) => [...prev, creado]);
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Insumo creado', life: 3000 });
                }
                setInsumoDialog(false);
                setInsumo(emptyInsumo);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar el Insumo', life: 3000 });
            }
        }
    };

    const deleteInsumoConfirmado = async () => {
        try {
            await deleteInsumoApu(insumo.id!);
            setInsumos((prev) => prev.filter((i) => i.id !== insumo.id));
            setDeleteInsumoDialog(false);
            setInsumo(emptyInsumo);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Insumo eliminado', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar el Insumo', life: 3000 });
        }
    };

    const leftToolbarTemplate = () => (
        <Button label="Nuevo Insumo" icon="pi pi-plus" severity="info" onClick={openNew} />
    );

    const rightToolbarTemplate = () => (
        <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={() => dt.current?.exportCSV()} />
    );

    const tipoBodyTemplate = (row: InsumoApu) => <Tag value={row.tipo === 'MANO_OBRA' ? 'Mano de Obra' : 'Material'} severity={tipoSeverity[row.tipo]} />;

    const precioBodyTemplate = (row: InsumoApu) => `$ ${row.precio_unitario.toFixed(2)}`;

    const statusBodyTemplate = (row: InsumoApu) => <Tag value={row.status ? 'Activo' : 'Inactivo'} severity={row.status ? 'success' : 'danger'} />;

    const actionBodyTemplate = (row: InsumoApu) => (
        <>
            <Button icon="pi pi-pencil" rounded severity="info" className="mr-2" onClick={() => editInsumo(row)} />
            <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteInsumo(row)} />
        </>
    );

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Catálogo de Insumos (Materiales y Mano de Obra)</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })} placeholder="Buscar..." />
            </span>
        </div>
    );

    const insumoDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveInsumo} />
        </>
    );

    const deleteInsumoDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={() => setDeleteInsumoDialog(false)} />
            <Button label="Eliminar" icon="pi pi-check" text onClick={deleteInsumoConfirmado} />
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
                        value={insumos}
                        loading={loading}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[10, 25, 50]}
                        className="datatable-responsive"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No se encontraron insumos."
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column field="clave" header="Clave" sortable style={{ width: '120px' }}></Column>
                        <Column field="descripcion" header="Descripción" sortable></Column>
                        <Column field="tipo" header="Tipo" sortable body={tipoBodyTemplate} style={{ width: '160px' }}></Column>
                        <Column field="unidad" header="Unidad" sortable style={{ width: '100px' }}></Column>
                        <Column field="precio_unitario" header="Precio Unitario" sortable body={precioBodyTemplate} style={{ width: '160px' }}></Column>
                        <Column field="status" header="Estado" sortable body={statusBodyTemplate} style={{ width: '110px' }}></Column>
                        <Column body={actionBodyTemplate} headerStyle={{ minWidth: '9rem' }}></Column>
                    </DataTable>

                    <Dialog visible={insumoDialog} style={{ width: '450px' }} header="Detalles de Insumo" modal className="p-fluid" footer={insumoDialogFooter} onHide={hideDialog}>
                        <div className="field">
                            <label htmlFor="tipo">Tipo</label>
                            <Dropdown id="tipo" value={insumo.tipo} options={tipoOptions} onChange={(e) => setInsumo({ ...insumo, tipo: e.value })} />
                        </div>
                        <div className="field">
                            <label htmlFor="clave">Clave</label>
                            <InputText id="clave" value={insumo.clave} onChange={(e) => setInsumo({ ...insumo, clave: e.target.value })} required className={submitted && !insumo.clave ? 'p-invalid' : ''} />
                            {submitted && !insumo.clave && <small className="p-invalid">Clave es requerida.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="descripcion">Descripción</label>
                            <InputText id="descripcion" value={insumo.descripcion} onChange={(e) => setInsumo({ ...insumo, descripcion: e.target.value })} required className={submitted && !insumo.descripcion ? 'p-invalid' : ''} />
                            {submitted && !insumo.descripcion && <small className="p-invalid">Descripción es requerida.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="unidad">Unidad (p.ej. m3, kg, HR, JOR)</label>
                            <InputText id="unidad" value={insumo.unidad} onChange={(e) => setInsumo({ ...insumo, unidad: e.target.value })} required className={submitted && !insumo.unidad ? 'p-invalid' : ''} />
                            {submitted && !insumo.unidad && <small className="p-invalid">Unidad es requerida.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="precio_unitario">{insumo.tipo === 'MANO_OBRA' ? 'Costo por Hora (salario real)' : 'Precio Unitario'}</label>
                            <InputNumber id="precio_unitario" value={insumo.precio_unitario} onValueChange={(e) => setInsumo({ ...insumo, precio_unitario: e.value || 0 })} mode="decimal" minFractionDigits={2} maxFractionDigits={2} min={0} />
                        </div>
                    </Dialog>

                    <Dialog visible={deleteInsumoDialog} style={{ width: '450px' }} header="Confirmar" modal footer={deleteInsumoDialogFooter} onHide={() => setDeleteInsumoDialog(false)}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {insumo && (
                                <span>
                                    ¿Estás seguro de eliminar <b>{insumo.descripcion}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default InsumosApuCrud;
