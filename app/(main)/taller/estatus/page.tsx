'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { fetchCamiones } from '../../../../Services/BD/inventario/camion/camionService';
import { fetchMaquinarias } from '../../../../Services/BD/inventario/maquinaria/maquinariaService';
import { fetchBitacoras, fetchBitacorasPorEquipo, BitacoraTaller, TipoEquipoBitacora } from '../../../../Services/BD/taller/bitacoraTallerService';

interface UnidadEstatus {
    tipoEquipo: TipoEquipoBitacora;
    tipoLabel: string;
    id: number;
    unidad: string;
    referencia: string;
    ubicacion: string;
    operador: string;
    estatus: string;
    tallerExterno: boolean;
    tecnicoAsignado: string;
}

const severityPorEstatus = (estatus: string): 'success' | 'warning' | 'info' | 'danger' => {
    switch (estatus) {
        case 'Activo': return 'success';
        case 'Mantenimiento': return 'warning';
        case 'Inactivo': return 'info';
        case 'Dado de Baja': return 'danger';
        default: return 'info';
    }
};

const EstatusGeneralPage = () => {
    const [unidades, setUnidades] = useState<UnidadEstatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [tipoFiltro, setTipoFiltro] = useState<'Todos' | 'Camión' | 'Maquinaria'>('Todos');
    const [estatusFiltro, setEstatusFiltro] = useState<string>('Todos');

    const [detalleVisible, setDetalleVisible] = useState(false);
    const [unidadSeleccionada, setUnidadSeleccionada] = useState<UnidadEstatus | null>(null);
    const [historial, setHistorial] = useState<BitacoraTaller[]>([]);
    const [cargandoHistorial, setCargandoHistorial] = useState(false);
    const [rangoFechas, setRangoFechas] = useState<Date[] | null>(null);
    const [generandoPdf, setGenerandoPdf] = useState(false);
    const contenidoPdfRef = useRef<HTMLDivElement>(null);

    const cargar = async () => {
        setLoading(true);
        try {
            const [camiones, maquinarias, bitacoras] = await Promise.all([fetchCamiones(), fetchMaquinarias(), fetchBitacoras()]);

            // Bitácora abierta/en proceso más reciente por equipo, para el indicador de taller externo
            const bitacoraAbiertaPorEquipo = new Map<string, BitacoraTaller>();
            bitacoras
                .filter(b => b.estatus_bitacora !== 'Resuelta')
                .forEach(b => {
                    const clave = `${b.tipo_equipo}-${b.tipo_equipo === 'camion' ? b.camion_id : b.maquinaria_id}`;
                    const actual = bitacoraAbiertaPorEquipo.get(clave);
                    if (!actual || new Date(b.fecha_reporte || 0) > new Date(actual.fecha_reporte || 0)) {
                        bitacoraAbiertaPorEquipo.set(clave, b);
                    }
                });

            const unidadesCamiones: UnidadEstatus[] = camiones.map(c => {
                const abierta = bitacoraAbiertaPorEquipo.get(`camion-${c.id}`);
                return {
                    tipoEquipo: 'camion',
                    tipoLabel: 'Camión',
                    id: c.id!,
                    unidad: c.nombre,
                    referencia: c.placa,
                    ubicacion: '-',
                    operador: '-',
                    estatus: c.estatus,
                    tallerExterno: !!abierta?.es_taller_externo,
                    tecnicoAsignado: abierta?.tecnico_asignado || '-'
                };
            });

            const unidadesMaquinaria: UnidadEstatus[] = maquinarias.map(m => {
                const abierta = bitacoraAbiertaPorEquipo.get(`maquinaria-${m.id}`);
                return {
                    tipoEquipo: 'maquinaria',
                    tipoLabel: 'Maquinaria',
                    id: m.id!,
                    unidad: `${m.eco} - ${m.equipo}`,
                    referencia: m.no_serie || '-',
                    ubicacion: m.ubicacion || '-',
                    operador: m.operador_nombre || '-',
                    estatus: m.estatus,
                    tallerExterno: !!abierta?.es_taller_externo,
                    tecnicoAsignado: abierta?.tecnico_asignado || '-'
                };
            });

            setUnidades([...unidadesCamiones, ...unidadesMaquinaria]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    const verDetalle = async (unidad: UnidadEstatus) => {
        setUnidadSeleccionada(unidad);
        setDetalleVisible(true);
        setRangoFechas(null);
        setCargandoHistorial(true);
        try {
            const data = await fetchBitacorasPorEquipo(unidad.tipoEquipo, unidad.id);
            const ordenado = [...data].sort((a, b) => new Date(b.fecha_reporte || 0).getTime() - new Date(a.fecha_reporte || 0).getTime());
            setHistorial(ordenado);
        } finally {
            setCargandoHistorial(false);
        }
    };

    const historialFiltrado = useMemo(() => {
        if (!rangoFechas || !rangoFechas[0]) return historial;
        const inicio = new Date(rangoFechas[0]);
        inicio.setHours(0, 0, 0, 0);
        const fin = new Date(rangoFechas[1] || rangoFechas[0]);
        fin.setHours(23, 59, 59, 999);
        return historial.filter(b => {
            if (!b.fecha_reporte) return false;
            const fecha = new Date(b.fecha_reporte);
            return fecha >= inicio && fecha <= fin;
        });
    }, [historial, rangoFechas]);

    const etiquetaPeriodoHistorial = useMemo(() => {
        if (rangoFechas && rangoFechas[0]) {
            const inicio = rangoFechas[0].toLocaleDateString('es-MX');
            const fin = (rangoFechas[1] || rangoFechas[0]).toLocaleDateString('es-MX');
            return `${inicio} a ${fin}`;
        }
        return 'Todo el historial';
    }, [rangoFechas]);

    const exportarHistorialPDF = async () => {
        if (!contenidoPdfRef.current || !unidadSeleccionada) return;
        setGenerandoPdf(true);
        try {
            const canvas = await html2canvas(contenidoPdfRef.current, { scale: 2, backgroundColor: '#ffffff' });

            const pdf = new jsPDF('p', 'pt', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margen = 24;
            const anchoDisponible = pageWidth - margen * 2;
            const altoDisponible = pageHeight - margen * 2;

            const pxPorPt = canvas.width / anchoDisponible;
            const altoDisponiblePx = altoDisponible * pxPorPt;

            let renderizadoPx = 0;
            let primeraPagina = true;

            while (renderizadoPx < canvas.height) {
                if (!primeraPagina) pdf.addPage();

                const altoSeccionPx = Math.min(altoDisponiblePx, canvas.height - renderizadoPx);
                const canvasSeccion = document.createElement('canvas');
                canvasSeccion.width = canvas.width;
                canvasSeccion.height = altoSeccionPx;
                const ctx = canvasSeccion.getContext('2d');
                ctx?.drawImage(canvas, 0, renderizadoPx, canvas.width, altoSeccionPx, 0, 0, canvas.width, altoSeccionPx);

                const altoSeccionPt = altoSeccionPx / pxPorPt;
                pdf.addImage(canvasSeccion.toDataURL('image/png'), 'PNG', margen, margen, anchoDisponible, altoSeccionPt);

                renderizadoPx += altoSeccionPx;
                primeraPagina = false;
            }

            const nombreArchivo = `Bitacora_${unidadSeleccionada.unidad}_${etiquetaPeriodoHistorial}`.replace(/[^a-zA-Z0-9]/g, '_');
            pdf.save(`${nombreArchivo}.pdf`);
        } catch (error) {
            console.error('Error generando PDF del historial:', error);
        } finally {
            setGenerandoPdf(false);
        }
    };

    const unidadesFiltradas = unidades.filter(u =>
        (tipoFiltro === 'Todos' || u.tipoLabel === tipoFiltro) &&
        (estatusFiltro === 'Todos' || u.estatus === estatusFiltro)
    );

    const estatusBodyTemplate = (row: UnidadEstatus) => <Tag severity={severityPorEstatus(row.estatus)} value={row.estatus} />;

    const tipoBodyTemplate = (row: UnidadEstatus) => (
        <div className="flex align-items-center gap-2">
            <i className={row.tipoEquipo === 'camion' ? 'pi pi-car' : 'pi pi-cog'} />
            <span>{row.tipoLabel}</span>
        </div>
    );

    const tallerBodyTemplate = (row: UnidadEstatus) =>
        row.tallerExterno ? <Tag severity="warning" icon="pi pi-external-link" value="Taller Externo" /> : <span className="text-500">-</span>;

    const accionesBodyTemplate = (row: UnidadEstatus) => (
        <Button icon="pi pi-eye" label="Detalle" text onClick={() => verDetalle(row)} />
    );

    const rowClassName = (row: UnidadEstatus) => {
        switch (row.estatus) {
            case 'Activo': return 'estatus-row-activo';
            case 'Mantenimiento': return 'estatus-row-mantenimiento';
            case 'Inactivo': return 'estatus-row-inactivo';
            case 'Dado de Baja': return 'estatus-row-baja';
            default: return '';
        }
    };

    const bitacoraEstatusSeverity = (estatus: string): 'success' | 'warning' | 'danger' => {
        if (estatus === 'Resuelta') return 'success';
        if (estatus === 'En Proceso') return 'warning';
        return 'danger';
    };

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    <style>{`
                        .estatus-row-activo td { background-color: rgba(34, 197, 94, 0.12) !important; }
                        .estatus-row-mantenimiento td { background-color: rgba(234, 179, 8, 0.16) !important; }
                        .estatus-row-inactivo td { background-color: rgba(59, 130, 246, 0.12) !important; }
                        .estatus-row-baja td { background-color: rgba(239, 68, 68, 0.14) !important; }
                    `}</style>

                    <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center mb-4 gap-3">
                        <h5 className="m-0">Estatus General de Flota y Maquinaria</h5>
                        <div className="flex gap-2">
                            <Dropdown value={tipoFiltro} options={['Todos', 'Camión', 'Maquinaria']} onChange={(e) => setTipoFiltro(e.value)} placeholder="Tipo" />
                            <Dropdown value={estatusFiltro} options={['Todos', 'Activo', 'Mantenimiento', 'Inactivo', 'Dado de Baja']} onChange={(e) => setEstatusFiltro(e.value)} placeholder="Estatus" />
                            <Button icon="pi pi-refresh" rounded text onClick={cargar} tooltip="Actualizar" />
                        </div>
                    </div>

                    <DataTable
                        value={unidadesFiltradas}
                        loading={loading}
                        paginator
                        rows={15}
                        rowsPerPageOptions={[15, 30, 50]}
                        rowClassName={rowClassName}
                        emptyMessage="No hay unidades registradas"
                        responsiveLayout="scroll"
                    >
                        <Column header="Tipo" body={tipoBodyTemplate} style={{ width: '130px' }} />
                        <Column field="unidad" header="Unidad" sortable style={{ minWidth: '200px' }} />
                        <Column field="referencia" header="Placa / No. Serie" sortable style={{ width: '160px' }} />
                        <Column field="ubicacion" header="Ubicación" sortable style={{ width: '140px' }} />
                        <Column field="operador" header="Operador" sortable style={{ width: '160px' }} />
                        <Column header="Estatus" body={estatusBodyTemplate} sortable field="estatus" style={{ width: '150px' }} />
                        <Column header="Taller" body={tallerBodyTemplate} style={{ width: '160px' }} />
                        <Column header="" body={accionesBodyTemplate} style={{ width: '110px' }} />
                    </DataTable>

                    <Dialog
                        visible={detalleVisible}
                        style={{ width: '1100px' }}
                        header={unidadSeleccionada ? `Detalle — ${unidadSeleccionada.unidad}` : 'Detalle'}
                        modal
                        onHide={() => setDetalleVisible(false)}
                    >
                        {unidadSeleccionada && (
                            <>
                                <div className="flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                                    <div className="flex align-items-center gap-2">
                                        <span className="font-medium">Rango de fechas a exportar:</span>
                                        <Calendar
                                            value={rangoFechas}
                                            onChange={(e) => setRangoFechas((e.value as Date[]) || null)}
                                            selectionMode="range"
                                            readOnlyInput
                                            dateFormat="yy-mm-dd"
                                            placeholder="Todo el historial"
                                            showIcon
                                        />
                                        {rangoFechas && (
                                            <Button icon="pi pi-times" text severity="secondary" onClick={() => setRangoFechas(null)} tooltip="Quitar filtro" />
                                        )}
                                    </div>
                                    <Button label={`Exportar a PDF (${etiquetaPeriodoHistorial})`} icon="pi pi-file-pdf" severity="danger" loading={generandoPdf} onClick={exportarHistorialPDF} />
                                </div>

                                <div ref={contenidoPdfRef} style={{ backgroundColor: '#ffffff', padding: '8px' }}>
                                    <div className="flex align-items-center flex-wrap gap-3 mb-3">
                                        <Tag severity={severityPorEstatus(unidadSeleccionada.estatus)} value={unidadSeleccionada.estatus} />
                                        {unidadSeleccionada.tallerExterno && <Tag severity="warning" icon="pi pi-external-link" value="Taller Externo" />}
                                        <span className="text-500">{unidadSeleccionada.tipoLabel} · {unidadSeleccionada.referencia}</span>
                                        {unidadSeleccionada.operador !== '-' && <span className="text-500">· Operador: {unidadSeleccionada.operador}</span>}
                                        {unidadSeleccionada.tecnicoAsignado !== '-' && <span className="text-500">· Técnico: {unidadSeleccionada.tecnicoAsignado}</span>}
                                    </div>

                                    <h6 className="mt-0">Historial de Bitácora — {etiquetaPeriodoHistorial}</h6>

                                    <DataTable
                                        value={historialFiltrado}
                                        loading={cargandoHistorial}
                                        emptyMessage="Sin bitácoras registradas para este periodo"
                                        responsiveLayout="scroll"
                                        size="small"
                                        sortField="fecha_reporte"
                                        sortOrder={-1}
                                    >
                                        <Column field="fecha_reporte" header="Fecha" body={(b: BitacoraTaller) => (b.fecha_reporte ? new Date(b.fecha_reporte).toLocaleDateString('es-MX') : '-')} style={{ width: '100px' }} />
                                        <Column field="estatus_bitacora" header="Estatus" body={(b: BitacoraTaller) => <Tag severity={bitacoraEstatusSeverity(b.estatus_bitacora)} value={b.estatus_bitacora} />} style={{ width: '110px' }} />
                                        <Column field="motivo" header="Motivo" body={(b: BitacoraTaller) => b.motivo || '-'} style={{ minWidth: '180px' }} />
                                        <Column field="tecnico_asignado" header="Técnico" body={(b: BitacoraTaller) => b.tecnico_asignado || '-'} style={{ width: '130px' }} />
                                        <Column field="es_taller_externo" header="Taller Externo" body={(b: BitacoraTaller) => (b.es_taller_externo ? <Tag severity="warning" value="Externo" /> : '-')} style={{ width: '110px' }} />
                                        <Column field="estatus_refaccion" header="Estatus Refacción" body={(b: BitacoraTaller) => b.estatus_refaccion || '-'} style={{ width: '150px' }} />
                                        <Column field="reportado_por" header="Reportado por" body={(b: BitacoraTaller) => b.reportado_por || '-'} style={{ width: '130px' }} />
                                        <Column field="observaciones" header="Observaciones" body={(b: BitacoraTaller) => b.observaciones || '-'} style={{ minWidth: '180px' }} />
                                    </DataTable>
                                </div>
                            </>
                        )}
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default EstatusGeneralPage;
