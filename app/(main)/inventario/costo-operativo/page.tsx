'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Calendar } from 'primereact/calendar';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { TabView, TabPanel } from 'primereact/tabview';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { DataTableFilterMeta } from 'primereact/datatable';
import {
    fetchCostoOperativoUnidades,
    fetchDetalleUnidad,
    crearCostoOtro,
    eliminarCostoOtro,
    exportarHojaDeVidaExcel,
    CostoOperativoUnidad,
    DetalleRefaccion,
    DetalleManoObra,
    DetalleCombustible,
    CostoOtro
} from '../../../../Services/BD/costoOperativo/costoOperativoService';
import { getUserNombreFromLocalStorage } from '../../../../Services/BD/userService';

const formatoMoneda = (valor: number) => (valor || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const CostoOperativoPage = () => {
    const [unidades, setUnidades] = useState<CostoOperativoUnidad[]>([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const toast = useRef<Toast>(null);

    const [detalleVisible, setDetalleVisible] = useState(false);
    const [unidadSeleccionada, setUnidadSeleccionada] = useState<CostoOperativoUnidad | null>(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [refaccionesTodas, setRefaccionesTodas] = useState<DetalleRefaccion[]>([]);
    const [manoObraTodas, setManoObraTodas] = useState<DetalleManoObra[]>([]);
    const [combustibleTodo, setCombustibleTodo] = useState<DetalleCombustible[]>([]);
    const [otrosTodos, setOtrosTodos] = useState<CostoOtro[]>([]);
    const [exportando, setExportando] = useState(false);

    // Filtro de periodo dentro del detalle
    const [tipoFiltroPeriodo, setTipoFiltroPeriodo] = useState<'todo' | 'mes' | 'rango'>('todo');
    const [mesFiltro, setMesFiltro] = useState<Date>(new Date());
    const [rangoFiltro, setRangoFiltro] = useState<Date[] | null>(null);

    // Formulario para agregar un "otro" costo
    const [nuevoConcepto, setNuevoConcepto] = useState('');
    const [nuevoMonto, setNuevoMonto] = useState<number | null>(null);
    const [nuevaFecha, setNuevaFecha] = useState<Date>(new Date());
    const [guardandoOtro, setGuardandoOtro] = useState(false);

    const cargar = async () => {
        setLoading(true);
        try {
            const data = await fetchCostoOperativoUnidades();
            setUnidades(data);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    const cargarDetalle = async (unidad: CostoOperativoUnidad) => {
        setCargandoDetalle(true);
        try {
            const detalle = await fetchDetalleUnidad(unidad.tipoEquipo, unidad.id);
            setRefaccionesTodas(detalle.refacciones);
            setManoObraTodas(detalle.manoObra);
            setCombustibleTodo(detalle.combustible);
            setOtrosTodos(detalle.otros);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setCargandoDetalle(false);
        }
    };

    const verDetalle = (unidad: CostoOperativoUnidad) => {
        setUnidadSeleccionada(unidad);
        setDetalleVisible(true);
        setNuevoConcepto('');
        setNuevoMonto(null);
        setNuevaFecha(new Date());
        setTipoFiltroPeriodo('todo');
        setMesFiltro(new Date());
        setRangoFiltro(null);
        cargarDetalle(unidad);
    };

    const guardarOtro = async () => {
        if (!unidadSeleccionada || !nuevoConcepto.trim() || !nuevoMonto) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Concepto y monto son requeridos', life: 3000 });
            return;
        }
        setGuardandoOtro(true);
        try {
            await crearCostoOtro({
                tipo_equipo: unidadSeleccionada.tipoEquipo,
                camion_id: unidadSeleccionada.tipoEquipo === 'camion' ? unidadSeleccionada.id : null,
                maquinaria_id: unidadSeleccionada.tipoEquipo === 'maquinaria' ? unidadSeleccionada.id : null,
                concepto: nuevoConcepto.trim(),
                monto: nuevoMonto,
                fecha: nuevaFecha.toISOString(),
                registrado_por: getUserNombreFromLocalStorage()
            });
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Costo agregado', life: 3000 });
            setNuevoConcepto('');
            setNuevoMonto(null);
            setNuevaFecha(new Date());
            await cargarDetalle(unidadSeleccionada);
            cargar();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setGuardandoOtro(false);
        }
    };

    const eliminarOtro = async (id?: number) => {
        if (!id || !unidadSeleccionada) return;
        try {
            await eliminarCostoOtro(id);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Costo eliminado', life: 3000 });
            await cargarDetalle(unidadSeleccionada);
            cargar();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const exportar = async () => {
        if (!unidadSeleccionada) return;
        setExportando(true);
        try {
            await exportarHojaDeVidaExcel(unidadSeleccionada, { refacciones, manoObra, combustible, otros }, etiquetaPeriodo);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setExportando(false);
        }
    };

    // ¿la fecha cae dentro del periodo elegido (mes/año o rango de fechas)?
    const dentroDelPeriodo = (fechaStr: string): boolean => {
        if (!fechaStr) return false;
        const fecha = new Date(fechaStr);

        if (tipoFiltroPeriodo === 'mes') {
            return fecha.getFullYear() === mesFiltro.getFullYear() && fecha.getMonth() === mesFiltro.getMonth();
        }

        if (tipoFiltroPeriodo === 'rango' && rangoFiltro && rangoFiltro[0]) {
            const inicio = new Date(rangoFiltro[0]);
            inicio.setHours(0, 0, 0, 0);
            const fin = new Date(rangoFiltro[1] || rangoFiltro[0]);
            fin.setHours(23, 59, 59, 999);
            return fecha >= inicio && fecha <= fin;
        }

        return true; // 'todo'
    };

    const esMesActual = (fechaStr: string): boolean => {
        if (!fechaStr) return false;
        const fecha = new Date(fechaStr);
        const ahora = new Date();
        return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth();
    };

    const refacciones = useMemo(() => refaccionesTodas.filter(r => dentroDelPeriodo(r.fecha)), [refaccionesTodas, tipoFiltroPeriodo, mesFiltro, rangoFiltro]);
    const manoObra = useMemo(() => manoObraTodas.filter(m => dentroDelPeriodo(m.fecha)), [manoObraTodas, tipoFiltroPeriodo, mesFiltro, rangoFiltro]);
    const combustible = useMemo(() => combustibleTodo.filter(c => dentroDelPeriodo(c.fecha)), [combustibleTodo, tipoFiltroPeriodo, mesFiltro, rangoFiltro]);
    const otros = useMemo(() => otrosTodos.filter(o => dentroDelPeriodo(o.fecha)), [otrosTodos, tipoFiltroPeriodo, mesFiltro, rangoFiltro]);

    // Gasto del mes en curso, siempre visible sin importar el filtro seleccionado
    const totalMesActual = useMemo(() => {
        const refac = refaccionesTodas.filter(r => esMesActual(r.fecha)).reduce((acc, r) => acc + r.total, 0);
        const mano = manoObraTodas.filter(m => esMesActual(m.fecha)).reduce((acc, m) => acc + m.costo, 0);
        const comb = combustibleTodo.filter(c => esMesActual(c.fecha)).reduce((acc, c) => acc + c.importe, 0);
        const otr = otrosTodos.filter(o => esMesActual(o.fecha)).reduce((acc, o) => acc + o.monto, 0);
        return refac + mano + comb + otr;
    }, [refaccionesTodas, manoObraTodas, combustibleTodo, otrosTodos]);

    const nombreMesActual = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

    const etiquetaPeriodo = useMemo(() => {
        if (tipoFiltroPeriodo === 'mes') {
            return mesFiltro.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
        }
        if (tipoFiltroPeriodo === 'rango' && rangoFiltro && rangoFiltro[0]) {
            const inicio = rangoFiltro[0].toLocaleDateString('es-MX');
            const fin = (rangoFiltro[1] || rangoFiltro[0]).toLocaleDateString('es-MX');
            return `${inicio} a ${fin}`;
        }
        return 'Todo el historial';
    }, [tipoFiltroPeriodo, mesFiltro, rangoFiltro]);

    const tipoBodyTemplate = (row: CostoOperativoUnidad) => (
        <div className="flex align-items-center gap-2">
            <i className={row.tipoEquipo === 'camion' ? 'pi pi-car' : 'pi pi-cog'} />
            <span>{row.tipoLabel}</span>
        </div>
    );

    const montoBodyTemplate = (valor: number) => <span>{formatoMoneda(valor)}</span>;

    const totalBodyTemplate = (row: CostoOperativoUnidad) => <b>{formatoMoneda(row.total)}</b>;

    const detalleBodyTemplate = (row: CostoOperativoUnidad) => (
        <Button label="Detalles" icon="pi pi-search" text onClick={() => verDetalle(row)} />
    );

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Costo Operativo de Unidad</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })} placeholder="Buscar..." />
            </span>
        </div>
    );

    const totalManoObra = manoObra.reduce((acc, m) => acc + m.costo, 0);
    const totalCombustible = combustible.reduce((acc, c) => acc + c.importe, 0);
    const totalRefacciones = refacciones.reduce((acc, r) => acc + r.total, 0);
    const totalOtros = otros.reduce((acc, o) => acc + o.monto, 0);

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={() => <h6 className="m-0 text-500">Hoja de vida de costos por camión y maquinaria</h6>} right={() => <Button icon="pi pi-refresh" text onClick={cargar} tooltip="Actualizar" />} />

                    <DataTable
                        value={unidades}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[10, 25, 50]}
                        loading={loading}
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No hay unidades registradas"
                        header={header}
                        sortField="total"
                        sortOrder={-1}
                        responsiveLayout="scroll"
                    >
                        <Column header="Tipo" body={tipoBodyTemplate} sortable field="tipoLabel" style={{ width: '130px' }} />
                        <Column field="unidad" header="Unidad" sortable style={{ minWidth: '200px' }} />
                        <Column field="refacciones" header="Refacciones" body={(r) => montoBodyTemplate(r.refacciones)} sortable style={{ width: '150px' }} />
                        <Column field="manoObra" header="Mano de Obra" body={(r) => montoBodyTemplate(r.manoObra)} sortable style={{ width: '150px' }} />
                        <Column field="combustible" header="Combustible" body={(r) => montoBodyTemplate(r.combustible)} sortable style={{ width: '150px' }} />
                        <Column field="otros" header="Otros" body={(r) => montoBodyTemplate(r.otros)} sortable style={{ width: '150px' }} />
                        <Column field="total" header="Total" body={totalBodyTemplate} sortable style={{ width: '160px' }} />
                        <Column header="" body={detalleBodyTemplate} style={{ width: '130px' }} />
                    </DataTable>

                    <Dialog
                        visible={detalleVisible}
                        style={{ width: '900px' }}
                        header={unidadSeleccionada ? `Hoja de Vida — ${unidadSeleccionada.unidad}` : 'Detalle'}
                        modal
                        onHide={() => setDetalleVisible(false)}
                    >
                        {unidadSeleccionada && (
                            <>
                                <div className="flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                                    <div className="flex align-items-center gap-2">
                                        <Tag severity="info" value={unidadSeleccionada.tipoLabel} />
                                        <span className="text-500">{unidadSeleccionada.referencia}</span>
                                        <span className="font-bold ml-3">Total histórico: {formatoMoneda(unidadSeleccionada.total)}</span>
                                    </div>
                                    <Button label={`Exportar a Excel (${etiquetaPeriodo})`} icon="pi pi-file-excel" severity="success" loading={exportando} onClick={exportar} />
                                </div>

                                <div className="card mb-3" style={{ background: 'var(--orange-50)', border: '1px solid var(--orange-200)' }}>
                                    <div className="flex justify-content-between align-items-center">
                                        <div>
                                            <span className="block text-500 font-medium mb-2">Gasto en el mes en curso ({nombreMesActual})</span>
                                            <div className="text-900 font-bold text-2xl">{formatoMoneda(totalMesActual)}</div>
                                        </div>
                                        <div className="flex align-items-center justify-content-center bg-orange-100 border-round" style={{ width: '3rem', height: '3rem' }}>
                                            <i className="pi pi-calendar text-orange-500 text-2xl" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex align-items-center flex-wrap gap-3 mb-4">
                                    <Dropdown
                                        value={tipoFiltroPeriodo}
                                        onChange={(e) => setTipoFiltroPeriodo(e.value)}
                                        options={[
                                            { label: 'Todo el historial', value: 'todo' },
                                            { label: 'Por mes', value: 'mes' },
                                            { label: 'Rango de fechas', value: 'rango' }
                                        ]}
                                        style={{ minWidth: '180px' }}
                                    />

                                    {tipoFiltroPeriodo === 'mes' && (
                                        <Calendar value={mesFiltro} onChange={(e) => setMesFiltro(e.value as Date)} view="month" dateFormat="mm/yy" showIcon />
                                    )}

                                    {tipoFiltroPeriodo === 'rango' && (
                                        <Calendar
                                            value={rangoFiltro}
                                            onChange={(e) => setRangoFiltro((e.value as Date[]) || null)}
                                            selectionMode="range"
                                            readOnlyInput
                                            dateFormat="yy-mm-dd"
                                            placeholder="Selecciona el rango"
                                            showIcon
                                        />
                                    )}

                                    {tipoFiltroPeriodo !== 'todo' && (
                                        <span className="font-bold">
                                            Total del periodo: {formatoMoneda(refacciones.reduce((a, r) => a + r.total, 0) + manoObra.reduce((a, m) => a + m.costo, 0) + combustible.reduce((a, c) => a + c.importe, 0) + otros.reduce((a, o) => a + o.monto, 0))}
                                        </span>
                                    )}
                                </div>

                                <TabView>
                                    <TabPanel header={`Refacciones (${formatoMoneda(totalRefacciones)})`}>
                                        <DataTable value={refacciones} loading={cargandoDetalle} emptyMessage="Sin refacciones registradas" responsiveLayout="scroll" size="small">
                                            <Column field="fecha" header="Fecha" body={(r: DetalleRefaccion) => new Date(r.fecha).toLocaleDateString('es-MX')} style={{ width: '110px' }} />
                                            <Column field="producto" header="Producto" />
                                            <Column field="cantidad" header="Cant." style={{ width: '80px' }} />
                                            <Column field="costoUnitario" header="Costo Unit." body={(r: DetalleRefaccion) => formatoMoneda(r.costoUnitario)} style={{ width: '120px' }} />
                                            <Column field="total" header="Total" body={(r: DetalleRefaccion) => formatoMoneda(r.total)} style={{ width: '120px' }} />
                                            <Column field="ordenTrabajo" header="Orden de Trabajo" style={{ width: '150px' }} />
                                            <Column field="motivo" header="Motivo" />
                                        </DataTable>
                                    </TabPanel>

                                    <TabPanel header={`Mano de Obra (${formatoMoneda(totalManoObra)})`}>
                                        <DataTable value={manoObra} loading={cargandoDetalle} emptyMessage="Sin mano de obra registrada" responsiveLayout="scroll" size="small">
                                            <Column field="fecha" header="Fecha" body={(r: DetalleManoObra) => new Date(r.fecha).toLocaleDateString('es-MX')} style={{ width: '110px' }} />
                                            <Column field="motivo" header="Motivo" />
                                            <Column field="tecnicoAsignado" header="Técnico" style={{ width: '150px' }} />
                                            <Column field="esTallerExterno" header="Taller Externo" body={(r: DetalleManoObra) => (r.esTallerExterno ? <Tag severity="warning" value="Externo" /> : '-')} style={{ width: '130px' }} />
                                            <Column field="costo" header="Costo" body={(r: DetalleManoObra) => formatoMoneda(r.costo)} style={{ width: '120px' }} />
                                        </DataTable>
                                    </TabPanel>

                                    <TabPanel header={`Combustible (${formatoMoneda(totalCombustible)})`}>
                                        <DataTable value={combustible} loading={cargandoDetalle} emptyMessage="Sin combustible registrado" responsiveLayout="scroll" size="small">
                                            <Column field="fecha" header="Fecha" body={(r: DetalleCombustible) => new Date(r.fecha).toLocaleDateString('es-MX')} style={{ width: '110px' }} />
                                            <Column field="litros" header="Litros" style={{ width: '100px' }} />
                                            <Column field="importe" header="Importe" body={(r: DetalleCombustible) => formatoMoneda(r.importe)} style={{ width: '120px' }} />
                                        </DataTable>
                                    </TabPanel>

                                    <TabPanel header={`Otros (${formatoMoneda(totalOtros)})`}>
                                        <div className="grid mb-3">
                                            <div className="col-5">
                                                <InputText placeholder="¿En qué se gastó?" value={nuevoConcepto} onChange={(e) => setNuevoConcepto(e.target.value)} className="w-full" />
                                            </div>
                                            <div className="col-3">
                                                <Calendar value={nuevaFecha} onChange={(e) => setNuevaFecha(e.value as Date)} dateFormat="yy-mm-dd" showIcon className="w-full" />
                                            </div>
                                            <div className="col-2">
                                                <InputNumber placeholder="Monto" value={nuevoMonto} onValueChange={(e) => setNuevoMonto(e.value ?? null)} mode="currency" currency="MXN" locale="es-MX" min={0} className="w-full" />
                                            </div>
                                            <div className="col-2">
                                                <Button label="Agregar" icon="pi pi-plus" className="w-full" loading={guardandoOtro} onClick={guardarOtro} />
                                            </div>
                                        </div>
                                        <DataTable value={otros} loading={cargandoDetalle} emptyMessage="Sin otros costos registrados" responsiveLayout="scroll" size="small">
                                            <Column field="fecha" header="Fecha" body={(r: CostoOtro) => new Date(r.fecha).toLocaleDateString('es-MX')} style={{ width: '110px' }} />
                                            <Column field="concepto" header="¿En qué se gastó?" />
                                            <Column field="registrado_por" header="Registrado por" style={{ width: '150px' }} />
                                            <Column field="monto" header="Monto" body={(r: CostoOtro) => formatoMoneda(r.monto)} style={{ width: '120px' }} />
                                            <Column header="" body={(r: CostoOtro) => <Button icon="pi pi-trash" text severity="danger" onClick={() => eliminarOtro(r.id)} />} style={{ width: '60px' }} />
                                        </DataTable>
                                    </TabPanel>
                                </TabView>
                            </>
                        )}
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default CostoOperativoPage;
