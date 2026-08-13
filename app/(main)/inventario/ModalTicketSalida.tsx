"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { TicketSalidaPrint } from './TicketSalidaPrint';
import { MovimientoInventario } from '../../../Services/BD/inventario/inventarioService';

interface ModalTicketSalidaProps {
    visible: boolean;
    onHide: () => void;
    movimiento: MovimientoInventario | null;
}

export const ModalTicketSalida: React.FC<ModalTicketSalidaProps> = ({ visible, onHide, movimiento }) => {
    const componentRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dibujando = useRef(false);

    const [firmando, setFirmando] = useState(false);
    const [firmaImg, setFirmaImg] = useState<string | null>(null);
    const [firmaVacia, setFirmaVacia] = useState(true);

    useEffect(() => {
        if (!visible) {
            setFirmando(false);
            setFirmaImg(null);
            setFirmaVacia(true);
        }
    }, [visible]);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const point = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
        return { x: point.clientX - rect.left, y: point.clientY - rect.top };
    };

    const iniciarTrazo = (e: React.MouseEvent | React.TouchEvent) => {
        dibujando.current = true;
        const ctx = canvasRef.current!.getContext('2d')!;
        const { x, y } = getPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const trazar = (e: React.MouseEvent | React.TouchEvent) => {
        if (!dibujando.current) return;
        const ctx = canvasRef.current!.getContext('2d')!;
        const { x, y } = getPos(e);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineTo(x, y);
        ctx.stroke();
        setFirmaVacia(false);
    };

    const terminarTrazo = () => {
        dibujando.current = false;
    };

    const limpiarFirma = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
        }
        setFirmaVacia(true);
    };

    const guardarFirma = () => {
        if (!canvasRef.current || firmaVacia) return;
        setFirmaImg(canvasRef.current.toDataURL('image/png'));
        setFirmando(false);
    };

    const rehacerFirma = () => {
        setFirmaImg(null);
        setFirmando(true);
        setTimeout(limpiarFirma, 0);
    };

    const handlePrint = () => {
        if (!componentRef.current) return;

        const printContent = componentRef.current.innerHTML;
        const printWindow = window.open('', '_blank', 'width=600,height=800');
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
          max-width: 480px !important;
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

        const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Ticket_Salida_${movimiento?.id || ''}</title>
          ${styles}
        </head>
        <body>
          <div class="ticket-print-container">${printContent}</div>
        </body>
      </html>
    `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => printWindow.print(), 500);
    };

    const footerContent = (
        <div>
            <Button label="Cerrar" icon="pi pi-times" onClick={onHide} className="p-button-text" />
            <Button label="Imprimir Ticket" icon="pi pi-print" onClick={handlePrint} autoFocus />
        </div>
    );

    if (!movimiento) return null;

    return (
        <Dialog
            header="Ticket de Salida"
            visible={visible}
            style={{ width: '95vw', maxWidth: '560px' }}
            footer={footerContent}
            onHide={onHide}
            contentStyle={{ overflow: 'auto', padding: '20px', background: '#f3f4f6' }}
        >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div ref={componentRef}>
                    <TicketSalidaPrint movimiento={movimiento} firmaImg={firmaImg} />
                </div>
            </div>

            <div className="mt-4 flex flex-column align-items-center gap-2">
                {!firmando && !firmaImg && (
                    <Button label="Firmar de Recibido" icon="pi pi-pencil" severity="secondary" onClick={() => setFirmando(true)} />
                )}

                {firmando && (
                    <>
                        <div className="text-sm text-600 mb-1">Firma dentro del recuadro</div>
                        <canvas
                            ref={canvasRef}
                            width={400}
                            height={140}
                            style={{ border: '1px dashed #9ca3af', borderRadius: '4px', background: 'white', touchAction: 'none' }}
                            onMouseDown={iniciarTrazo}
                            onMouseMove={trazar}
                            onMouseUp={terminarTrazo}
                            onMouseLeave={terminarTrazo}
                            onTouchStart={iniciarTrazo}
                            onTouchMove={trazar}
                            onTouchEnd={terminarTrazo}
                        />
                        <div className="flex gap-2 mt-2">
                            <Button label="Limpiar" icon="pi pi-refresh" text onClick={limpiarFirma} />
                            <Button label="Guardar Firma" icon="pi pi-check" onClick={guardarFirma} disabled={firmaVacia} />
                        </div>
                    </>
                )}

                {firmaImg && (
                    <Button label="Rehacer Firma" icon="pi pi-pencil" text onClick={rehacerFirma} />
                )}
            </div>
        </Dialog>
    );
};
