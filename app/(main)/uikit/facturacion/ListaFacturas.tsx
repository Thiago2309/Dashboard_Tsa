"use client";

import React, { useState, useEffect, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { getFacturas, descargarFactura, cancelarFactura, aprobarFacturaDeViajes, eliminarFacturaBorrador, regenerarArchivosFactura } from '../../../../Services/BD/facturacion/fiscalApiService';

const ESTADOS: Record<string, { severity: 'warning' | 'success' | 'danger' | 'info'; label: string }> = {
    PENDIENTE: { severity: 'warning', label: 'Pendiente de aprobar' },
    TIMBRADA: { severity: 'success', label: 'Timbrada' },
    CANCELADA: { severity: 'danger', label: 'Cancelada' },
    ERROR: { severity: 'danger', label: 'Error' }
};

const ListaFacturas = () => {
    const [facturas, setFacturas] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [aprobandoId, setAprobandoId] = useState<number | null>(null);
    const [regenerandoId, setRegenerandoId] = useState<number | null>(null);
    const [selectedFactura, setSelectedFactura] = useState<any>(null);
    const [showDetalleDialog, setShowDetalleDialog] = useState(false);
    const toast = useRef<Toast>(null);

    useEffect(() => {
        cargarFacturas();
    }, []);

    const cargarFacturas = async () => {
        setLoading(true);
        try {
            const data = await getFacturas();
            setFacturas(data);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    const statusBodyTemplate = (rowData: any) => {
        const status = ESTADOS[rowData.status] || { severity: 'info' as const, label: rowData.status };
        return <Tag severity={status.severity} value={status.label} />;
    };

    const fechaBodyTemplate = (rowData: any) => {
        return rowData.fecha_emision ? new Date(rowData.fecha_emision).toLocaleString('es-MX') : '-';
    };

    const totalBodyTemplate = (rowData: any) => `$${Number(rowData.total || 0).toFixed(2)}`;

    const viajesBodyTemplate = (rowData: any) => {
        const conViaje = (rowData.facturas_detalles || []).filter((d: any) => d.id_viaje);
        return conViaje.length > 0 ? conViaje.length : '-';
    };

    const aprobar = async (factura: any) => {
        setAprobandoId(factura.id);
        try {
            const resultado = await aprobarFacturaDeViajes(factura.id);
            if (resultado.success) {
                toast.current?.show({
                    severity: 'success',
                    summary: 'Factura aprobada',
                    detail: `UUID: ${resultado.uuid}. Los viajes ligados ya pasaron a "facturado".`,
                    life: 5000
                });
                cargarFacturas();
            } else {
                toast.current?.show({ severity: 'error', summary: 'Error al aprobar', detail: resultado.error, life: 5000 });
            }
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setAprobandoId(null);
        }
    };

    const cancelar = async (factura: any) => {
        if (!window.confirm(`¿Estás seguro de cancelar la factura ${factura.uuid || factura.folio}?`)) return;
        try {
            const result = await cancelarFactura(factura.uuid);
            if (result.success) {
                toast.current?.show({ severity: 'success', summary: 'Factura cancelada', detail: `UUID: ${result.uuid}`, life: 3000 });
                cargarFacturas();
            } else {
                toast.current?.show({ severity: 'error', summary: 'Error al cancelar', detail: result.error, life: 3000 });
            }
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const eliminar = async (factura: any) => {
        if (!window.confirm(`¿Eliminar esta factura ${ESTADOS[factura.status]?.label?.toLowerCase() || factura.status}? Esto libera los viajes ligados para poder volver a facturarlos.`)) return;
        try {
            await eliminarFacturaBorrador(factura.id);
            toast.current?.show({ severity: 'success', summary: 'Eliminada', detail: 'La factura se eliminó y sus viajes ya pueden volver a facturarse', life: 4000 });
            cargarFacturas();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const reintentarArchivos = async (factura: any) => {
        setRegenerandoId(factura.id);
        try {
            const resultado = await regenerarArchivosFactura(factura.id);
            if (resultado.success) {
                toast.current?.show({ severity: 'success', summary: 'Listo', detail: 'XML y PDF regenerados', life: 3000 });
                cargarFacturas();
            } else {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: resultado.error, life: 5000 });
            }
        } finally {
            setRegenerandoId(null);
        }
    };

    const descargar = async (id: number, tipo: 'xml' | 'pdf') => {
        try {
            await descargarFactura(id, tipo);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const verDetalles = (factura: any) => {
        setSelectedFactura(factura);
        setShowDetalleDialog(true);
    };

    const actionBodyTemplate = (rowData: any) => (
        <div className="flex gap-2">
            <Button icon="pi pi-eye" rounded severity="info" tooltip="Ver detalles" onClick={() => verDetalles(rowData)} />
            {(rowData.status === 'PENDIENTE' || rowData.status === 'ERROR') && (
                <Button
                    icon="pi pi-check"
                    rounded
                    severity="success"
                    tooltip={rowData.status === 'ERROR' ? 'Reintentar timbrado' : 'Aprobar / Timbrar'}
                    loading={aprobandoId === rowData.id}
                    onClick={() => aprobar(rowData)}
                />
            )}
            {(rowData.status === 'PENDIENTE' || rowData.status === 'ERROR') && (
                <Button
                    icon="pi pi-trash"
                    rounded
                    severity="danger"
                    tooltip="Eliminar (libera los viajes para volver a facturarlos)"
                    onClick={() => eliminar(rowData)}
                />
            )}
            {rowData.status === 'TIMBRADA' && (!rowData.pdf || !rowData.xml) && (
                <Button
                    icon="pi pi-refresh"
                    rounded
                    severity="warning"
                    tooltip="Reintentar generar XML/PDF (no vuelve a timbrar)"
                    loading={regenerandoId === rowData.id}
                    onClick={() => reintentarArchivos(rowData)}
                />
            )}
            {rowData.status === 'TIMBRADA' && (
                <>
                    <Button icon="pi pi-file-pdf" rounded severity="danger" tooltip="Descargar PDF" disabled={!rowData.pdf} onClick={() => descargar(rowData.id, 'pdf')} />
                    <Button icon="pi pi-file" rounded severity="secondary" tooltip="Descargar XML" disabled={!rowData.xml} onClick={() => descargar(rowData.id, 'xml')} />
                    <Button icon="pi pi-times" rounded severity="danger" tooltip="Cancelar factura" onClick={() => cancelar(rowData)} />
                </>
            )}
        </div>
    );

    return (
        <div>
            <Toast ref={toast} />

            <div className="flex justify-content-between align-items-center mb-3">
                <h3 className="m-0">Facturas</h3>
                <Button label="Actualizar" icon="pi pi-refresh" onClick={cargarFacturas} loading={loading} />
            </div>

            <p className="text-color-secondary mt-0 mb-3">
                Las facturas ligadas a viajes muestran cuántos viajes incluyen. Al aprobar/timbrar una factura (real o simulada), esos
                viajes pasan automáticamente a estatus &quot;facturado&quot;.
            </p>

            <DataTable
                value={facturas}
                loading={loading}
                paginator
                rows={10}
                rowsPerPageOptions={[5, 10, 25]}
                emptyMessage="No hay facturas registradas"
                className="p-datatable-sm"
            >
                <Column field="serie" header="Serie" style={{ width: '70px' }} />
                <Column field="folio" header="Folio" style={{ width: '80px' }} />
                <Column field="uuid" header="UUID" style={{ minWidth: '160px' }} body={(r) => r.uuid || '-'} />
                <Column field="clientes" header="Cliente" body={(rowData) => rowData.clientes?.empresa || 'N/A'} style={{ minWidth: '180px' }} />
                <Column header="Viajes" body={viajesBodyTemplate} style={{ width: '80px' }} />
                <Column field="fecha_emision" header="Fecha" body={fechaBodyTemplate} style={{ width: '170px' }} />
                <Column field="total" header="Total" body={totalBodyTemplate} style={{ width: '110px' }} />
                <Column field="status" header="Estatus" body={statusBodyTemplate} style={{ width: '150px' }} />
                <Column header="Acciones" body={actionBodyTemplate} style={{ width: '160px' }} exportable={false} />
            </DataTable>

            <Dialog visible={showDetalleDialog} header="Detalles de Factura" modal style={{ width: '650px' }} onHide={() => setShowDetalleDialog(false)}>
                {selectedFactura && (
                    <div className="flex flex-column gap-2">
                        <div><strong>UUID:</strong> {selectedFactura.uuid || '-'}</div>
                        <div><strong>Serie:</strong> {selectedFactura.serie} - <strong>Folio:</strong> {selectedFactura.folio}</div>
                        <div><strong>Cliente:</strong> {selectedFactura.clientes?.empresa}</div>
                        <div><strong>RFC:</strong> {selectedFactura.clientes?.rfc}</div>
                        <div><strong>Subtotal:</strong> ${Number(selectedFactura.subtotal || 0).toFixed(2)}</div>
                        <div><strong>IVA:</strong> ${Number(selectedFactura.iva || 0).toFixed(2)}</div>
                        <div><strong>Total:</strong> ${Number(selectedFactura.total || 0).toFixed(2)}</div>
                        <div><strong>Estatus:</strong> {ESTADOS[selectedFactura.status]?.label || selectedFactura.status}</div>
                        {selectedFactura.error_mensaje && <div><strong>Error:</strong> {selectedFactura.error_mensaje}</div>}

                        <hr />
                        <h4>Conceptos (viajes)</h4>
                        <DataTable value={selectedFactura.facturas_detalles} size="small">
                            <Column field="descripcion" header="Descripción" />
                            <Column field="cantidad" header="M3" style={{ width: '80px' }} body={(r) => Number(r.cantidad).toFixed(2)} />
                            <Column field="precio_unitario" header="Precio" style={{ width: '100px' }} body={(r) => `$${Number(r.precio_unitario).toFixed(2)}`} />
                            <Column header="Importe" style={{ width: '100px' }} body={(r) => `$${Number(r.importe).toFixed(2)}`} />
                        </DataTable>
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default ListaFacturas;
