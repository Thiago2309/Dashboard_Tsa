'use client';
import { Button } from 'primereact/button';
import React, { useRef } from 'react';

interface FirmaCanvasProps {
    label: string;
    value: string | null;
    onChange: (firma: string | null) => void;
    invalid?: boolean;
}

const ANCHO = 500;
const ALTO = 160;

// Recuadro para firmar con mouse o con el dedo. Devuelve la firma como PNG en base64.
const FirmaCanvas = ({ label, value, onChange, invalid }: FirmaCanvasProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dibujando = useRef(false);
    const trazoHecho = useRef(false);

    // El canvas se muestra al 100% del ancho, así que hay que escalar las coordenadas
    const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) * canvas.width) / rect.width,
            y: ((e.clientY - rect.top) * canvas.height) / rect.height
        };
    };

    const iniciarTrazo = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dibujando.current = true;
        const ctx = canvasRef.current!.getContext('2d')!;
        const { x, y } = getPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const trazar = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!dibujando.current) return;
        const ctx = canvasRef.current!.getContext('2d')!;
        const { x, y } = getPos(e);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineTo(x, y);
        ctx.stroke();
        trazoHecho.current = true;
    };

    const terminarTrazo = () => {
        if (!dibujando.current) return;
        dibujando.current = false;
        if (trazoHecho.current) onChange(canvasRef.current!.toDataURL('image/png'));
    };

    const limpiar = () => {
        const canvas = canvasRef.current;
        if (canvas) canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
        trazoHecho.current = false;
        onChange(null);
    };

    return (
        <div className="field">
            <div className="flex align-items-center justify-content-between mb-2">
                <label className="m-0">{label}</label>
                {value && <Button label="Firmar de nuevo" icon="pi pi-eraser" text size="small" onClick={limpiar} type="button" />}
            </div>
            {value ? (
                <div className="border-1 surface-border border-round p-2 text-center" style={{ background: '#fff' }}>
                    <img src={value} alt={label} style={{ maxWidth: '100%', height: 120, objectFit: 'contain' }} />
                </div>
            ) : (
                <>
                    <canvas
                        ref={canvasRef}
                        width={ANCHO}
                        height={ALTO}
                        className={`border-1 border-round w-full ${invalid ? 'border-red-500' : 'surface-border'}`}
                        style={{ background: '#fff', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
                        onPointerDown={iniciarTrazo}
                        onPointerMove={trazar}
                        onPointerUp={terminarTrazo}
                        onPointerLeave={terminarTrazo}
                    />
                    <small className={invalid ? 'p-error' : 'text-500'}>
                        {invalid ? 'La firma es requerida' : 'Firme dentro del recuadro'}
                    </small>
                </>
            )}
        </div>
    );
};

export default FirmaCanvas;
