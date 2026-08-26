'use client';

import React, { forwardRef } from 'react';
import { OrdenTrabajo, OrdenTrabajoDetalle } from '../../../../Services/BD/taller/ordenTrabajoService';

interface OrdenTrabajoTicketPrintProps {
    orden: OrdenTrabajo;
    detalle: OrdenTrabajoDetalle[];
}

export const OrdenTrabajoTicketPrint = forwardRef<HTMLDivElement, OrdenTrabajoTicketPrintProps>(({ orden, detalle }, ref) => {
    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);

    const total = detalle.reduce((acc, d) => acc + (d.costo_unitario || 0) * d.cantidad_solicitada, 0);

    return (
        <div
            ref={ref}
            className="ticket-print-container"
            style={{
                width: '100%',
                maxWidth: '560px',
                margin: '0 auto',
                backgroundColor: 'white',
                padding: '20px 24px',
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '13px',
                border: '1px solid #d1d5db',
                borderRadius: '6px'
            }}
        >
            <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '4px' }}>TICKET DE ORDEN DE TRABAJO</div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{orden.numero}</div>
            </div>

            <div style={{ marginBottom: '10px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ color: '#4b5563' }}>Fecha</span>
                    <span style={{ fontWeight: 'bold' }}>{new Date(orden.fecha_creacion).toLocaleString('es-MX')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ color: '#4b5563' }}>Equipo</span>
                    <span style={{ fontWeight: 'bold' }}>{orden.equipoLabel}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ color: '#4b5563' }}>Motivo</span>
                    <span>{orden.motivoBitacora || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ color: '#4b5563' }}>Estatus</span>
                    <span style={{ fontWeight: 'bold' }}>{orden.estatus}</span>
                </div>
            </div>

            <div style={{ borderTop: '1px dashed #d1d5db', borderBottom: '1px dashed #d1d5db', padding: '8px 0', marginBottom: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ textAlign: 'left', padding: '4px 2px' }}>Producto</th>
                            <th style={{ textAlign: 'right', padding: '4px 2px' }}>Cant.</th>
                            <th style={{ textAlign: 'right', padding: '4px 2px' }}>Costo Unit.</th>
                            <th style={{ textAlign: 'right', padding: '4px 2px' }}>Total</th>
                            <th style={{ textAlign: 'center', padding: '4px 2px' }}>Surtido</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detalle.map(d => (
                            <tr key={d.id}>
                                <td style={{ padding: '3px 2px' }}>{d.producto_nombre}</td>
                                <td style={{ textAlign: 'right', padding: '3px 2px' }}>{d.cantidad_solicitada} {d.producto_unidad}</td>
                                <td style={{ textAlign: 'right', padding: '3px 2px' }}>{formatCurrency(d.costo_unitario || 0)}</td>
                                <td style={{ textAlign: 'right', padding: '3px 2px' }}>{formatCurrency((d.costo_unitario || 0) * d.cantidad_solicitada)}</td>
                                <td style={{ textAlign: 'center', padding: '3px 2px' }}>{d.surtido ? 'Sí' : 'No'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px 0', fontWeight: 'bold', borderTop: '1px solid #e5e7eb', marginTop: '6px' }}>
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
                <div style={{ textAlign: 'center', width: '45%' }}>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>
                        <span style={{ fontSize: '11px' }}>Entrega Almacén</span>
                    </div>
                </div>
                <div style={{ textAlign: 'center', width: '45%' }}>
                    <div style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>
                        <span style={{ fontSize: '11px' }}>Recibe Mecánico</span>
                    </div>
                </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '10px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '6px', marginTop: '16px' }}>
                Documento generado electrónicamente
            </div>
        </div>
    );
});

OrdenTrabajoTicketPrint.displayName = 'OrdenTrabajoTicketPrint';
