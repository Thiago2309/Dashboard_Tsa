'use client';
import React, { forwardRef } from 'react';
import { calcularSubtotalFrente, PresupuestoApu, PresupuestoConceptoApu, PresupuestoFrenteApu } from '../../../../../Services/BD/apu/presupuestosApuService';
import { convertirImporteALetras } from '../../../../../Services/BD/apu/numeroALetrasApu';

interface PresupuestoApuPrintProps {
    presupuesto: PresupuestoApu;
}

const formatMoney = (v = 0) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const formatQty = (v = 0) => v.toFixed(4);
const formatPct = (v = 0) => `${v.toFixed(2)}%`;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const formatFechaCorta = (fecha?: string): string => {
    if (!fecha) return '';
    const [anio, mes, dia] = fecha.split('-').map(Number);
    if (!anio || !mes || !dia) return fecha;
    return `${dia} de ${MESES[mes - 1]} de ${String(anio).slice(-2)}`;
};

const th: React.CSSProperties = {
    border: '1px solid #000',
    borderTop: 'none',
    borderBottom: '2px solid #000',
    padding: '4px 6px',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: '11px'
};

const tdBase: React.CSSProperties = { padding: '3px 6px', fontSize: '11px', verticalAlign: 'top' };
const tdRight: React.CSSProperties = { ...tdBase, textAlign: 'right' };
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: 'center' };
const frenteRowStyle: React.CSSProperties = { ...tdBase, fontWeight: 'bold', paddingTop: '8px' };
const subtotalRowStyle: React.CSSProperties = { ...tdBase, fontWeight: 'bold', borderTop: '1px solid #000' };
const finalRowStyle: React.CSSProperties = { ...tdBase, fontWeight: 'bold', borderTop: '1px solid #000', borderBottom: '3px double #000', fontSize: '13px' };

export const PresupuestoApuPrint = forwardRef<HTMLDivElement, PresupuestoApuPrintProps>(({ presupuesto }, ref) => {
    const frentes = presupuesto.frentes || [];
    const subtotal = presupuesto.subtotal || 0;
    const hayExentos = frentes.some((f) => f.conceptos.some((c) => !c.aplica_iva));

    const renderFila = (c: PresupuestoConceptoApu, pctDeFrente: (importe: number) => number) => {
        const importe = (c.cantidad || 0) * (c.precio_unitario || 0);
        return (
            <tr key={c.id ?? c.id_concepto}>
                <td style={tdBase}>{c.concepto_clave}</td>
                <td style={tdBase}>
                    {c.concepto_descripcion}
                    {!c.aplica_iva && ' *'}
                </td>
                <td style={tdCenter}>{c.concepto_unidad}</td>
                <td style={tdRight}>{formatQty(c.cantidad)}</td>
                <td style={tdRight}>{formatMoney(c.precio_unitario)}</td>
                <td style={tdRight}>{formatMoney(importe)}</td>
                <td style={tdRight}>{formatPct(pctDeFrente(importe))}</td>
            </tr>
        );
    };

    const renderFrente = (frente: PresupuestoFrenteApu) => {
        const subtotalFrente = calcularSubtotalFrente(frente);
        const pctDeFrente = (importe: number) => (subtotalFrente > 0 ? (importe / subtotalFrente) * 100 : 0);

        return (
            <React.Fragment key={frente.id ?? frente.nombre}>
                <tr>
                    <td colSpan={7} style={frenteRowStyle}>
                        {frente.nombre}
                    </td>
                </tr>
                {frente.conceptos.map((c) => renderFila(c, pctDeFrente))}
                <tr>
                    <td colSpan={5} style={{ ...subtotalRowStyle, textAlign: 'right' }}>
                        Total {frente.nombre}
                    </td>
                    <td style={subtotalRowStyle}>{formatMoney(subtotalFrente)}</td>
                    <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>100.00%</td>
                </tr>
            </React.Fragment>
        );
    };

    return (
        <div
            ref={ref}
            style={{
                width: '100%',
                maxWidth: '950px',
                margin: '0 auto',
                background: 'white',
                padding: '20px 25px',
                fontFamily: 'Arial, Helvetica, sans-serif',
                color: '#000',
                fontSize: '12px'
            }}
        >
            <div style={{ border: '1px solid #000', padding: '14px 18px', marginBottom: '16px' }}>
                <h2 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '17px', marginBottom: '10px', textTransform: 'uppercase' }}>{presupuesto.empresa_nombre}</h2>

                <p style={{ marginBottom: '6px' }}>
                    <b>Dependencia:</b> {presupuesto.dependencia}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>
                        <b>Concurso No.</b> {presupuesto.concurso_no}
                    </span>
                    <span>
                        <b>Fecha:</b> {formatFechaCorta(presupuesto.fecha)}
                    </span>
                </div>

                <p style={{ marginBottom: '6px', whiteSpace: 'pre-line' }}>
                    <b>Obra:</b> {presupuesto.obra_nombre}
                </p>

                <p style={{ margin: 0 }}>
                    <b>Lugar:</b> {presupuesto.lugar}
                </p>
            </div>

            <h2 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', textTransform: 'uppercase', marginBottom: '12px' }}>Presupuesto de Obra</h2>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                <thead>
                    <tr>
                        <th style={{ ...th, width: '11%' }}>Código</th>
                        <th style={{ ...th, width: '33%' }}>Concepto</th>
                        <th style={{ ...th, width: '8%' }}>Unidad</th>
                        <th style={{ ...th, width: '11%' }}>Cantidad</th>
                        <th style={{ ...th, width: '12%' }}>P. Unitario</th>
                        <th style={{ ...th, width: '13%' }}>Importe</th>
                        <th style={{ ...th, width: '8%' }}>%</th>
                    </tr>
                </thead>
                <tbody>
                    {frentes.map(renderFrente)}

                    <tr>
                        <td colSpan={5} style={{ ...finalRowStyle, textAlign: 'right', borderBottom: '1px solid #000', fontSize: '11px' }}>
                            Total del Presupuesto
                        </td>
                        <td style={{ ...finalRowStyle, borderBottom: '1px solid #000', fontSize: '11px' }}>{formatMoney(subtotal)}</td>
                        <td style={{ ...finalRowStyle, borderBottom: '1px solid #000', fontSize: '11px' }}></td>
                    </tr>
                </tbody>
            </table>

            {hayExentos && <p style={{ fontSize: '10px', fontStyle: 'italic', marginTop: '4px' }}>* Exento de I.V.A.</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: '280px' }}>
                    <tbody>
                        <tr>
                            <td style={{ ...tdBase, textAlign: 'right' }}>Subtotal</td>
                            <td style={{ ...tdRight, minWidth: '120px' }}>{formatMoney(subtotal)}</td>
                        </tr>
                        <tr>
                            <td style={{ ...tdBase, textAlign: 'right' }}>I.V.A. ({presupuesto.pct_iva}%)</td>
                            <td style={tdRight}>{formatMoney(presupuesto.monto_iva)}</td>
                        </tr>
                        <tr>
                            <td style={{ ...finalRowStyle, textAlign: 'right' }}>Total</td>
                            <td style={finalRowStyle}>{formatMoney(presupuesto.total)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p style={{ textAlign: 'center', fontStyle: 'italic', marginTop: '10px' }}>( * {convertirImporteALetras(presupuesto.total || 0)} * )</p>
        </div>
    );
});

PresupuestoApuPrint.displayName = 'PresupuestoApuPrint';

export default PresupuestoApuPrint;
