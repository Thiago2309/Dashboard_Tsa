// app/(main)/pages/crud/Nomina/ModalVistaPrevia.tsx
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

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Añadir estilos para orientación horizontal
    const landscapeStyle = `
      <style>
        @page {
          size: landscape;
          margin: 0;
        }
        @media print {
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .landscape-layout {
            width: 100% !important;
            height: auto !important;
          }
        }
      </style>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Recibo_Nomina_${nomina.empleado_nombre}_Semana_${nomina.semana}_${nomina.anio}</title>
          ${landscapeStyle}
        </head>
        <body>
          ${componentRef.current.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    
    // Esperar a que se cargue el contenido antes de imprimir
    setTimeout(() => {
      printWindow.print();
    }, 250);
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
        style={{ width: '100vw', maxWidth: '1700px' }} 
        footer={footerContent}
        onHide={onHide}
        className="vista-previa-modal"
        contentStyle={{ overflow: 'auto' }}
    >
        <div className="flex justify-center">
            <div ref={componentRef} className="recibo-container">
                <ReciboNominaPrint nomina={nomina} />
            </div>
        </div>
    </Dialog>
  );
};