'use client';

import React, { useEffect, useRef, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import {
    fetchRendimientoMecanicos,
    RendimientoMecanico
} from '../../../../Services/BD/taller/rendimientoMecanicoService';
import { BitacoraTaller } from '../../../../Services/BD/taller/bitacoraTallerService';
import {
    fetchOrdenTrabajoPorBitacora,
    fetchDetalleOrden,
    OrdenTrabajo,
    OrdenTrabajoDetalle
} from '../../../../Services/BD/taller/ordenTrabajoService';

interface DetalleOrdenCache {
    orden: OrdenTrabajo | null;
    detalle: OrdenTrabajoDetalle[];
    cargando: boolean;
}

const RendimientoMecanicosPage = () => {
    const [rendimientos, setRendimientos] = useState<RendimientoMecanico[]>([]);
    const [mecanicoSeleccionado, setMecanicoSeleccionado] = useState<RendimientoMecanico | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedRows, setExpandedRows] = useState<any>(null);
    const [detallePorBitacora, setDetallePorBitacora] = useState<Record<number, DetalleOrdenCache>>({});
    const toast = useRef<Toast>(null);

    const cargar = async () => {
        setLoading(true);
        try {
            const data = await fetchRendimientoMecanicos();
            setRendimientos(data);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    const handleMecanicoClick = (mecanico: RendimientoMecanico) => {
        if (mecanicoSeleccionado?.operador.id === mecanico.operador.id) {
            setMecanicoSeleccionado(null);
            return;
        }
        setMecanicoSeleccionado(mecanico);
        setExpandedRows(null);
    };

    const cargarDetalleBitacora = async (bitacora: BitacoraTaller) => {
        if (!bitacora.id || detallePorBitacora[bitacora.id]) return;
        setDetallePorBitacora(prev => ({ ...prev, [bitacora.id!]: { orden: null, detalle: [], cargando: true } }));
        try {
            const orden = await fetchOrdenTrabajoPorBitacora(bitacora.id);
            const detalle = orden ? await fetchDetalleOrden(orden.id) : [];
            setDetallePorBitacora(prev => ({ ...prev, [bitacora.id!]: { orden, detalle, cargando: false } }));
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el detalle de la orden de trabajo', life: 4000 });
            setDetallePorBitacora(prev => ({ ...prev, [bitacora.id!]: { orden: null, detalle: [], cargando: false } }));
        }
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value || 0);

    const equipoLabel = (b: BitacoraTaller) =>
        b.tipo_equipo === 'camion'
            ? `${b.camion_nombre || 'Camión'} (${b.camion_placa || 's/placa'})`
            : `${b.maquinaria_eco ? b.maquinaria_eco + ' - ' : ''}${b.maquinaria_equipo || 'Maquinaria'}`;

    const fechaBodyTemplate = (row: BitacoraTaller) => (
        <span>{row.fecha_reporte ? new Date(row.fecha_reporte).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span>
    );

    const estatusBitacoraBodyTemplate = (row: BitacoraTaller) => {
        let severity: 'success' | 'warning' | 'danger' = 'danger';
        if (row.estatus_bitacora === 'En Proceso') severity = 'warning';
        if (row.estatus_bitacora === 'Resuelta') severity = 'success';
        return <Tag severity={severity} value={row.estatus_bitacora} />;
    };

    const rowExpansionTemplate = (bitacora: BitacoraTaller) => {
        const cache = bitacora.id ? detallePorBitacora[bitacora.id] : undefined;

        if (!cache || cache.cargando) {
            return (
                <div className="flex justify-content-center p-3">
                    <ProgressSpinner style={{ width: '30px', height: '30px' }} />
                </div>
            );
        }

        return (
            <div className="p-3">
                <div className="grid mb-3">
                    <div className="col-12 md:col-6">
                        <strong>Reparación:</strong> {bitacora.motivo || '-'}
                    </div>
                    <div className="col-12 md:col-6">
                        <strong>Observaciones:</strong> {bitacora.observaciones || '-'}
                    </div>
                    <div className="col-12 md:col-4">
                        <strong>Estatus de Refacción:</strong> {bitacora.estatus_refaccion || '-'}
                    </div>
                    <div className="col-12 md:col-4">
                        <strong>Reportado por:</strong> {bitacora.reportado_por || '-'}
                    </div>
                    <div className="col-12 md:col-4">
                        <strong>Costo de Mano de Obra:</strong> {formatCurrency(bitacora.costo_mano_obra)}
                    </div>
                </div>

                {!cache.orden ? (
                    <span className="text-500">No se generó una orden de trabajo (refacciones) para esta bitácora.</span>
                ) : (
                    <>
                        <div className="flex align-items-center gap-2 mb-2">
                            <Tag severity="info" value={cache.orden.numero} />
                            <Tag severity={cache.orden.estatus === 'Surtida' ? 'success' : cache.orden.estatus === 'Parcialmente Surtida' ? 'warning' : undefined} value={cache.orden.estatus} />
                        </div>
                        <DataTable value={cache.detalle} emptyMessage="Sin refacciones solicitadas" size="small">
                            <Column field="producto_nombre" header="Producto" />
                            <Column field="cantidad_solicitada" header="Cantidad Solicitada" style={{ width: '160px' }} />
                            <Column field="costo_unitario" header="Costo Unitario" body={(d: OrdenTrabajoDetalle) => formatCurrency(d.costo_unitario || 0)} style={{ width: '140px' }} />
                            <Column
                                header="Costo Total"
                                body={(d: OrdenTrabajoDetalle) => formatCurrency((d.costo_unitario || 0) * d.cantidad_solicitada)}
                                style={{ width: '140px' }}
                            />
                            <Column header="Surtido" body={(d: OrdenTrabajoDetalle) => (d.surtido ? <Tag severity="success" value="Sí" /> : <Tag value="Pendiente" />)} style={{ width: '110px' }} />
                        </DataTable>
                    </>
                )}
            </div>
        );
    };

    const totalMecanicos = rendimientos.length;
    const totalCostoGeneral = rendimientos.reduce((sum, r) => sum + r.totalCostoManoObra, 0);
    const totalTrabajosGeneral = rendimientos.reduce((sum, r) => sum + r.totalTrabajos, 0);

    return (
        <div className="grid">
            <div className="col-12">
                <Toast ref={toast} />
                <div className="flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                    <h2>Rendimiento de Mecánicos</h2>
                    <div className="flex align-items-center gap-3">
                        <div className="bg-white border-round p-3 surface-card shadow-1">
                            <span className="block text-sm text-color-secondary">Mecánicos</span>
                            <span className="text-xl font-medium text-blue-500">{totalMecanicos}</span>
                        </div>
                        <div className="bg-white border-round p-3 surface-card shadow-1">
                            <span className="block text-sm text-color-secondary">Trabajos Totales</span>
                            <span className="text-xl font-medium text-blue-500">{totalTrabajosGeneral}</span>
                        </div>
                        <div className="bg-white border-round p-3 surface-card shadow-1">
                            <span className="block text-sm text-color-secondary">Costo Mano de Obra Total</span>
                            <span className="text-xl font-medium text-orange-500">{formatCurrency(totalCostoGeneral)}</span>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-content-center">
                        <ProgressSpinner />
                    </div>
                ) : (
                    <>
                        <DataTable
                            value={rendimientos}
                            selectionMode="single"
                            selection={mecanicoSeleccionado}
                            onSelectionChange={(e) => handleMecanicoClick(e.value as RendimientoMecanico)}
                            dataKey="operador.id"
                            className="p-datatable-sm mb-4"
                            emptyMessage="No se encontraron empleados con puesto de Mecánico"
                            paginator
                            rows={10}
                            rowsPerPageOptions={[5, 10, 25]}
                            showGridlines
                        >
                            <Column field="operador.nombre" header="Mecánico" body={(row: RendimientoMecanico) => <span className="font-medium">{row.operador.nombre}</span>} sortable />
                            <Column field="operador.departamento_nombre" header="Departamento" body={(row: RendimientoMecanico) => row.operador.departamento_nombre || '-'} sortable />
                            <Column
                                header="Estatus"
                                body={(row: RendimientoMecanico) => (
                                    <Tag severity={row.operador.estatus ? 'success' : 'danger'} value={row.operador.estatus ? 'Activo' : 'Inactivo'} />
                                )}
                            />
                            <Column field="totalTrabajos" header="Total Trabajos" sortable />
                            <Column
                                field="trabajosAbiertos"
                                header="Trabajos Abiertos"
                                sortable
                                body={(row: RendimientoMecanico) => (
                                    row.trabajosAbiertos > 0
                                        ? <Tag severity="warning" value={row.trabajosAbiertos} />
                                        : <span className="text-500">0</span>
                                )}
                            />
                            <Column
                                field="totalCostoManoObra"
                                header="Costo Mano de Obra"
                                sortable
                                body={(row: RendimientoMecanico) => <strong>{formatCurrency(row.totalCostoManoObra)}</strong>}
                            />
                        </DataTable>

                        {mecanicoSeleccionado && (
                            <div className="mt-5">
                                <Card
                                    title={`Trabajos de ${mecanicoSeleccionado.operador.nombre}`}
                                    subTitle={`${mecanicoSeleccionado.totalTrabajos} trabajo(s) — Costo de mano de obra total: ${formatCurrency(mecanicoSeleccionado.totalCostoManoObra)}`}
                                >
                                    <DataTable
                                        value={mecanicoSeleccionado.trabajos}
                                        dataKey="id"
                                        paginator
                                        rows={10}
                                        rowsPerPageOptions={[5, 10, 25]}
                                        emptyMessage="Este mecánico no tiene trabajos registrados en la Bitácora de Taller"
                                        className="p-datatable-sm"
                                        showGridlines
                                        expandedRows={expandedRows}
                                        onRowToggle={(e) => setExpandedRows(e.data)}
                                        onRowExpand={(e) => cargarDetalleBitacora(e.data as BitacoraTaller)}
                                        rowExpansionTemplate={rowExpansionTemplate}
                                        sortField="fecha_reporte"
                                        sortOrder={-1}
                                    >
                                        <Column expander headerStyle={{ width: '3rem' }} />
                                        <Column header="Equipo" body={equipoLabel} style={{ minWidth: '200px' }} />
                                        <Column field="fecha_reporte" header="Fecha" body={fechaBodyTemplate} sortable style={{ width: '160px' }} />
                                        <Column field="motivo" header="Motivo" body={(r: BitacoraTaller) => r.motivo || '-'} style={{ minWidth: '220px' }} />
                                        <Column
                                            field="costo_mano_obra"
                                            header="Costo Mano de Obra"
                                            sortable
                                            body={(r: BitacoraTaller) => formatCurrency(r.costo_mano_obra)}
                                            style={{ width: '170px' }}
                                        />
                                        <Column field="estatus_bitacora" header="Estatus" body={estatusBitacoraBodyTemplate} sortable style={{ width: '130px' }} />
                                    </DataTable>
                                </Card>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default RendimientoMecanicosPage;
