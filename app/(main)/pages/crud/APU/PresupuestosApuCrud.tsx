'use client';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Column } from 'primereact/column';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { TabPanel, TabView } from 'primereact/tabview';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    calcularTotalesPresupuesto,
    createPresupuestoApu,
    deletePresupuestoApu,
    fetchPresupuestoApuPorId,
    fetchPresupuestosApu,
    PresupuestoApu,
    PresupuestoConceptoApu,
    PresupuestoFrenteApu,
    updatePresupuestoApu
} from '../../../../../Services/BD/apu/presupuestosApuService';
import { fetchTarjetasApu, TarjetaApu } from '../../../../../Services/BD/apu/tarjetasApuService';
import { PresupuestoApuDetalleModal } from './PresupuestoApuDetalleModal';
import { PresupuestoFrenteEditor } from './PresupuestoFrenteEditor';

const formatMoney = (v = 0) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const hoyISO = () => new Date().toISOString().split('T')[0];
const isoADate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`) : new Date());
const dateAIso = (fecha: Date | null) => {
    if (!fecha) return hoyISO();
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const PresupuestosApuCrud = () => {
    const emptyPresupuesto: PresupuestoApu = {
        nombre: '',
        empresa_nombre: '',
        dependencia: '',
        concurso_no: '',
        fecha: hoyISO(),
        obra_nombre: '',
        lugar: '',
        pct_iva: 16,
        status: true,
        frentes: []
    };

    const [presupuestos, setPresupuestos] = useState<PresupuestoApu[]>([]);
    const [tarjetas, setTarjetas] = useState<TarjetaApu[]>([]);
    const [loading, setLoading] = useState(false);

    const [dialogVisible, setDialogVisible] = useState(false);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [presupuesto, setPresupuesto] = useState<PresupuestoApu>(emptyPresupuesto);
    const [submitted, setSubmitted] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const [idDetalle, setIdDetalle] = useState<number | null>(null);
    const [detalleVisible, setDetalleVisible] = useState(false);

    const toast = useRef<Toast>(null);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });

    const cargar = async () => {
        setLoading(true);
        try {
            const [presupuestosData, tarjetasData] = await Promise.all([fetchPresupuestosApu(), fetchTarjetasApu()]);
            setPresupuestos(presupuestosData);
            setTarjetas(tarjetasData);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar Presupuestos', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    const frentes = presupuesto.frentes || [];
    const totalConceptos = frentes.reduce((acc, f) => acc + f.conceptos.length, 0);
    const totales = useMemo(() => calcularTotalesPresupuesto(frentes, presupuesto.pct_iva), [frentes, presupuesto.pct_iva]);

    const openNew = () => {
        setPresupuesto(emptyPresupuesto);
        setSubmitted(false);
        setDialogVisible(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setDialogVisible(false);
    };

    const editPresupuesto = async (row: PresupuestoApu) => {
        try {
            const completo = await fetchPresupuestoApuPorId(row.id!);
            setPresupuesto(completo);
            setDialogVisible(true);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al abrir el Presupuesto', life: 3000 });
        }
    };

    const verDetalle = (row: PresupuestoApu) => {
        setIdDetalle(row.id!);
        setDetalleVisible(true);
    };

    const confirmDelete = (row: PresupuestoApu) => {
        setPresupuesto(row);
        setDeleteDialogVisible(true);
    };

    const save = async () => {
        setSubmitted(true);

        if (presupuesto.nombre.trim() && presupuesto.empresa_nombre.trim() && frentes.length > 0 && totalConceptos > 0) {
            setGuardando(true);
            try {
                if (presupuesto.id) {
                    await updatePresupuestoApu(presupuesto);
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Presupuesto actualizado', life: 3000 });
                } else {
                    await createPresupuestoApu(presupuesto);
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Presupuesto creado', life: 3000 });
                }
                await cargar();
                setDialogVisible(false);
                setPresupuesto(emptyPresupuesto);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar el Presupuesto', life: 3000 });
            } finally {
                setGuardando(false);
            }
        }
    };

    const deleteConfirmado = async () => {
        try {
            await deletePresupuestoApu(presupuesto.id!);
            setPresupuestos((prev) => prev.filter((p) => p.id !== presupuesto.id));
            setDeleteDialogVisible(false);
            setPresupuesto(emptyPresupuesto);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Presupuesto eliminado', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar el Presupuesto', life: 3000 });
        }
    };

    const agregarFrente = () => {
        setPresupuesto({ ...presupuesto, frentes: [...frentes, { nombre: `Frente ${frentes.length + 1}`, orden: frentes.length, conceptos: [] }] });
    };

    const actualizarFrente = (index: number, cambios: Partial<PresupuestoFrenteApu>) => {
        setPresupuesto({ ...presupuesto, frentes: frentes.map((f, i) => (i === index ? { ...f, ...cambios } : f)) });
    };

    const eliminarFrente = (index: number) => {
        setPresupuesto({ ...presupuesto, frentes: frentes.filter((_, i) => i !== index) });
    };

    const agregarConceptoAFrente = (index: number, linea: PresupuestoConceptoApu) => {
        actualizarFrente(index, { conceptos: [...frentes[index].conceptos, linea] });
    };

    const quitarConceptoDeFrente = (index: number, id_concepto: number) => {
        actualizarFrente(index, { conceptos: frentes[index].conceptos.filter((c) => c.id_concepto !== id_concepto) });
    };

    const cambiarCantidadEnFrente = (index: number, id_concepto: number, cantidad: number) => {
        actualizarFrente(index, { conceptos: frentes[index].conceptos.map((c) => (c.id_concepto === id_concepto ? { ...c, cantidad } : c)) });
    };

    const cambiarAplicaIvaEnFrente = (index: number, id_concepto: number, aplica: boolean) => {
        actualizarFrente(index, { conceptos: frentes[index].conceptos.map((c) => (c.id_concepto === id_concepto ? { ...c, aplica_iva: aplica } : c)) });
    };

    const statusBodyTemplate = (row: PresupuestoApu) => <Tag value={row.status ? 'Activo' : 'Inactivo'} severity={row.status ? 'success' : 'danger'} />;

    const actionBodyTemplate = (row: PresupuestoApu) => (
        <>
            <Button icon="pi pi-eye" rounded severity="secondary" className="mr-2" onClick={() => verDetalle(row)} tooltip="Detalles" tooltipOptions={{ position: 'top' }} />
            <Button icon="pi pi-pencil" rounded severity="info" className="mr-2" onClick={() => editPresupuesto(row)} />
            <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDelete(row)} />
        </>
    );

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Presupuestos</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })} placeholder="Buscar..." />
            </span>
        </div>
    );

    const dialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={save} loading={guardando} />
        </>
    );

    const deleteDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={() => setDeleteDialogVisible(false)} />
            <Button label="Eliminar" icon="pi pi-check" text onClick={deleteConfirmado} />
        </>
    );

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={() => <Button label="Nuevo Presupuesto" icon="pi pi-plus" severity="info" onClick={openNew} />}></Toolbar>

                    <DataTable
                        value={presupuestos}
                        loading={loading}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[10, 25, 50]}
                        className="datatable-responsive"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No se encontraron presupuestos."
                        header={header}
                        responsiveLayout="scroll"
                        sortField="fecha"
                        sortOrder={-1}
                    >
                        <Column field="nombre" header="Presupuesto" sortable></Column>
                        <Column field="dependencia" header="Dependencia" sortable></Column>
                        <Column field="fecha" header="Fecha" sortable style={{ width: '110px' }}></Column>
                        <Column field="pct_iva" header="IVA" sortable body={(r: PresupuestoApu) => `${r.pct_iva}%`} style={{ width: '80px' }}></Column>
                        <Column field="total" header="Total" sortable body={(r: PresupuestoApu) => formatMoney(r.total)} style={{ width: '150px' }}></Column>
                        <Column field="status" header="Estado" sortable body={statusBodyTemplate} style={{ width: '110px' }}></Column>
                        <Column body={actionBodyTemplate} headerStyle={{ minWidth: '11rem' }}></Column>
                    </DataTable>

                    <Dialog visible={dialogVisible} style={{ width: '95vw', maxWidth: '1150px' }} header="Presupuesto de Obra" modal className="p-fluid" footer={dialogFooter} onHide={hideDialog}>
                        <TabView>
                            <TabPanel header="Datos Generales">
                                <div className="grid">
                                    <div className="col-12 md:col-6">
                                        <div className="field">
                                            <label>Nombre del Presupuesto (interno, para identificarlo en la lista)</label>
                                            <InputText value={presupuesto.nombre} onChange={(e) => setPresupuesto({ ...presupuesto, nombre: e.target.value })} className={submitted && !presupuesto.nombre ? 'p-invalid' : ''} />
                                        </div>
                                    </div>
                                    <div className="col-12 md:col-6">
                                        <div className="field">
                                            <label>Fecha</label>
                                            <Calendar value={isoADate(presupuesto.fecha)} onChange={(e) => setPresupuesto({ ...presupuesto, fecha: dateAIso(e.value as Date) })} dateFormat="dd/mm/yy" showIcon />
                                        </div>
                                    </div>

                                    <div className="col-12">
                                        <div className="field">
                                            <label>Empresa (encabezado del presupuesto)</label>
                                            <InputText value={presupuesto.empresa_nombre} onChange={(e) => setPresupuesto({ ...presupuesto, empresa_nombre: e.target.value })} className={submitted && !presupuesto.empresa_nombre ? 'p-invalid' : ''} />
                                        </div>
                                    </div>
                                    <div className="col-12 md:col-8">
                                        <div className="field">
                                            <label>Dependencia (cliente)</label>
                                            <InputText value={presupuesto.dependencia} onChange={(e) => setPresupuesto({ ...presupuesto, dependencia: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="col-12 md:col-4">
                                        <div className="field">
                                            <label>Concurso No.</label>
                                            <InputText value={presupuesto.concurso_no} onChange={(e) => setPresupuesto({ ...presupuesto, concurso_no: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="col-12">
                                        <div className="field">
                                            <label>Obra</label>
                                            <InputTextarea value={presupuesto.obra_nombre} onChange={(e) => setPresupuesto({ ...presupuesto, obra_nombre: e.target.value })} rows={2} />
                                        </div>
                                    </div>
                                    <div className="col-12">
                                        <div className="field">
                                            <label>Lugar</label>
                                            <InputTextarea value={presupuesto.lugar} onChange={(e) => setPresupuesto({ ...presupuesto, lugar: e.target.value })} rows={2} />
                                        </div>
                                    </div>
                                    <div className="col-6 md:col-3">
                                        <div className="field">
                                            <label>IVA por default (%)</label>
                                            <InputNumber value={presupuesto.pct_iva} onValueChange={(e) => setPresupuesto({ ...presupuesto, pct_iva: e.value ?? 16 })} suffix=" %" min={0} />
                                            <small className="text-500">Se aplica solo sobre los conceptos marcados con IVA en cada Frente.</small>
                                        </div>
                                    </div>
                                </div>
                            </TabPanel>

                            <TabPanel header={`Frentes (${frentes.length})`}>
                                {frentes.map((frente, index) => (
                                    <PresupuestoFrenteEditor
                                        key={frente.id ?? `nuevo-${index}`}
                                        frente={frente}
                                        opcionesConcepto={tarjetas.filter((t) => !frente.conceptos.some((c) => c.id_concepto === t.id_concepto))}
                                        onRenombrar={(nombre) => actualizarFrente(index, { nombre })}
                                        onEliminarFrente={() => eliminarFrente(index)}
                                        onAgregarConcepto={(linea) => agregarConceptoAFrente(index, linea)}
                                        onQuitarConcepto={(id_concepto) => quitarConceptoDeFrente(index, id_concepto)}
                                        onCambiarCantidad={(id_concepto, cantidad) => cambiarCantidadEnFrente(index, id_concepto, cantidad)}
                                        onCambiarAplicaIva={(id_concepto, aplica) => cambiarAplicaIvaEnFrente(index, id_concepto, aplica)}
                                    />
                                ))}

                                <Button label="Agregar Frente" icon="pi pi-plus" severity="secondary" onClick={agregarFrente} className="mb-4" style={{ width: 'auto' }} />

                                {submitted && frentes.length === 0 && <small className="p-invalid block mb-3">Agrega al menos un Frente.</small>}
                                {submitted && frentes.length > 0 && totalConceptos === 0 && <small className="p-invalid block mb-3">Agrega al menos un concepto.</small>}

                                <div className="surface-100 border-round p-3">
                                    <div className="grid">
                                        <div className="col-4 text-center">
                                            <span className="block text-500 text-sm">Subtotal</span>
                                            <span className="font-bold">{formatMoney(totales.subtotal)}</span>
                                        </div>
                                        <div className="col-4 text-center">
                                            <span className="block text-500 text-sm">I.V.A. ({presupuesto.pct_iva}%)</span>
                                            <span className="font-bold">{formatMoney(totales.monto_iva)}</span>
                                        </div>
                                        <div className="col-4 text-center">
                                            <span className="block text-500 text-sm">Total</span>
                                            <span className="text-xl font-bold text-primary">{formatMoney(totales.total)}</span>
                                        </div>
                                    </div>
                                </div>
                            </TabPanel>
                        </TabView>
                    </Dialog>

                    <Dialog visible={deleteDialogVisible} style={{ width: '450px' }} header="Confirmar" modal footer={deleteDialogFooter} onHide={() => setDeleteDialogVisible(false)}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {presupuesto && (
                                <span>
                                    ¿Estás seguro de eliminar el presupuesto <b>{presupuesto.nombre}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <PresupuestoApuDetalleModal visible={detalleVisible} idPresupuesto={idDetalle} onHide={() => setDetalleVisible(false)} />
                </div>
            </div>
        </div>
    );
};

export default PresupuestosApuCrud;
