"use client";

import React, { useState, useEffect } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { getMovimientosByProducto, MovimientoInventario } from '../../../Services/BD/inventario/inventarioService';
import { ModalTicketSalida } from './ModalTicketSalida';

interface HistorialMovimientosProps {
    productoId: number;
}

const HistorialMovimientos: React.FC<HistorialMovimientosProps> = ({ productoId }) => {
    const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
    const [loading, setLoading] = useState(true);
    const [ticketDialog, setTicketDialog] = useState(false);
    const [movimientoTicket, setMovimientoTicket] = useState<MovimientoInventario | null>(null);

    useEffect(() => {
        if (productoId > 0) {
            cargarMovimientos();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productoId]);

    const cargarMovimientos = async () => {
        setLoading(true);
        try {
            const data = await getMovimientosByProducto(productoId);
            setMovimientos(data);
        } catch (error: any) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const abrirTicket = (movimiento: MovimientoInventario) => {
        setMovimientoTicket(movimiento);
        setTicketDialog(true);
    };

    const tipoBodyTemplate = (rowData: MovimientoInventario) => {
        return (
            <Tag
                severity={rowData.tipo === 'entrada' ? 'success' : 'warning'}
                value={rowData.tipo === 'entrada' ? '➕ ENTRADA' : '➖ SALIDA'}
            />
        );
    };

    const fechaBodyTemplate = (rowData: MovimientoInventario) => {
        return new Date(rowData.fecha).toLocaleString('es-MX');
    };

    const detalleBodyTemplate = (rowData: MovimientoInventario) => {
        if (rowData.tipo === 'entrada') {
            return (
                <div className="text-sm">
                    {rowData.proveedor?.nombre && <div>Proveedor: {rowData.proveedor.nombre}</div>}
                    {rowData.tipo_pago && <div>Pago: {rowData.tipo_pago === 'credito' ? 'Crédito' : 'Contado'}</div>}
                    {rowData.folio && <div>Folio: {rowData.folio}</div>}
                </div>
            );
        }
        return <div className="text-sm">{rowData.orden_trabajo ? `OT: ${rowData.orden_trabajo}` : '—'}</div>;
    };

    const accionesBodyTemplate = (rowData: MovimientoInventario) => {
        if (rowData.tipo !== 'salida') return null;
        return (
            <Button
                icon="pi pi-file-pdf"
                rounded
                text
                severity="info"
                tooltip="Generar Ticket de Salida"
                onClick={() => abrirTicket(rowData)}
            />
        );
    };

    return (
        <>
            <DataTable value={movimientos} loading={loading} size="small" emptyMessage="No hay movimientos registrados">
                <Column field="id" header="#" style={{ width: '60px' }} />
                <Column field="tipo" header="Tipo" body={tipoBodyTemplate} style={{ width: '110px' }} />
                <Column field="cantidad" header="Cantidad" style={{ width: '90px' }} />
                <Column field="motivo" header="Motivo" />
                <Column header="Detalle" body={detalleBodyTemplate} style={{ minWidth: '160px' }} />
                <Column field="usuario_id" header="Usuario" body={(rowData) => rowData.usuario_id || '—'} style={{ width: '130px' }} />
                <Column field="fecha" header="Fecha y Hora" body={fechaBodyTemplate} style={{ width: '180px' }} />
                <Column header="Ticket" body={accionesBodyTemplate} style={{ width: '80px' }} />
            </DataTable>

            <ModalTicketSalida
                visible={ticketDialog}
                onHide={() => setTicketDialog(false)}
                movimiento={movimientoTicket}
            />
        </>
    );
};

export default HistorialMovimientos;
