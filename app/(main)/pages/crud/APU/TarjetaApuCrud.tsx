'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputText } from 'primereact/inputtext';
import { TabPanel, TabView } from 'primereact/tabview';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ConceptoApu, fetchConceptosApuActivos } from '../../../../../Services/BD/apu/conceptosApuService';
import { fetchInsumosApuPorTipo, InsumoApu, TipoInsumoApu } from '../../../../../Services/BD/apu/insumosApuService';
import {
    calcularCantidadSugerida,
    calcularTotalesTarjeta,
    createTarjetaApu,
    deleteTarjetaApu,
    fetchDefaultsTarjetaApu,
    fetchTarjetaApuPorId,
    fetchTarjetasApu,
    TarjetaApu,
    TarjetaInsumoApu,
    updateTarjetaApu
} from '../../../../../Services/BD/apu/tarjetasApuService';

const formatMoney = (v = 0) => `$ ${v.toFixed(2)}`;
const formatPct = (v = 0) => `${v.toFixed(1)} %`;

const tipoLabel: Record<TipoInsumoApu, string> = {
    MATERIAL: 'Material',
    MANO_OBRA: 'Mano de Obra',
    MAQUINARIA: 'Maquinaria',
    HERRAMIENTA: 'Herramienta'
};

const TarjetaApuCrud = () => {
    const emptyTarjeta: TarjetaApu = {
        id_concepto: 0,
        rendimiento: 1,
        jornada_horas: 8,
        pct_herramienta: 3,
        pct_indirectos: 15,
        pct_financiamiento: 2,
        pct_utilidad: 10,
        pct_cargos_adicionales: 0,
        notas: '',
        status: true,
        insumos: []
    };

    const [tarjetas, setTarjetas] = useState<TarjetaApu[]>([]);
    const [conceptos, setConceptos] = useState<ConceptoApu[]>([]);
    const [insumosMaterial, setInsumosMaterial] = useState<InsumoApu[]>([]);
    const [insumosManoObra, setInsumosManoObra] = useState<InsumoApu[]>([]);
    const [insumosMaquinaria, setInsumosMaquinaria] = useState<InsumoApu[]>([]);

    const [dialogVisible, setDialogVisible] = useState(false);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [tarjeta, setTarjeta] = useState<TarjetaApu>(emptyTarjeta);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const [nuevoInsumo, setNuevoInsumo] = useState<Record<TipoInsumoApu, { id_insumo: number | null; cantidad: number }>>({
        MATERIAL: { id_insumo: null, cantidad: 0 },
        MANO_OBRA: { id_insumo: null, cantidad: 0 },
        MAQUINARIA: { id_insumo: null, cantidad: 0 },
        HERRAMIENTA: { id_insumo: null, cantidad: 0 }
    });

    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });

    const cargar = async () => {
        setLoading(true);
        try {
            const [tarjetasData, conceptosData, materiales, manoObra, maquinaria] = await Promise.all([
                fetchTarjetasApu(),
                fetchConceptosApuActivos(),
                fetchInsumosApuPorTipo('MATERIAL'),
                fetchInsumosApuPorTipo('MANO_OBRA'),
                fetchInsumosApuPorTipo('MAQUINARIA')
            ]);
            setTarjetas(tarjetasData);
            setConceptos(conceptosData);
            setInsumosMaterial(materiales);
            setInsumosManoObra(manoObra);
            setInsumosMaquinaria(maquinaria);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar Tarjetas de Precio Unitario', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    const opcionesInsumoPorTipo: Record<TipoInsumoApu, InsumoApu[]> = {
        MATERIAL: insumosMaterial,
        MANO_OBRA: insumosManoObra,
        MAQUINARIA: insumosMaquinaria,
        HERRAMIENTA: []
    };

    // Conceptos sin tarjeta capturada, más el concepto de la tarjeta que se está editando (para no perderlo del dropdown)
    const conceptosDisponibles = useMemo(() => {
        return conceptos.filter((c) => !c.tiene_tarjeta || c.id === tarjeta.id_concepto);
    }, [conceptos, tarjeta.id_concepto]);

    const totales = useMemo(() => calcularTotalesTarjeta(tarjeta.insumos || [], tarjeta), [tarjeta]);

    const openNew = async () => {
        const defaults = await fetchDefaultsTarjetaApu();
        setTarjeta({ ...emptyTarjeta, ...defaults });
        setSubmitted(false);
        setDialogVisible(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setDialogVisible(false);
    };

    const editTarjeta = async (row: TarjetaApu) => {
        try {
            const completa = await fetchTarjetaApuPorId(row.id!);
            setTarjeta(completa);
            setDialogVisible(true);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al abrir la Tarjeta', life: 3000 });
        }
    };

    const confirmDelete = (row: TarjetaApu) => {
        setTarjeta(row);
        setDeleteDialogVisible(true);
    };

    const save = async () => {
        setSubmitted(true);

        if (tarjeta.id_concepto && tarjeta.rendimiento > 0) {
            setGuardando(true);
            try {
                if (tarjeta.id) {
                    const actualizada = await updateTarjetaApu(tarjeta);
                    setTarjetas((prev) => prev.map((t) => (t.id === actualizada.id ? actualizada : t)));
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Tarjeta actualizada', life: 3000 });
                } else {
                    const creada = await createTarjetaApu(tarjeta);
                    setTarjetas((prev) => [...prev, creada]);
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Tarjeta creada', life: 3000 });
                }
                await cargar();
                setDialogVisible(false);
                setTarjeta(emptyTarjeta);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar la Tarjeta', life: 3000 });
            } finally {
                setGuardando(false);
            }
        }
    };

    const deleteConfirmado = async () => {
        try {
            await deleteTarjetaApu(tarjeta.id!);
            setTarjetas((prev) => prev.filter((t) => t.id !== tarjeta.id));
            setDeleteDialogVisible(false);
            setTarjeta(emptyTarjeta);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Tarjeta eliminada', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar la Tarjeta', life: 3000 });
        }
    };

    const agregarInsumo = (tipo: TipoInsumoApu) => {
        const seleccion = nuevoInsumo[tipo];
        if (!seleccion.id_insumo || seleccion.cantidad <= 0) return;

        const opciones = opcionesInsumoPorTipo[tipo];
        const insumoCatalogo = opciones.find((i) => i.id === seleccion.id_insumo);
        if (!insumoCatalogo) return;

        const linea: TarjetaInsumoApu = {
            id_insumo: insumoCatalogo.id!,
            tipo,
            insumo_clave: insumoCatalogo.clave,
            insumo_descripcion: insumoCatalogo.descripcion,
            insumo_unidad: insumoCatalogo.unidad,
            cantidad: seleccion.cantidad,
            precio_unitario: insumoCatalogo.precio_unitario
        };

        setTarjeta({ ...tarjeta, insumos: [...(tarjeta.insumos || []), linea] });
        setNuevoInsumo({ ...nuevoInsumo, [tipo]: { id_insumo: null, cantidad: 0 } });
    };

    const quitarInsumo = (id_insumo: number, tipo: TipoInsumoApu) => {
        setTarjeta({ ...tarjeta, insumos: (tarjeta.insumos || []).filter((i) => !(i.id_insumo === id_insumo && i.tipo === tipo)) });
    };

    const cambiarCantidadInsumo = (id_insumo: number, tipo: TipoInsumoApu, cantidad: number) => {
        setTarjeta({
            ...tarjeta,
            insumos: (tarjeta.insumos || []).map((i) => (i.id_insumo === id_insumo && i.tipo === tipo ? { ...i, cantidad } : i))
        });
    };

    const statusBodyTemplate = (row: TarjetaApu) => <Tag value={row.status ? 'Activo' : 'Inactivo'} severity={row.status ? 'success' : 'danger'} />;

    const actionBodyTemplate = (row: TarjetaApu) => (
        <>
            <Button icon="pi pi-pencil" rounded severity="info" className="mr-2" onClick={() => editTarjeta(row)} />
            <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDelete(row)} />
        </>
    );

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Tarjetas de Precio Unitario</h5>
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

    const renderSeccionInsumos = (tipo: TipoInsumoApu) => {
        const lineas = (tarjeta.insumos || []).filter((i) => i.tipo === tipo);
        const opciones = opcionesInsumoPorTipo[tipo].filter((i) => !lineas.some((l) => l.id_insumo === i.id));
        const sugerencia = tipo === 'MANO_OBRA' || tipo === 'MAQUINARIA' ? calcularCantidadSugerida(tarjeta.jornada_horas, tarjeta.rendimiento) : null;

        return (
            <div>
                {sugerencia !== null && (
                    <p className="text-500 text-sm mt-0 flex align-items-center gap-2 flex-wrap">
                        <span>
                            Cantidad sugerida por rendimiento: <b>{sugerencia.toFixed(4)}</b> hr por {tarjeta.concepto_unidad || 'unidad'} (jornada {tarjeta.jornada_horas} hr ÷ rendimiento {tarjeta.rendimiento})
                        </span>
                        <Button
                            label="Usar sugerida"
                            icon="pi pi-bolt"
                            className="p-button-sm p-button-text"
                            type="button"
                            onClick={() => setNuevoInsumo({ ...nuevoInsumo, [tipo]: { ...nuevoInsumo[tipo], cantidad: sugerencia } })}
                        />
                    </p>
                )}

                <DataTable value={lineas} emptyMessage={`Sin ${tipoLabel[tipo].toLowerCase()} agregados.`} className="mb-3">
                    <Column field="insumo_clave" header="Clave" style={{ width: '100px' }}></Column>
                    <Column field="insumo_descripcion" header="Descripción"></Column>
                    <Column field="insumo_unidad" header="Unidad" style={{ width: '90px' }}></Column>
                    <Column
                        header="Cantidad"
                        style={{ width: '190px' }}
                        body={(row: TarjetaInsumoApu) => (
                            <div className="flex align-items-center gap-1">
                                <InputNumber value={row.cantidad} onValueChange={(e) => cambiarCantidadInsumo(row.id_insumo, tipo, e.value || 0)} mode="decimal" minFractionDigits={2} maxFractionDigits={4} min={0} size={6} />
                                {sugerencia !== null && (
                                    <Button
                                        icon="pi pi-bolt"
                                        rounded
                                        text
                                        severity="secondary"
                                        type="button"
                                        tooltip={`Usar sugerida (${sugerencia.toFixed(4)})`}
                                        tooltipOptions={{ position: 'top' }}
                                        onClick={() => cambiarCantidadInsumo(row.id_insumo, tipo, sugerencia)}
                                    />
                                )}
                            </div>
                        )}
                    ></Column>
                    <Column header="Precio Unitario" style={{ width: '130px' }} body={(row: TarjetaInsumoApu) => formatMoney(row.precio_unitario)}></Column>
                    <Column header="Importe" style={{ width: '130px' }} body={(row: TarjetaInsumoApu) => formatMoney((row.cantidad || 0) * (row.precio_unitario || 0))}></Column>
                    <Column
                        header=""
                        style={{ width: '60px' }}
                        body={(row: TarjetaInsumoApu) => <Button icon="pi pi-trash" rounded text severity="danger" onClick={() => quitarInsumo(row.id_insumo, tipo)} />}
                    ></Column>
                </DataTable>

                <div className="flex gap-2 align-items-end">
                    <div className="flex-grow-1">
                        <label className="block text-sm mb-1">Agregar {tipoLabel[tipo].toLowerCase()}</label>
                        <Dropdown
                            value={nuevoInsumo[tipo].id_insumo}
                            options={opciones}
                            optionLabel="descripcion"
                            optionValue="id"
                            filter
                            placeholder={`Selecciona ${tipoLabel[tipo].toLowerCase()}`}
                            onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, [tipo]: { ...nuevoInsumo[tipo], id_insumo: e.value } })}
                            className="w-full"
                        />
                    </div>
                    <div style={{ width: '160px' }}>
                        <label className="block text-sm mb-1">Cantidad</label>
                        <InputNumber
                            value={nuevoInsumo[tipo].cantidad}
                            onValueChange={(e) => setNuevoInsumo({ ...nuevoInsumo, [tipo]: { ...nuevoInsumo[tipo], cantidad: e.value || 0 } })}
                            mode="decimal"
                            minFractionDigits={2}
                            maxFractionDigits={4}
                            min={0}
                        />
                    </div>
                    <Button icon="pi pi-plus" label="Agregar" onClick={() => agregarInsumo(tipo)} />
                </div>
            </div>
        );
    };

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={() => <Button label="Nueva Tarjeta" icon="pi pi-plus" severity="info" onClick={openNew} />} right={() => <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={() => dt.current?.exportCSV()} />}></Toolbar>

                    <DataTable
                        ref={dt}
                        value={tarjetas}
                        loading={loading}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[10, 25, 50]}
                        className="datatable-responsive"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No se encontraron tarjetas."
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column field="concepto_clave" header="Clave" sortable style={{ width: '110px' }}></Column>
                        <Column field="concepto_descripcion" header="Concepto" sortable></Column>
                        <Column field="concepto_unidad" header="Unidad" sortable style={{ width: '90px' }}></Column>
                        <Column field="costo_directo" header="Costo Directo" sortable body={(r: TarjetaApu) => formatMoney(r.costo_directo)} style={{ width: '140px' }}></Column>
                        <Column field="pct_material" header="% Material" sortable body={(r: TarjetaApu) => formatPct(r.pct_material)} style={{ width: '110px' }}></Column>
                        <Column field="pct_mano_obra" header="% M.O." sortable body={(r: TarjetaApu) => formatPct(r.pct_mano_obra)} style={{ width: '100px' }}></Column>
                        <Column field="precio_unitario" header="Precio Unitario" sortable body={(r: TarjetaApu) => formatMoney(r.precio_unitario)} style={{ width: '150px' }}></Column>
                        <Column field="status" header="Estado" sortable body={statusBodyTemplate} style={{ width: '110px' }}></Column>
                        <Column body={actionBodyTemplate} headerStyle={{ minWidth: '9rem' }}></Column>
                    </DataTable>

                    <Dialog visible={dialogVisible} style={{ width: '95vw', maxWidth: '1100px' }} header="Tarjeta de Precio Unitario" modal className="p-fluid" footer={dialogFooter} onHide={hideDialog}>
                        <TabView>
                            <TabPanel header="Datos Generales">
                                <div className="grid">
                                    <div className="col-12">
                                        <div className="field">
                                            <label>Concepto</label>
                                            <Dropdown
                                                value={tarjeta.id_concepto || null}
                                                options={conceptosDisponibles}
                                                optionLabel="descripcion"
                                                optionValue="id"
                                                filter
                                                disabled={!!tarjeta.id}
                                                placeholder="Selecciona un concepto del catálogo"
                                                onChange={(e) => setTarjeta({ ...tarjeta, id_concepto: e.value })}
                                                className={submitted && !tarjeta.id_concepto ? 'p-invalid' : ''}
                                            />
                                            {submitted && !tarjeta.id_concepto && <small className="p-invalid">Selecciona un concepto.</small>}
                                        </div>
                                    </div>
                                    <div className="col-6 md:col-3">
                                        <div className="field">
                                            <label>Rendimiento (unidades/jornada)</label>
                                            <InputNumber value={tarjeta.rendimiento} onValueChange={(e) => setTarjeta({ ...tarjeta, rendimiento: e.value || 0 })} mode="decimal" minFractionDigits={2} maxFractionDigits={4} min={0} className={submitted && tarjeta.rendimiento <= 0 ? 'p-invalid' : ''} />
                                        </div>
                                    </div>
                                    <div className="col-6 md:col-3">
                                        <div className="field">
                                            <label>Jornada (horas)</label>
                                            <InputNumber value={tarjeta.jornada_horas} onValueChange={(e) => setTarjeta({ ...tarjeta, jornada_horas: e.value || 0 })} mode="decimal" minFractionDigits={1} min={0} />
                                        </div>
                                    </div>
                                    <div className="col-12">
                                        <div className="field">
                                            <label>Notas</label>
                                            <InputTextarea value={tarjeta.notas} onChange={(e) => setTarjeta({ ...tarjeta, notas: e.target.value })} rows={3} />
                                        </div>
                                    </div>
                                </div>
                            </TabPanel>

                            <TabPanel header={`Materiales (${(tarjeta.insumos || []).filter((i) => i.tipo === 'MATERIAL').length})`}>{renderSeccionInsumos('MATERIAL')}</TabPanel>

                            <TabPanel header={`Mano de Obra (${(tarjeta.insumos || []).filter((i) => i.tipo === 'MANO_OBRA').length})`}>{renderSeccionInsumos('MANO_OBRA')}</TabPanel>

                            <TabPanel header={`Maquinaria (${(tarjeta.insumos || []).filter((i) => i.tipo === 'MAQUINARIA').length})`}>{renderSeccionInsumos('MAQUINARIA')}</TabPanel>

                            <TabPanel header="Indirectos, Utilidad y Resumen">
                                <div className="grid">
                                    <div className="col-6 md:col-3">
                                        <div className="field">
                                            <label>Herramienta Menor (% M.O.)</label>
                                            <InputNumber value={tarjeta.pct_herramienta} onValueChange={(e) => setTarjeta({ ...tarjeta, pct_herramienta: e.value || 0 })} suffix=" %" min={0} />
                                        </div>
                                    </div>
                                    <div className="col-6 md:col-3">
                                        <div className="field">
                                            <label>Indirectos (%)</label>
                                            <InputNumber value={tarjeta.pct_indirectos} onValueChange={(e) => setTarjeta({ ...tarjeta, pct_indirectos: e.value || 0 })} suffix=" %" min={0} />
                                        </div>
                                    </div>
                                    <div className="col-6 md:col-3">
                                        <div className="field">
                                            <label>Financiamiento (%)</label>
                                            <InputNumber value={tarjeta.pct_financiamiento} onValueChange={(e) => setTarjeta({ ...tarjeta, pct_financiamiento: e.value || 0 })} suffix=" %" min={0} />
                                        </div>
                                    </div>
                                    <div className="col-6 md:col-3">
                                        <div className="field">
                                            <label>Utilidad (%)</label>
                                            <InputNumber value={tarjeta.pct_utilidad} onValueChange={(e) => setTarjeta({ ...tarjeta, pct_utilidad: e.value || 0 })} suffix=" %" min={0} />
                                        </div>
                                    </div>
                                    <div className="col-6 md:col-3">
                                        <div className="field">
                                            <label>Cargos Adicionales (%)</label>
                                            <InputNumber value={tarjeta.pct_cargos_adicionales} onValueChange={(e) => setTarjeta({ ...tarjeta, pct_cargos_adicionales: e.value || 0 })} suffix=" %" min={0} />
                                        </div>
                                    </div>

                                    <div className="col-12">
                                        <div className="surface-100 border-round p-3 mt-2">
                                            <div className="grid">
                                                <div className="col-6 md:col-3">
                                                    <span className="block text-500 text-sm">Costo Materiales</span>
                                                    <span className="font-bold">{formatMoney(totales.costo_materiales)}</span>
                                                </div>
                                                <div className="col-6 md:col-3">
                                                    <span className="block text-500 text-sm">Costo Mano de Obra</span>
                                                    <span className="font-bold">{formatMoney(totales.costo_mano_obra)}</span>
                                                </div>
                                                <div className="col-6 md:col-3">
                                                    <span className="block text-500 text-sm">Costo Maquinaria</span>
                                                    <span className="font-bold">{formatMoney(totales.costo_maquinaria)}</span>
                                                </div>
                                                <div className="col-6 md:col-3">
                                                    <span className="block text-500 text-sm">Costo Herramienta</span>
                                                    <span className="font-bold">{formatMoney(totales.costo_herramienta)}</span>
                                                </div>

                                                <div className="col-12">
                                                    <hr />
                                                </div>

                                                <div className="col-4 text-center">
                                                    <span className="block text-500 text-sm">% Material</span>
                                                    <span className="text-xl font-bold">{formatPct(totales.pct_material)}</span>
                                                </div>
                                                <div className="col-4 text-center">
                                                    <span className="block text-500 text-sm">% Mano de Obra</span>
                                                    <span className="text-xl font-bold">{formatPct(totales.pct_mano_obra)}</span>
                                                </div>
                                                <div className="col-4 text-center">
                                                    <span className="block text-500 text-sm">% Maquinaria</span>
                                                    <span className="text-xl font-bold">{formatPct(totales.pct_maquinaria)}</span>
                                                </div>

                                                <div className="col-12">
                                                    <hr />
                                                </div>

                                                <div className="col-6 md:col-3">
                                                    <span className="block text-500 text-sm">Costo Directo</span>
                                                    <span className="font-bold">{formatMoney(totales.costo_directo)}</span>
                                                </div>
                                                <div className="col-6 md:col-3">
                                                    <span className="block text-500 text-sm">Indirectos + Financiamiento</span>
                                                    <span className="font-bold">{formatMoney(totales.monto_indirectos + totales.monto_financiamiento)}</span>
                                                </div>
                                                <div className="col-6 md:col-3">
                                                    <span className="block text-500 text-sm">Utilidad + Cargos</span>
                                                    <span className="font-bold">{formatMoney(totales.monto_utilidad + totales.monto_cargos_adicionales)}</span>
                                                </div>
                                                <div className="col-6 md:col-3">
                                                    <span className="block text-500 text-sm">Precio Unitario</span>
                                                    <span className="text-xl font-bold text-primary">{formatMoney(totales.precio_unitario)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabPanel>
                        </TabView>
                    </Dialog>

                    <Dialog visible={deleteDialogVisible} style={{ width: '450px' }} header="Confirmar" modal footer={deleteDialogFooter} onHide={() => setDeleteDialogVisible(false)}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {tarjeta && (
                                <span>
                                    ¿Estás seguro de eliminar la tarjeta de <b>{tarjeta.concepto_descripcion}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default TarjetaApuCrud;
