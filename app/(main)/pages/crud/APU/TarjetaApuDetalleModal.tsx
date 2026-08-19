'use client';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import React, { useEffect, useRef, useState } from 'react';
import { fetchTarjetaApuPorId, TarjetaApu } from '../../../../../Services/BD/apu/tarjetasApuService';
import { TarjetaApuPrint } from './TarjetaApuPrint';

interface TarjetaApuDetalleModalProps {
    visible: boolean;
    idTarjeta: number | null;
    onHide: () => void;
}

export const TarjetaApuDetalleModal: React.FC<TarjetaApuDetalleModalProps> = ({ visible, idTarjeta, onHide }) => {
    const [tarjeta, setTarjeta] = useState<TarjetaApu | null>(null);
    const [loading, setLoading] = useState(false);
    const componentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!visible || !idTarjeta) return;

        setLoading(true);
        fetchTarjetaApuPorId(idTarjeta)
            .then(setTarjeta)
            .finally(() => setLoading(false));
    }, [visible, idTarjeta]);

    const handlePrint = () => {
        if (!componentRef.current) return;

        const printContent = componentRef.current.innerHTML;
        const printWindow = window.open('', '_blank', 'width=1000,height=800');
        if (!printWindow) return;

        const styles = `
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: white !important;
                    font-family: Arial, Helvetica, sans-serif !important;
                    padding: 20px !important;
                }
                @media print {
                    body { padding: 10mm !important; }
                    @page { size: portrait; margin: 10mm; }
                }
            </style>
        `;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8" />
                    <title>Analisis_Precio_Unitario_${tarjeta?.concepto_clave || ''}</title>
                    ${styles}
                </head>
                <body>${printContent}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };

    const footer = (
        <div>
            <Button label="Cerrar" icon="pi pi-times" className="p-button-text" onClick={onHide} />
            <Button label="Imprimir" icon="pi pi-print" onClick={handlePrint} disabled={!tarjeta} autoFocus />
        </div>
    );

    return (
        <Dialog header="Tarjeta de Precio Unitario" visible={visible} style={{ width: '95vw', maxWidth: '950px' }} footer={footer} onHide={onHide} contentStyle={{ overflow: 'auto', background: '#f3f4f6', padding: '20px' }}>
            {loading && (
                <div className="flex justify-content-center p-5">
                    <i className="pi pi-spinner pi-spin" style={{ fontSize: '2rem' }} />
                </div>
            )}
            {!loading && tarjeta && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <TarjetaApuPrint ref={componentRef} tarjeta={tarjeta} />
                </div>
            )}
        </Dialog>
    );
};

export default TarjetaApuDetalleModal;
