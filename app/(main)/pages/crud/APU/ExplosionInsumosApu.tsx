'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { TabPanel, TabView } from 'primereact/tabview';
import { Toast } from 'primereact/toast';
import React, { useEffect, useRef, useState } from 'react';
import { calcularTomaDeCantidades, ConceptoCantidadApu, exportarExplosionInsumosExcel, fetchExplosionInsumosTarjeta, InsumoExplosionApu } from '../../../../../Services/BD/apu/explosionInsumosApuService';
import { fetchTarjetasApu, TarjetaApu, TarjetaInsumoApu } from '../../../../../Services/BD/apu/tarjetasApuService';

const formatMoney = (v = 0) => `$ ${v.toFixed(2)}`;

const ExplosionInsumosApu = () => {
    const [tarjetas, setTarjetas] = useState<TarjetaApu[]>([]);
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);

    // Sección 1: explosión de una sola tarjeta
    const [idTarjetaSeleccionada, setIdTarjetaSeleccionada] = useState<number | null>(null);
    const [insumosTarjeta, setInsumosTarjeta] = useState<TarjetaInsumoApu[]>([]);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);

    // Sección 2: toma de cantidades (multi-concepto)
    const [conceptosSeleccionados, setConceptosSeleccionados] = useState<ConceptoCantidadApu[]>([]);
    const [idConceptoParaAgregar, setIdConceptoParaAgregar] = useState<number | null>(null);
    const [cantidadParaAgregar, setCantidadParaAgregar] = useState<number>(0);
    const [resultadoTomaCantidades, setResultadoTomaCantidades] = useState<InsumoExplosionApu[]>([]);
    const [calculando, setCalculando] = useState(false);

    const cargar = async () => {
        setLoading(true);
        try {
            setTarjetas(await fetchTarjetasApu());
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar los conceptos con tarjeta', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    const seleccionarTarjeta = async (id: number | null) => {
        setIdTarjetaSeleccionada(id);
        if (!id) {
            setInsumosTarjeta([]);
            return;
        }
        setCargandoDetalle(true);
        try {
            setInsumosTarjeta(await fetchExplosionInsumosTarjeta(id));
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar la explosión de insumos', life: 3000 });
        } finally {
            setCargandoDetalle(false);
        }
    };

    const agregarConceptoATomaDeCantidades = () => {
        if (!idConceptoParaAgregar || cantidadParaAgregar <= 0) return;
        if (conceptosSeleccionados.some((c) => c.id_tarjeta === idConceptoParaAgregar)) return;

        const tarjeta = tarjetas.find((t) => t.id === idConceptoParaAgregar);
        if (!tarjeta) return;

        setConceptosSeleccionados((prev) => [
            ...prev,
            {
                id_tarjeta: idConceptoParaAgregar,
                concepto_clave: tarjeta.concepto_clave || '',
                concepto_descripcion: tarjeta.concepto_descripcion || '',
                cantidad: cantidadParaAgregar
            }
        ]);
        setIdConceptoParaAgregar(null);
        setCantidadParaAgregar(0);
        setResultadoTomaCantidades([]);
    };

    const quitarConceptoDeTomaDeCantidades = (id_tarjeta: number) => {
        setConceptosSeleccionados((prev) => prev.filter((c) => c.id_tarjeta !== id_tarjeta));
        setResultadoTomaCantidades([]);
    };

    const calcularTotales = async () => {
        if (conceptosSeleccionados.length === 0) return;
        setCalculando(true);
        try {
            setResultadoTomaCantidades(await calcularTomaDeCantidades(conceptosSeleccionados));
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al calcular la toma de cantidades', life: 3000 });
        } finally {
            setCalculando(false);
        }
    };

    const importeTotalTarjeta = insumosTarjeta.reduce((acc, i) => acc + (i.cantidad || 0) * (i.precio_unitario || 0), 0);

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <h5 className="m-0 mb-3">Explosión de Insumos</h5>

                    <TabView>
                        <TabPanel header="Por Tarjeta">
                            <div className="field md:w-6">
                                <label>Concepto</label>
                                <Dropdown
                                    value={idTarjetaSeleccionada}
                                    options={tarjetas}
                                    optionLabel="concepto_descripcion"
                                    optionValue="id"
                                    filter
                                    disabled={loading}
                                    placeholder="Selecciona un concepto con tarjeta"
                                    onChange={(e) => seleccionarTarjeta(e.value)}
                                    className="w-full"
                                />
                            </div>

                            <DataTable value={insumosTarjeta} loading={cargandoDetalle} emptyMessage="Selecciona un concepto para ver su explosión de insumos." className="mt-3">
                                <Column field="insumo_clave" header="Clave" style={{ width: '110px' }}></Column>
                                <Column field="insumo_descripcion" header="Descripción"></Column>
                                <Column field="tipo" header="Tipo" style={{ width: '140px' }}></Column>
                                <Column field="insumo_unidad" header="Unidad" style={{ width: '90px' }}></Column>
                                <Column field="cantidad" header="Cantidad" style={{ width: '110px' }} body={(r: TarjetaInsumoApu) => r.cantidad.toFixed(4)}></Column>
                                <Column field="precio_unitario" header="Precio Unitario" style={{ width: '130px' }} body={(r: TarjetaInsumoApu) => formatMoney(r.precio_unitario)}></Column>
                                <Column header="Importe" style={{ width: '130px' }} body={(r: TarjetaInsumoApu) => formatMoney((r.cantidad || 0) * (r.precio_unitario || 0))}></Column>
                            </DataTable>

                            {insumosTarjeta.length > 0 && (
                                <div className="flex justify-content-between align-items-center mt-3">
                                    <span className="font-bold">Total: {formatMoney(importeTotalTarjeta)}</span>
                                    <Button
                                        label="Exportar a Excel"
                                        icon="pi pi-file-excel"
                                        severity="success"
                                        onClick={() => exportarExplosionInsumosExcel(insumosTarjeta.map((i) => ({ id_insumo: i.id_insumo, clave: i.insumo_clave || '', descripcion: i.insumo_descripcion || '', tipo: i.tipo, unidad: i.insumo_unidad || '', cantidad_total: i.cantidad, precio_unitario: i.precio_unitario, importe_total: (i.cantidad || 0) * (i.precio_unitario || 0) })))}
                                    />
                                </div>
                            )}
                        </TabPanel>

                        <TabPanel header="Toma de Cantidades (varios conceptos)">
                            <p className="text-500 mt-0">Combina varios conceptos con la cantidad de obra a ejecutar para saber el total de cada insumo que se necesita comprar. No se guarda en la base de datos.</p>

                            <div className="flex gap-2 align-items-end mb-3">
                                <div className="flex-grow-1">
                                    <label className="block text-sm mb-1">Concepto</label>
                                    <Dropdown
                                        value={idConceptoParaAgregar}
                                        options={tarjetas.filter((t) => !conceptosSeleccionados.some((c) => c.id_tarjeta === t.id))}
                                        optionLabel="concepto_descripcion"
                                        optionValue="id"
                                        filter
                                        placeholder="Selecciona un concepto"
                                        onChange={(e) => setIdConceptoParaAgregar(e.value)}
                                        className="w-full"
                                    />
                                </div>
                                <div style={{ width: '180px' }}>
                                    <label className="block text-sm mb-1">Cantidad de Obra</label>
                                    <InputNumber value={cantidadParaAgregar} onValueChange={(e) => setCantidadParaAgregar(e.value || 0)} mode="decimal" minFractionDigits={2} min={0} />
                                </div>
                                <Button icon="pi pi-plus" label="Agregar" onClick={agregarConceptoATomaDeCantidades} />
                            </div>

                            <DataTable value={conceptosSeleccionados} emptyMessage="Agrega conceptos para combinarlos." className="mb-3">
                                <Column field="concepto_clave" header="Clave" style={{ width: '110px' }}></Column>
                                <Column field="concepto_descripcion" header="Concepto"></Column>
                                <Column field="cantidad" header="Cantidad" style={{ width: '120px' }}></Column>
                                <Column header="" style={{ width: '60px' }} body={(r: ConceptoCantidadApu) => <Button icon="pi pi-trash" rounded text severity="danger" onClick={() => quitarConceptoDeTomaDeCantidades(r.id_tarjeta)} />}></Column>
                            </DataTable>

                            <Button label="Calcular Total de Insumos" icon="pi pi-calculator" onClick={calcularTotales} loading={calculando} disabled={conceptosSeleccionados.length === 0} className="mb-3" />

                            {resultadoTomaCantidades.length > 0 && (
                                <>
                                    <DataTable value={resultadoTomaCantidades}>
                                        <Column field="clave" header="Clave" style={{ width: '110px' }}></Column>
                                        <Column field="descripcion" header="Descripción"></Column>
                                        <Column field="tipo" header="Tipo" style={{ width: '140px' }}></Column>
                                        <Column field="unidad" header="Unidad" style={{ width: '90px' }}></Column>
                                        <Column field="cantidad_total" header="Cantidad Total" style={{ width: '130px' }} body={(r: InsumoExplosionApu) => r.cantidad_total.toFixed(4)}></Column>
                                        <Column field="precio_unitario" header="Precio Unitario" style={{ width: '130px' }} body={(r: InsumoExplosionApu) => formatMoney(r.precio_unitario)}></Column>
                                        <Column field="importe_total" header="Importe Total" style={{ width: '140px' }} body={(r: InsumoExplosionApu) => formatMoney(r.importe_total)}></Column>
                                    </DataTable>
                                    <div className="flex justify-content-end mt-3">
                                        <Button label="Exportar a Excel" icon="pi pi-file-excel" severity="success" onClick={() => exportarExplosionInsumosExcel(resultadoTomaCantidades, 'Toma_de_Cantidades')} />
                                    </div>
                                </>
                            )}
                        </TabPanel>
                    </TabView>
                </div>
            </div>
        </div>
    );
};

export default ExplosionInsumosApu;
