'use client';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import React, { useRef } from 'react';
import { InsumoExplosionApu } from '../../../../../Services/BD/apu/explosionInsumosApuService';
import { ListadoInsumosPrint } from './ListadoInsumosPrint';

interface ListadoInsumosDetalleModalProps {
    visible: boolean;
    insumos: InsumoExplosionApu[];
    titulo?: string;
    onHide: () => void;
}

export const ListadoInsumosDetalleModal: React.FC<ListadoInsumosDetalleModalProps> = ({ visible, insumos, titulo, onHide }) => {
    const componentRef = useRef<HTMLDivElement>(null);

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
                    <title>Listado_de_Insumos</title>
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
            <Button label="Imprimir" icon="pi pi-print" onClick={handlePrint} autoFocus />
        </div>
    );

    return (
        <Dialog header="Listado de Insumos" visible={visible} style={{ width: '95vw', maxWidth: '1050px' }} footer={footer} onHide={onHide} contentStyle={{ overflow: 'auto', background: '#f3f4f6', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ListadoInsumosPrint ref={componentRef} insumos={insumos} titulo={titulo} />
            </div>
        </Dialog>
    );
};

export default ListadoInsumosDetalleModal;
