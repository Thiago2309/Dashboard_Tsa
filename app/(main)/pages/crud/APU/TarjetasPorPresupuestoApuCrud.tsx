'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { TabPanel, TabView } from 'primereact/tabview';
import { Toast } from 'primereact/toast';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchInsumosApuPorTipo, InsumoApu, TipoInsumoApu } from '../../../../../Services/BD/apu/insumosApuService';
import { fetchPresupuestosApu, PresupuestoApu } from '../../../../../Services/BD/apu/presupuestosApuService';
import {
    fetchPresupuestoTarjetaApuPorId,
    fetchPresupuestoTarjetasApu,
    PresupuestoTarjetaApu,
    PresupuestoTarjetaInsumoApu,
    updatePresupuestoTarjetaApu
} from '../../../../../Services/BD/apu/presupuestoTarjetasApuService';
import { calcularCantidadSugerida, calcularTotalesTarjeta } from '../../../../../Services/BD/apu/tarjetasApuService';

const formatMoney = (v = 0) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const formatPct = (v = 0) => `${v.toFixed(1)} %`;

const tipoLabel: Record<TipoInsumoApu, string> = {
    MATERIAL: 'Material',
    MANO_OBRA: 'Mano de Obra',
    MAQUINARIA: 'Maquinaria',
    HERRAMIENTA: 'Herramienta'
};

const TarjetasPorPresupuestoApuCrud = () => {
    const [presupuestos, setPresupuestos] = useState<PresupuestoApu[]>([]);
    const [idPresupuesto, setIdPresupuesto] = useState<number | null>(null);
    const [tarjetas, setTarjetas] = useState<PresupuestoTarjetaApu[]>([]);
    const [loading, setLoading] = useState(false);
    const [cargandoTarjetas, setCargandoTarjetas] = useState(false);

    const [insumosMaterial, setInsumosMaterial] = useState<InsumoApu[]>([]);
    const [insumosManoObra, setInsumosManoObra] = useState<InsumoApu[]>([]);
    const [insumosMaquinaria, setInsumosMaquinaria] = useState<InsumoApu[]>([]);

    const [dialogVisible, setDialogVisible] = useState(false);
    const [tarjeta, setTarjeta] = useState<PresupuestoTarjetaApu | null>(null);
    const [guardando, setGuardando] = useState(false);

    const [nuevoInsumo, setNuevoInsumo] = useState<Record<TipoInsumoApu, { id_insumo: number | null; cantidad: number }>>({
        MATERIAL: { id_insumo: null, cantidad: 0 },
        MANO_OBRA: { id_insumo: null, cantidad: 0 },
        MAQUINARIA: { id_insumo: null, cantidad: 0 },
        HERRAMIENTA: { id_insumo: null, cantidad: 0 }
    });

    const toast = useRef<Toast>(null);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchPresupuestosApu(), fetchInsumosApuPorTipo('MATERIAL'), fetchInsumosApuPorTipo('MANO_OBRA'), fetchInsumosApuPorTipo('MAQUINARIA')])
            .then(([presupuestosData, materiales, manoObra, maquinaria]) => {
                setPresupuestos(presupuestosData);
                setInsumosMaterial(materiales);
                setInsumosManoObra(manoObra);
                setInsumosMaquinaria(maquinaria);
            })
            .catch(() => toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar Presupuestos', life: 3000 }))
            .finally(() => setLoading(false));
    }, []);

    const opcionesInsumoPorTipo: Record<TipoInsumoApu, InsumoApu[]> = {
        MATERIAL: insumosMaterial,
        MANO_OBRA: insumosManoObra,
        MAQUINARIA: insumosMaquinaria,
        HERRAMIENTA: []
    };

    const seleccionarPresupuesto = async (id: number | null) => {
        setIdPresupuesto(id);
        if (!id) {
            setTarjetas([]);
            return;
        }
        setCargandoTarjetas(true);
        try {
            setTarjetas(await fetchPresupuestoTarjetasApu(id));
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar las Tarjetas del Presupuesto', life: 3000 });
        } finally {
            setCargandoTarjetas(false);
        }
    };

    const editTarjeta = async (row: PresupuestoTarjetaApu) => {
        try {
            const completa = await fetchPresupuestoTarjetaApuPorId(row.id!);
            setTarjeta(completa);
            setDialogVisible(true);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al abrir la Tarjeta', life: 3000 });
        }
    };

    const hideDialog = () => {
        setDialogVisible(false);
        setTarjeta(null);
    };

    const totales = useMemo(() => (tarjeta ? calcularTotalesTarjeta(tarjeta.insumos || [], tarjeta) : null), [tarjeta]);

    const save = async () => {
        if (!tarjeta) return;

        setGuardando(true);
        try {
            const actualizada = await updatePresupuestoTarjetaApu(tarjeta);
            setTarjetas((prev) => prev.map((t) => (t.id === actualizada.id ? actualizada : t)));
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Tarjeta del presupuesto actualizada. Se recalculó el total del presupuesto.', life: 4000 });
            setDialogVisible(false);
            setTarjeta(null);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar la Tarjeta del Presupuesto', life: 3000 });
        } finally {
            setGuardando(false);
        }
    };

    const agregarInsumo = (tipo: TipoInsumoApu) => {
        if (!tarjeta) return;
        const seleccion = nuevoInsumo[tipo];
        if (!seleccion.id_insumo || seleccion.cantidad <= 0) return;

        const opciones = opcionesInsumoPorTipo[tipo];
        const insumoCatalogo = opciones.find((i) => i.id === seleccion.id_insumo);
        if (!insumoCatalogo) return;

        const linea: PresupuestoTarjetaInsumoApu = {
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
        if (!tarjeta) return;
        setTarjeta({ ...tarjeta, insumos: (tarjeta.insumos || []).filter((i) => !(i.id_insumo === id_insumo && i.tipo === tipo)) });
    };

    const cambiarCantidadInsumo = (id_insumo: number, tipo: TipoInsumoApu, cantidad: number) => {
        if (!tarjeta) return;
        setTarjeta({ ...tarjeta, insumos: (tarjeta.insumos || []).map((i) => (i.id_insumo === id_insumo && i.tipo === tipo ? { ...i, cantidad } : i)) });
    };

    const actionBodyTemplate = (row: PresupuestoTarjetaApu) => <Button icon="pi pi-pencil" rounded severity="info" onClick={() => editTarjeta(row)} tooltip="Editar" tooltipOptions={{ position: 'top' }} />;

    const renderSeccionInsumos = (tipo: TipoInsumoApu) => {
        if (!tarjeta) return null;
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
                        body={(row: PresupuestoTarjetaInsumoApu) => (
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
                    <Column header="Precio Unitario" style={{ width: '130px' }} body={(row: PresupuestoTarjetaInsumoApu) => formatMoney(row.precio_unitario)}></Column>
                    <Column header="Importe" style={{ width: '130px' }} body={(row: PresupuestoTarjetaInsumoApu) => formatMoney((row.cantidad || 0) * (row.precio_unitario || 0))}></Column>
                    <Column header="" style={{ width: '60px' }} body={(row: PresupuestoTarjetaInsumoApu) => <Button icon="pi pi-trash" rounded text severity="danger" onClick={() => quitarInsumo(row.id_insumo, tipo)} />}></Column>
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
                        <InputNumber value={nuevoInsumo[tipo].cantidad} onValueChange={(e) => setNuevoInsumo({ ...nuevoInsumo, [tipo]: { ...nuevoInsumo[tipo], cantidad: e.value || 0 } })} mode="decimal" minFractionDigits={2} maxFractionDigits={4} min={0} />
                    </div>
                    <Button icon="pi pi-plus" label="Agregar" onClick={() => agregarInsumo(tipo)} />
                </div>
            </div>
        );
    };

    const dialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={save} loading={guardando} />
        </>
    );

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <h5 className="m-0 mb-1">Tarjetas de Precio Unitario por Presupuesto</h5>
                    <p className="m-0 mb-3 text-500">Cada presupuesto guarda su propia copia editable de las tarjetas: cambiarlas aquí no afecta el catálogo maestro de Tarjetas de Precio Unitario, y al guardar se recalcula el total de este presupuesto.</p>

                    <div className="field md:w-8 mb-4">
                        <label>Presupuesto</label>
                        <Dropdown
                            value={idPresupuesto}
                            options={presupuestos}
                            optionLabel="nombre"
                            optionValue="id"
                            filter
                            disabled={loading}
                            placeholder="Selecciona un presupuesto"
                            onChange={(e) => seleccionarPresupuesto(e.value)}
                            className="w-full"
                        />
                    </div>

                    <DataTable value={tarjetas} loading={cargandoTarjetas} emptyMessage="Selecciona un presupuesto para ver sus tarjetas." responsiveLayout="scroll">
                        <Column field="concepto_clave" header="Clave" sortable style={{ width: '110px' }}></Column>
                        <Column field="concepto_descripcion" header="Concepto" sortable></Column>
                        <Column field="concepto_unidad" header="Unidad" sortable style={{ width: '90px' }}></Column>
                        <Column field="costo_directo" header="Costo Directo" sortable body={(r: PresupuestoTarjetaApu) => formatMoney(r.costo_directo)} style={{ width: '140px' }}></Column>
                        <Column field="pct_material" header="% Material" sortable body={(r: PresupuestoTarjetaApu) => formatPct(r.pct_material)} style={{ width: '110px' }}></Column>
                        <Column field="pct_mano_obra" header="% M.O." sortable body={(r: PresupuestoTarjetaApu) => formatPct(r.pct_mano_obra)} style={{ width: '100px' }}></Column>
                        <Column field="precio_unitario" header="Precio Unitario" sortable body={(r: PresupuestoTarjetaApu) => formatMoney(r.precio_unitario)} style={{ width: '150px' }}></Column>
                        <Column body={actionBodyTemplate} headerStyle={{ minWidth: '6rem' }}></Column>
                    </DataTable>

                    {tarjeta && totales && (
                        <Dialog visible={dialogVisible} style={{ width: '95vw', maxWidth: '1100px' }} header={`Tarjeta del Presupuesto — ${tarjeta.concepto_descripcion}`} modal className="p-fluid" footer={dialogFooter} onHide={hideDialog}>
                            <TabView>
                                <TabPanel header="Datos Generales">
                                    <div className="grid">
                                        <div className="col-12">
                                            <div className="field">
                                                <label>Concepto</label>
                                                <p className="m-0 p-2 surface-100 border-round">
                                                    <b>{tarjeta.concepto_clave}</b> — {tarjeta.concepto_descripcion} ({tarjeta.concepto_unidad})
                                                </p>
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Rendimiento (unidades/jornada)</label>
                                                <InputNumber value={tarjeta.rendimiento} onValueChange={(e) => setTarjeta({ ...tarjeta, rendimiento: e.value || 0 })} mode="decimal" minFractionDigits={2} maxFractionDigits={4} min={0} />
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
                    )}
                </div>
            </div>
        </div>
    );
};

export default TarjetasPorPresupuestoApuCrud;
