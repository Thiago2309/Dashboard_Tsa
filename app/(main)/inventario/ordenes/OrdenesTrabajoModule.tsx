'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { DataTableFilterMeta } from 'primereact/datatable';
import {
    fetchOrdenesTrabajo,
    fetchDetalleOrden,
    aprobarSalidaOrden,
    OrdenTrabajo,
    OrdenTrabajoDetalle
} from '../../../../Services/BD/taller/ordenTrabajoService';
import { getUserNombreFromLocalStorage } from '../../../../Services/BD/userService';
import { OrdenTrabajoTicketPrint } from './OrdenTrabajoTicketPrint';

const estatusSeverity = (estatus: string): 'success' | 'warning' | 'info' | 'danger' | undefined => {
    switch (estatus) {
        case 'Surtida': return 'success';
        case 'Parcialmente Surtida': return 'warning';
        case 'Cancelada': return 'danger';
        default: return undefined; // Pendiente
    }
};

const OrdenesTrabajoModule = () => {
    const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const toast = useRef<Toast>(null);

    const [detalleVisible, setDetalleVisible] = useState(false);
    const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenTrabajo | null>(null);
    const [detalle, setDetalle] = useState<OrdenTrabajoDetalle[]>([]);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [aprobando, setAprobando] = useState(false);
    const ticketRef = useRef<HTMLDivElement>(null);

    const cargar = async () => {
        setLoading(true);
        try {
            const data = await fetchOrdenesTrabajo();
            setOrdenes(data);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    const verDetalle = async (orden: OrdenTrabajo) => {
        setOrdenSeleccionada(orden);
        setDetalleVisible(true);
        setCargandoDetalle(true);
        try {
            const data = await fetchDetalleOrden(orden.id);
            setDetalle(data);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setCargandoDetalle(false);
        }
    };

    const aprobarSalida = async () => {
        if (!ordenSeleccionada) return;
        setAprobando(true);
        try {
            const resultado = await aprobarSalidaOrden(ordenSeleccionada, getUserNombreFromLocalStorage());
            if (resultado.fallidas.length === 0) {
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: `Salida aprobada: ${resultado.surtidas} refacción(es) descontadas del stock`, life: 4000 });
            } else {
                toast.current?.show({
                    severity: 'warn',
                    summary: 'Aprobación parcial',
                    detail: `${resultado.surtidas} surtidas, ${resultado.fallidas.length} sin stock suficiente: ${resultado.fallidas.map(f => f.producto).join(', ')}`,
                    life: 7000
                });
            }
            await verDetalle(ordenSeleccionada);
            cargar();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setAprobando(false);
        }
    };

    const imprimirTicket = () => {
        if (!ticketRef.current || !ordenSeleccionada) return;

        const printContent = ticketRef.current.innerHTML;
        const printWindow = window.open('', '_blank', 'width=650,height=800');
        if (!printWindow) return;

        const styles = `
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: white !important;
                    margin: 0 !important;
                    padding: 20px !important;
                    font-family: Arial, Helvetica, sans-serif !important;
                    display: flex;
                    justify-content: center;
                }
                .ticket-print-container {
                    max-width: 560px !important;
                    margin: 0 auto !important;
                    padding: 20px 24px !important;
                    background: white !important;
                    border: 1px solid #d1d5db !important;
                    border-radius: 6px !important;
                }
                @media print {
                    body { margin: 0 !important; padding: 10mm !important; }
                    .ticket-print-container { border: 1px solid #000 !important; max-width: 100% !important; }
                    @page { size: portrait; margin: 8mm; }
                }
            </style>
        `;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Ticket_${ordenSeleccionada.numero}</title>
                    ${styles}
                </head>
                <body>
                    <div class="ticket-print-container">${printContent}</div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };

    const numeroBodyTemplate = (row: OrdenTrabajo) => <Tag severity="info" value={row.numero} />;

    const equipoBodyTemplate = (row: OrdenTrabajo) => (
        <div className="flex align-items-center gap-2">
            <i className={row.tipo_equipo === 'camion' ? 'pi pi-car' : 'pi pi-cog'} />
            <span>{row.equipoLabel}</span>
        </div>
    );

    const estatusBodyTemplate = (row: OrdenTrabajo) => <Tag severity={estatusSeverity(row.estatus)} value={row.estatus} />;

    const fechaBodyTemplate = (row: OrdenTrabajo) => <span>{new Date(row.fecha_creacion).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span>;

    const detalleBodyTemplate = (row: OrdenTrabajo) => <Button label="Ver Detalle" icon="pi pi-search" text onClick={() => verDetalle(row)} />;

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Órdenes de Trabajo</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })} placeholder="Buscar..." />
            </span>
        </div>
    );

    const puedeAprobar = ordenSeleccionada && ordenSeleccionada.estatus !== 'Surtida' && ordenSeleccionada.estatus !== 'Cancelada' && detalle.some(d => !d.surtido);

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={() => <h6 className="m-0 text-500">Refacciones solicitadas desde Taller, pendientes de recoger en Almacén</h6>} right={() => <Button icon="pi pi-refresh" text onClick={cargar} tooltip="Actualizar" />} />

                    <DataTable
                        value={ordenes}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[10, 25, 50]}
                        loading={loading}
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No hay órdenes de trabajo registradas"
                        header={header}
                        sortField="fecha_creacion"
                        sortOrder={-1}
                        responsiveLayout="scroll"
                    >
                        <Column header="Número" body={numeroBodyTemplate} sortable field="id" style={{ width: '140px' }} />
                        <Column header="Equipo" body={equipoBodyTemplate} style={{ minWidth: '200px' }} />
                        <Column field="motivoBitacora" header="Motivo" body={(r: OrdenTrabajo) => r.motivoBitacora || '-'} style={{ minWidth: '200px' }} />
                        <Column field="creado_por" header="Creado por" body={(r: OrdenTrabajo) => r.creado_por || '-'} style={{ width: '150px' }} />
                        <Column header="Fecha" body={fechaBodyTemplate} sortable field="fecha_creacion" style={{ width: '160px' }} />
                        <Column header="Estatus" body={estatusBodyTemplate} sortable field="estatus" style={{ width: '160px' }} />
                        <Column header="" body={detalleBodyTemplate} style={{ width: '130px' }} />
                    </DataTable>

                    <Dialog
                        visible={detalleVisible}
                        style={{ width: '800px' }}
                        header={ordenSeleccionada ? `Orden ${ordenSeleccionada.numero} — ${ordenSeleccionada.equipoLabel}` : 'Detalle'}
                        modal
                        onHide={() => setDetalleVisible(false)}
                    >
                        {ordenSeleccionada && (
                            <>
                                <div className="flex align-items-center justify-content-between flex-wrap gap-3 mb-3">
                                    <div className="flex align-items-center gap-2">
                                        <Tag severity={estatusSeverity(ordenSeleccionada.estatus)} value={ordenSeleccionada.estatus} />
                                        <span className="text-500">{ordenSeleccionada.motivoBitacora}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            label="Imprimir Ticket"
                                            icon="pi pi-print"
                                            severity="secondary"
                                            outlined
                                            disabled={detalle.length === 0}
                                            onClick={imprimirTicket}
                                        />
                                        <Button
                                            label="Aprobar Salida"
                                            icon="pi pi-check-circle"
                                            severity="success"
                                            loading={aprobando}
                                            disabled={!puedeAprobar}
                                            onClick={aprobarSalida}
                                        />
                                    </div>
                                </div>

                                <DataTable value={detalle} loading={cargandoDetalle} emptyMessage="Sin refacciones en esta orden" responsiveLayout="scroll" size="small">
                                    <Column field="producto_codigo" header="Código" style={{ width: '100px' }} />
                                    <Column field="producto_nombre" header="Producto" />
                                    <Column field="cantidad_solicitada" header="Cant. Solicitada" body={(d: OrdenTrabajoDetalle) => <span>{d.cantidad_solicitada} {d.producto_unidad}</span>} style={{ width: '150px' }} />
                                    <Column field="stock_al_solicitar" header="Stock al Pedir" style={{ width: '130px' }} />
                                    <Column field="stock_actual" header="Stock Actual" style={{ width: '120px' }} />
                                    <Column header="Excede Stock" body={(d: OrdenTrabajoDetalle) => (d.excede_stock ? <Tag severity="warning" value="Requisición generada" /> : <span className="text-500">No</span>)} style={{ width: '170px' }} />
                                    <Column header="Surtido" body={(d: OrdenTrabajoDetalle) => (d.surtido ? <Tag severity="success" value="Sí" /> : <Tag value="Pendiente" />)} style={{ width: '110px' }} />
                                </DataTable>

                                <div style={{ display: 'none' }}>
                                    <div ref={ticketRef}>
                                        <OrdenTrabajoTicketPrint orden={ordenSeleccionada} detalle={detalle} />
                                    </div>
                                </div>
                            </>
                        )}
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default OrdenesTrabajoModule;
