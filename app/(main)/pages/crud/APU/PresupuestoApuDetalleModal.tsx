'use client';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import React, { useEffect, useRef, useState } from 'react';
import { exportarPresupuestoApuExcel, fetchPresupuestoApuPorId, PresupuestoApu } from '../../../../../Services/BD/apu/presupuestosApuService';
import { PresupuestoApuPrint } from './PresupuestoApuPrint';

interface PresupuestoApuDetalleModalProps {
    visible: boolean;
    idPresupuesto: number | null;
    onHide: () => void;
}

export const PresupuestoApuDetalleModal: React.FC<PresupuestoApuDetalleModalProps> = ({ visible, idPresupuesto, onHide }) => {
    const [presupuesto, setPresupuesto] = useState<PresupuestoApu | null>(null);
    const [loading, setLoading] = useState(false);
    const [exportando, setExportando] = useState(false);
    const componentRef = useRef<HTMLDivElement>(null);
    const toast = useRef<Toast>(null);

    useEffect(() => {
        if (!visible || !idPresupuesto) return;

        setLoading(true);
        fetchPresupuestoApuPorId(idPresupuesto)
            .then(setPresupuesto)
            .finally(() => setLoading(false));
    }, [visible, idPresupuesto]);

    const handlePrint = () => {
        if (!componentRef.current) return;

        const printContent = componentRef.current.innerHTML;
        const printWindow = window.open('', '_blank', 'width=1100,height=800');
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
                    <title>Presupuesto_${presupuesto?.nombre || ''}</title>
                    ${styles}
                </head>
                <body>${printContent}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };

    const handleExportar = async () => {
        if (!presupuesto) return;
        setExportando(true);
        try {
            await exportarPresupuestoApuExcel(presupuesto);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al exportar el presupuesto a Excel', life: 3000 });
        } finally {
            setExportando(false);
        }
    };

    const footer = (
        <div>
            <Button label="Cerrar" icon="pi pi-times" className="p-button-text" onClick={onHide} />
            <Button label="Exportar a Excel" icon="pi pi-file-excel" severity="success" onClick={handleExportar} loading={exportando} disabled={!presupuesto} className="mr-2" />
            <Button label="Imprimir" icon="pi pi-print" onClick={handlePrint} disabled={!presupuesto} autoFocus />
        </div>
    );

    return (
        <Dialog header="Presupuesto de Obra" visible={visible} style={{ width: '95vw', maxWidth: '1050px' }} footer={footer} onHide={onHide} contentStyle={{ overflow: 'auto', background: '#f3f4f6', padding: '20px' }}>
            <Toast ref={toast} />
            {loading && (
                <div className="flex justify-content-center p-5">
                    <i className="pi pi-spinner pi-spin" style={{ fontSize: '2rem' }} />
                </div>
            )}
            {!loading && presupuesto && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <PresupuestoApuPrint ref={componentRef} presupuesto={presupuesto} />
                </div>
            )}
        </Dialog>
    );
};

export default PresupuestoApuDetalleModal;
