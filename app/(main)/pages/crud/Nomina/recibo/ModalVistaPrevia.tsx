"use client";

import React from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { ReciboNominaPrint } from './ReciboNominaPrint';

interface ModalVistaPreviaProps {
  visible: boolean;
  onHide: () => void;
  nomina: any;
}

export const ModalVistaPrevia: React.FC<ModalVistaPreviaProps> = ({ 
  visible, 
  onHide, 
  nomina 
}) => {
  const componentRef = React.useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!componentRef.current) return;

    const printContent = componentRef.current.innerHTML;
    
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    // Estilos optimizados para impresión horizontal
    const styles = `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          background: white !important;
          margin: 0 !important;
          padding: 20px !important;
          font-family: Arial, Helvetica, sans-serif !important;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        
        .recibo-print-container {
          max-width: 850px !important;
          margin: 0 auto !important;
          padding: 25px 30px !important;
          background: white !important;
          border: 1px solid #d1d5db !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
        }
        
        @media print {
          body {
            margin: 0 !important;
            padding: 10mm !important;
            background: white !important;
          }
          
          .recibo-print-container {
            border: 1px solid #000 !important;
            box-shadow: none !important;
            max-width: 100% !important;
            padding: 20px !important;
          }
          
          @page {
            size: landscape;
            margin: 8mm 10mm;
          }
        }
      </style>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recibo_Nomina_${nomina.empleado_nombre || 'empleado'}</title>
          ${styles}
        </head>
        <body>
          <div class="recibo-print-container">
            ${printContent}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const footerContent = (
    <div>
      <Button 
        label="Cancelar" 
        icon="pi pi-times" 
        onClick={onHide} 
        className="p-button-text" 
      />
      <Button 
        label="Imprimir" 
        icon="pi pi-print" 
        onClick={handlePrint} 
        autoFocus 
      />
    </div>
  );

  return (
    <Dialog 
      header="Vista Previa del Recibo" 
      visible={visible} 
      style={{ width: '95vw', maxWidth: '950px' }} 
      footer={footerContent}
      onHide={onHide}
      className="vista-previa-modal"
      contentStyle={{ overflow: 'auto', padding: '20px', background: '#f3f4f6' }}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div ref={componentRef}>
          <ReciboNominaPrint nomina={nomina} />
        </div>
      </div>
    </Dialog>
  );
};