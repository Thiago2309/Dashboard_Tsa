"use client";

import React, { forwardRef } from 'react';
import { MovimientoInventario } from '../../../Services/BD/inventario/inventarioService';

interface TicketSalidaPrintProps {
    movimiento: MovimientoInventario;
    firmaImg: string | null;
}

export const TicketSalidaPrint = forwardRef<HTMLDivElement, TicketSalidaPrintProps>(({ movimiento, firmaImg }, ref) => {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    };

    const costoUnitario = movimiento.costo_unitario || 0;
    const costoTotal = costoUnitario * movimiento.cantidad;
    const producto = movimiento.inventario;

    return (
        <div
            ref={ref}
            className="ticket-print-container"
            style={{
                width: '100%',
                maxWidth: '480px',
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
                {/* <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>TSA</h2> */}
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '4px' }}>TICKET DE SALIDA DE ALMACÉN</div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Folio #{movimiento.id}</div>
            </div>

            <div style={{ marginBottom: '10px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ color: '#4b5563' }}>Fecha</span>
                    <span style={{ fontWeight: 'bold' }}>{new Date(movimiento.fecha).toLocaleString('es-MX')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ color: '#4b5563' }}>Orden de Trabajo</span>
                    <span style={{ fontWeight: 'bold' }}>{movimiento.orden_trabajo || 'N/A'}</span>
                </div>
            </div>

            <div style={{ borderTop: '1px dashed #d1d5db', borderBottom: '1px dashed #d1d5db', padding: '8px 0', marginBottom: '10px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {producto?.codigo ? `${producto.codigo} - ` : ''}{producto?.nombre || 'Producto'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '12px' }}>
                    <span>Cantidad</span>
                    <span>{movimiento.cantidad} {producto?.unidad || ''}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '12px' }}>
                    <span>Costo por Unidad</span>
                    <span>{formatCurrency(costoUnitario)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 'bold', borderTop: '1px solid #e5e7eb', marginTop: '4px' }}>
                    <span>Costo Total</span>
                    <span>{formatCurrency(costoTotal)}</span>
                </div>
            </div>

            <div style={{ marginBottom: '14px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ color: '#4b5563' }}>Motivo</span>
                    <span>{movimiento.motivo || '—'}</span>
                </div>
                {movimiento.camion_id && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span style={{ color: '#4b5563' }}>Camión</span>
                        <span>ID: {movimiento.camion_id}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span style={{ color: '#4b5563' }}>Retira</span>
                    <span>{movimiento.usuario_id || '—'}</span>
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                {firmaImg ? (
                    <img src={firmaImg} alt="Firma" style={{ height: '70px', margin: '0 auto', display: 'block' }} />
                ) : (
                    <div style={{ height: '70px' }} />
                )}
                <div style={{ borderTop: '1px solid #000', marginTop: '4px', paddingTop: '4px', width: '70%', margin: '4px auto 0' }}>
                    <span style={{ fontSize: '11px' }}>Firma de quien recibe</span>
                </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '10px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '6px', marginTop: '12px' }}>
                Documento generado electrónicamente
            </div>
        </div>
    );
});

TicketSalidaPrint.displayName = 'TicketSalidaPrint';
