"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { ProgressBar } from 'primereact/progressbar';
import * as XLSX from 'xlsx';
import {
    fetchValidacionEnProceso,
    iniciarValidacionInventario,
    fetchDetalleValidacion,
    marcarProductoConforme,
    marcarProductoDiscrepancia,
    finalizarValidacionInventario,
    ValidacionInventario,
    DetalleValidacionInventario
} from '../../../../Services/BD/inventario/validacionInventarioService';

const ValidacionInventarioPage = () => {
    const [validacion, setValidacion] = useState<ValidacionInventario | null>(null);
    const [detalles, setDetalles] = useState<DetalleValidacionInventario[]>([]);
    const [loading, setLoading] = useState(true);
    const [iniciando, setIniciando] = useState(false);

    const [filasEditando, setFilasEditando] = useState<Set<number>>(new Set());
    const [valoresFisicos, setValoresFisicos] = useState<Record<number, number | null>>({});

    const [busqueda, setBusqueda] = useState('');
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);

    const [reporteDialog, setReporteDialog] = useState(false);
    const [discrepanciasReporte, setDiscrepanciasReporte] = useState<DetalleValidacionInventario[]>([]);
    const [finalizando, setFinalizando] = useState(false);
    const [finalizada, setFinalizada] = useState(false);

    const toast = useRef<Toast>(null);

    useEffect(() => {
        cargarValidacionExistente();
    }, []);

    const cargarValidacionExistente = async () => {
        setLoading(true);
        try {
            const activa = await fetchValidacionEnProceso();
            if (activa) {
                setValidacion(activa);
                const data = await fetchDetalleValidacion(activa.id);
                setDetalles(data);
            }
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 });
        } finally {
            setLoading(false);
        }
    };

    const iniciarValidacion = async () => {
        setIniciando(true);
        try {
            const usuarioData = typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
            const usuario = usuarioData ? JSON.parse(usuarioData) : null;
            const usuarioNombre = usuario ? `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() : undefined;

            const nuevaValidacion = await iniciarValidacionInventario(usuarioNombre);
            setValidacion(nuevaValidacion);
            const data = await fetchDetalleValidacion(nuevaValidacion.id);
            setDetalles(data);
            setFinalizada(false);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 });
        } finally {
            setIniciando(false);
        }
    };

    const marcarConforme = async (detalle: DetalleValidacionInventario) => {
        try {
            await marcarProductoConforme(detalle.id, detalle.stock_sistema);
            setDetalles((prev) => prev.map((d) => (d.id === detalle.id ? { ...d, stock_fisico: detalle.stock_sistema, diferencia: 0, estatus: 'Conforme' } : d)));
            setFilasEditando((prev) => {
                const nuevo = new Set(prev);
                nuevo.delete(detalle.id);
                return nuevo;
            });
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 });
        }
    };

    const abrirEdicionDiscrepancia = (detalle: DetalleValidacionInventario) => {
        setValoresFisicos((prev) => ({ ...prev, [detalle.id]: detalle.stock_fisico ?? null }));
        setFilasEditando((prev) => new Set(prev).add(detalle.id));
    };

    const cancelarEdicion = (id: number) => {
        setFilasEditando((prev) => {
            const nuevo = new Set(prev);
            nuevo.delete(id);
            return nuevo;
        });
    };

    const confirmarDiscrepancia = async (detalle: DetalleValidacionInventario) => {
        const valor = valoresFisicos[detalle.id];
        if (valor === null || valor === undefined || valor < 0) {
            toast.current?.show({ severity: 'warn', summary: 'Falta cantidad', detail: 'Captura la cantidad física contada.', life: 3000 });
            return;
        }
        try {
            await marcarProductoDiscrepancia(detalle.id, detalle.stock_sistema, valor);
            setDetalles((prev) => prev.map((d) => (d.id === detalle.id ? { ...d, stock_fisico: valor, diferencia: detalle.stock_sistema - valor, estatus: 'Discrepancia' } : d)));
            cancelarEdicion(detalle.id);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 });
        }
    };

    const finalizarValidacion = async () => {
        if (!validacion) return;
        setFinalizando(true);
        try {
            const resultado = await finalizarValidacionInventario(validacion.id);
            setDiscrepanciasReporte(resultado.discrepancias);
            setValidacion(resultado.validacion);
            setFinalizada(true);
            setReporteDialog(true);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 });
        } finally {
            setFinalizando(false);
        }
    };

    const nuevaValidacionDesdeCero = () => {
        setValidacion(null);
        setDetalles([]);
        setFinalizada(false);
        setDiscrepanciasReporte([]);
        setBusqueda('');
        setCategoriaSeleccionada(null);
    };

    const diferenciaLabel = (d: DetalleValidacionInventario) => {
        if (d.diferencia === null || d.diferencia === undefined) return '';
        const unidad = d.inventario?.unidad || '';
        if (d.diferencia > 0) return `Faltan ${d.diferencia} ${unidad}`;
        if (d.diferencia < 0) return `Sobran ${Math.abs(d.diferencia)} ${unidad}`;
        return 'Exacto';
    };

    const exportarReporteExcel = (datos: DetalleValidacionInventario[]) => {
        const filas = datos.map((d) => ({
            Código: d.inventario?.codigo || '',
            Producto: d.inventario?.nombre || '',
            Categoría: d.inventario?.categoria || '',
            'Stock Sistema': d.stock_sistema,
            'Stock Físico': d.stock_fisico,
            Diferencia: d.diferencia,
            Detalle: diferenciaLabel(d)
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(filas);
        XLSX.utils.book_append_sheet(wb, ws, 'Discrepancias');
        XLSX.writeFile(wb, `Validacion_Inventario_${validacion?.id || ''}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const categorias = useMemo(() => {
        const cats = detalles.map((d) => d.inventario?.categoria).filter(Boolean) as string[];
        return Array.from(new Set(cats));
    }, [detalles]);

    const detallesFiltrados = useMemo(() => {
        return detalles.filter((d) => {
            const coincideBusqueda = !busqueda.trim() || d.inventario?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || d.inventario?.codigo?.toLowerCase().includes(busqueda.toLowerCase());
            const coincideCategoria = !categoriaSeleccionada || d.inventario?.categoria === categoriaSeleccionada;
            return coincideBusqueda && coincideCategoria;
        });
    }, [detalles, busqueda, categoriaSeleccionada]);

    const totales = useMemo(() => {
        const total = detalles.length;
        const conformes = detalles.filter((d) => d.estatus === 'Conforme').length;
        const discrepancias = detalles.filter((d) => d.estatus === 'Discrepancia').length;
        const pendientes = total - conformes - discrepancias;
        return { total, conformes, discrepancias, pendientes };
    }, [detalles]);

    const progreso = totales.total > 0 ? Math.round(((totales.conformes + totales.discrepancias) / totales.total) * 100) : 0;

    const estatusBodyTemplate = (d: DetalleValidacionInventario) => {
        const editando = filasEditando.has(d.id);
        if (editando) {
            return (
                <InputNumber
                    value={valoresFisicos[d.id] ?? null}
                    onValueChange={(e) => setValoresFisicos((prev) => ({ ...prev, [d.id]: e.value ?? null }))}
                    placeholder="Cantidad contada"
                    min={0}
                    className="w-full"
                    autoFocus
                />
            );
        }
        if (d.estatus === 'Conforme') {
            return <Tag severity="success" value={`Conforme (${d.stock_sistema} ${d.inventario?.unidad || ''})`} />;
        }
        if (d.estatus === 'Discrepancia') {
            return <Tag severity="danger" value={diferenciaLabel(d)} />;
        }
        return <span className="text-500">Pendiente</span>;
    };

    const accionesBodyTemplate = (d: DetalleValidacionInventario) => {
        const editando = filasEditando.has(d.id);
        if (editando) {
            return (
                <div className="flex gap-2 justify-content-end">
                    <Button icon="pi pi-check" rounded severity="danger" tooltip="Guardar discrepancia" onClick={() => confirmarDiscrepancia(d)} />
                    <Button icon="pi pi-times" rounded text severity="secondary" tooltip="Cancelar" onClick={() => cancelarEdicion(d.id)} />
                </div>
            );
        }
        return (
            <div className="flex gap-2 justify-content-end">
                <Button icon="pi pi-check" rounded severity="success" tooltip="El número coincide" onClick={() => marcarConforme(d)} />
                <Button icon="pi pi-times" rounded severity="danger" tooltip="No coincide" onClick={() => abrirEdicionDiscrepancia(d)} />
            </div>
        );
    };

    const reporteDialogFooter = (
        <div className="flex justify-content-between">
            <Button label="Cerrar" icon="pi pi-times" text onClick={() => setReporteDialog(false)} />
            <Button label="Exportar a Excel" icon="pi pi-file-excel" severity="success" onClick={() => exportarReporteExcel(discrepanciasReporte)} disabled={discrepanciasReporte.length === 0} />
        </div>
    );

    if (loading) {
        return (
            <div className="grid">
                <div className="col-12">
                    <div className="card flex justify-content-center p-6">
                        <i className="pi pi-spinner pi-spin text-3xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (!validacion || finalizada) {
        return (
            <div className="grid">
                <div className="col-12">
                    <div className="card flex flex-column align-items-center text-center p-6">
                        <i className="pi pi-verified text-6xl text-primary mb-3" />
                        <h5 className="m-0 mb-2">Validación de Inventario</h5>
                        {finalizada && validacion ? (
                            <>
                                <p className="text-500 mb-4" style={{ maxWidth: '480px' }}>
                                    Última validación finalizada: <strong>{totales.conformes}</strong> conformes y <strong>{totales.discrepancias}</strong> con discrepancia de {totales.total} productos.
                                </p>
                                <div className="flex gap-2">
                                    <Button label="Ver Último Reporte" icon="pi pi-file" severity="secondary" onClick={() => setReporteDialog(true)} />
                                    <Button label="Iniciar Nueva Validación" icon="pi pi-refresh" onClick={() => { nuevaValidacionDesdeCero(); iniciarValidacion(); }} loading={iniciando} />
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-500 mb-4" style={{ maxWidth: '480px' }}>
                                    Trae todo el inventario del sistema para pasar lista contra el conteo físico del almacén y detectar diferencias.
                                </p>
                                <Button label="Iniciar Nueva Validación" icon="pi pi-play" onClick={iniciarValidacion} loading={iniciando} />
                            </>
                        )}
                    </div>
                </div>

                <Dialog visible={reporteDialog} onHide={() => setReporteDialog(false)} header="Reporte de Discrepancias" style={{ width: '90vw', maxWidth: '900px' }} footer={reporteDialogFooter}>
                    <DataTable value={discrepanciasReporte} size="small" emptyMessage="No hubo discrepancias en la última validación">
                        <Column field="inventario.codigo" header="Código" style={{ width: '120px' }} />
                        <Column field="inventario.nombre" header="Producto" />
                        <Column field="inventario.categoria" header="Categoría" style={{ width: '150px' }} />
                        <Column field="stock_sistema" header="Sistema" style={{ width: '100px' }} />
                        <Column field="stock_fisico" header="Físico" style={{ width: '100px' }} />
                        <Column header="Detalle" body={diferenciaLabel} style={{ width: '160px' }} />
                    </DataTable>
                </Dialog>
                <Toast ref={toast} />
            </div>
        );
    }

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />

                    <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center gap-3 mb-3">
                        <div>
                            <h5 className="m-0">Validación de Inventario</h5>
                            <p className="m-0 text-500">Pasa lista del inventario del sistema contra el conteo físico del almacén.</p>
                        </div>
                        <Button label="Finalizar Validación" icon="pi pi-check-circle" severity="warning" onClick={finalizarValidacion} loading={finalizando} disabled={totales.pendientes > 0} />
                    </div>

                    <div className="grid mb-2">
                        <div className="col-6 md:col-3">
                            <div className="surface-card border-round p-3 text-center">
                                <span className="block text-500 font-medium mb-1">Total</span>
                                <div className="text-900 font-bold text-xl">{totales.total}</div>
                            </div>
                        </div>
                        <div className="col-6 md:col-3">
                            <div className="surface-card border-round p-3 text-center">
                                <span className="block text-500 font-medium mb-1">Pendientes</span>
                                <div className="text-900 font-bold text-xl">{totales.pendientes}</div>
                            </div>
                        </div>
                        <div className="col-6 md:col-3">
                            <div className="surface-card border-round p-3 text-center">
                                <span className="block text-green-600 font-medium mb-1">Conformes</span>
                                <div className="text-green-600 font-bold text-xl">{totales.conformes}</div>
                            </div>
                        </div>
                        <div className="col-6 md:col-3">
                            <div className="surface-card border-round p-3 text-center">
                                <span className="block text-red-600 font-medium mb-1">Discrepancias</span>
                                <div className="text-red-600 font-bold text-xl">{totales.discrepancias}</div>
                            </div>
                        </div>
                    </div>

                    <ProgressBar value={progreso} className="mb-4" style={{ height: '10px' }} />

                    {totales.pendientes > 0 && <small className="text-500 block mb-3">Debes validar todos los productos antes de poder finalizar.</small>}

                    <div className="flex flex-column md:flex-row gap-2 mb-3">
                        <span className="p-input-icon-left flex-1">
                            <i className="pi pi-search" />
                            <InputText value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por código o nombre..." className="w-full" />
                        </span>
                        <Dropdown value={categoriaSeleccionada} options={categorias.map((c) => ({ label: c, value: c }))} onChange={(e) => setCategoriaSeleccionada(e.value)} placeholder="Todas las categorías" showClear style={{ minWidth: '200px' }} />
                    </div>

                    <DataTable value={detallesFiltrados} dataKey="id" paginator rows={15} rowsPerPageOptions={[15, 30, 50]} emptyMessage="No se encontraron productos">
                        <Column field="inventario.codigo" header="Código" sortable style={{ width: '120px' }} />
                        <Column field="inventario.nombre" header="Producto" sortable style={{ minWidth: '160px' }} />
                        <Column field="inventario.categoria" header="Categoría" sortable style={{ width: '150px' }} />
                        <Column field="stock_sistema" header="Stock Sistema" sortable style={{ width: '130px' }} body={(d: DetalleValidacionInventario) => `${d.stock_sistema} ${d.inventario?.unidad || ''}`} />
                        <Column header="Conteo Físico" body={estatusBodyTemplate} style={{ minWidth: '200px' }} />
                        <Column header="Acciones" body={accionesBodyTemplate} style={{ width: '140px' }} />
                    </DataTable>
                </div>
            </div>

            <Dialog visible={reporteDialog} onHide={() => setReporteDialog(false)} header="Reporte de Discrepancias" style={{ width: '90vw', maxWidth: '900px' }} footer={reporteDialogFooter}>
                <DataTable value={discrepanciasReporte} size="small" emptyMessage="No hubo discrepancias en esta validación">
                    <Column field="inventario.codigo" header="Código" style={{ width: '120px' }} />
                    <Column field="inventario.nombre" header="Producto" />
                    <Column field="inventario.categoria" header="Categoría" style={{ width: '150px' }} />
                    <Column field="stock_sistema" header="Sistema" style={{ width: '100px' }} />
                    <Column field="stock_fisico" header="Físico" style={{ width: '100px' }} />
                    <Column header="Detalle" body={diferenciaLabel} style={{ width: '160px' }} />
                </DataTable>
            </Dialog>
        </div>
    );
};

export default ValidacionInventarioPage;
