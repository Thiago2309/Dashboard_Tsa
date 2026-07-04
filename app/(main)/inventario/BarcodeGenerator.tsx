import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Inventario } from '../../../Services/BD/inventario/inventarioService';
import { Button } from 'primereact/button';

interface BarcodeGeneratorProps {
    producto: Inventario;
    showValue?: boolean; // Mostrar el número debajo del código
    height?: number;
    width?: number;
    format?: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC' | 'CODE39' | 'ITF' | 'MSI' | 'pharmacode' | 'codabar';
}

const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
    producto,
    showValue = true,
    height = 100,
    width = 2,
    format = 'CODE128'
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [mostrarAyuda, setMostrarAyuda] = useState(false);

    useEffect(() => {
        setMostrarAyuda(false);

        if (!svgRef.current) return;

        if (!producto.codigo_barras) {
            setMostrarAyuda(true);
            return;
        }

        try {
            JsBarcode(svgRef.current as any, producto.codigo_barras, {
                format: format,
                width: width,
                height: height,
                displayValue: showValue,
                fontSize: 20,
                font: 'monospace',
                textAlign: 'center',
                textPosition: 'bottom',
                textMargin: 5,
                margin: 10,
                background: '#ffffff',
                lineColor: '#000000'
            });
        } catch {
            setMostrarAyuda(true);
        }
    }, [producto.codigo_barras, format, width, height, showValue]);

    const downloadBarcode = async () => {
        if (svgRef.current) {
            try {
                // Convertir SVG a canvas
                const canvas = document.createElement('canvas');
                const svgData = new XMLSerializer().serializeToString(svgRef.current);
                const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);

                const img = new Image();
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0);
                    URL.revokeObjectURL(url);

                    // Descargar como PNG
                    const link = document.createElement('a');
                    link.download = `barcode-${producto.codigo}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                };
                img.src = url;
            } catch {
                // Se evita mostrar una alerta de error al usuario.
            }
        }
    };

    if (!producto.codigo_barras || mostrarAyuda) {
        return (
            <div className="text-center text-600 px-3 py-2">
                <i className="pi pi-info-circle mb-2" style={{ fontSize: '1.2rem' }} />
                <p className="m-0">No hay un código de barras disponible para este producto.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-column align-items-center">
            <div 
                className="bg-white p-3 border-1 border-gray-300 border-round"
                style={{ borderRadius: '8px' }}
            >
                <svg ref={svgRef}></svg>
            </div>
            {showValue && (
                <small className="mt-2 text-center text-sm text-gray-500">
                    {producto.codigo} - {producto.nombre}
                </small>
            )}
            <Button
                label="Descargar Código de Barras"
                icon="pi pi-download"
                className="mt-3 p-button-sm p-button-outlined"
                onClick={downloadBarcode}
            />
        </div>
    );
};

export default BarcodeGenerator;