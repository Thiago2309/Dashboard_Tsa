'use client';
import React, { forwardRef } from 'react';
import { InsumoExplosionApu } from '../../../../../Services/BD/apu/explosionInsumosApuService';

interface ListadoInsumosPrintProps {
    titulo?: string;
    insumos: InsumoExplosionApu[];
}

const ID_HERRAMIENTA_MENOR = -1;

const formatMoney = (v = 0) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const formatQty = (v = 0) => v.toFixed(4);
const formatPct = (v = 0) => `${v.toFixed(2)}%`;

const th: React.CSSProperties = {
    border: '1px solid #000',
    borderTop: 'none',
    borderBottom: '2px solid #000',
    padding: '4px 6px',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: '11px'
};

const tdBase: React.CSSProperties = { padding: '2px 6px', fontSize: '11px', verticalAlign: 'top' };
const tdRight: React.CSSProperties = { ...tdBase, textAlign: 'right' };
const seccionRowStyle: React.CSSProperties = { ...tdBase, fontWeight: 'bold', paddingTop: '8px' };
const subtotalRowStyle: React.CSSProperties = { ...tdBase, fontWeight: 'bold', borderTop: '1px solid #000' };

const GRUPOS: { tipos: string[]; titulo: string }[] = [
    { tipos: ['MATERIAL'], titulo: 'MATERIALES' },
    { tipos: ['MANO_OBRA'], titulo: 'MANO DE OBRA' },
    { tipos: ['MAQUINARIA', 'HERRAMIENTA'], titulo: 'EQUIPO Y HERRAMIENTA' }
];

export const ListadoInsumosPrint = forwardRef<HTMLDivElement, ListadoInsumosPrintProps>(({ titulo = 'Listado de Insumos que Interviene en la Integración de la Propuesta', insumos }, ref) => {
    const totalPorGrupo = GRUPOS.map((g) => insumos.filter((i) => g.tipos.includes(i.tipo)).reduce((acc, i) => acc + i.importe_total, 0));
    const granTotal = totalPorGrupo.reduce((a, b) => a + b, 0);
    const pctDe = (v: number) => (granTotal > 0 ? (v / granTotal) * 100 : 0);

    const renderFila = (i: InsumoExplosionApu) => {
        const esHerramienta = i.id_insumo === ID_HERRAMIENTA_MENOR;
        return (
            <tr key={`${i.tipo}-${i.id_insumo}`}>
                <td style={tdBase}>{i.clave}</td>
                <td style={tdBase}>{i.descripcion}</td>
                <td style={tdBase}>{i.unidad}</td>
                <td style={tdRight}>{esHerramienta ? '' : formatQty(i.cantidad_total)}</td>
                <td style={tdRight}>{esHerramienta ? '' : formatMoney(i.precio_unitario)}</td>
                <td style={tdRight}>{formatMoney(i.importe_total)}</td>
                <td style={tdRight}>{formatPct(pctDe(i.importe_total))}</td>
            </tr>
        );
    };

    const renderGrupo = (tipos: string[], titulo: string, subtotal: number) => {
        const filas = insumos.filter((i) => tipos.includes(i.tipo));
        if (filas.length === 0) return null;

        return (
            <React.Fragment key={titulo}>
                <tr>
                    <td colSpan={7} style={seccionRowStyle}>
                        {titulo}
                    </td>
                </tr>
                {filas.map(renderFila)}
                <tr>
                    <td colSpan={4} style={{ ...subtotalRowStyle, textAlign: 'left' }}>
                        Total {titulo}
                    </td>
                    <td></td>
                    <td style={subtotalRowStyle}>{formatMoney(subtotal)}</td>
                    <td></td>
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
                color: '#000'
            }}
        >
            <h2 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', textTransform: 'uppercase', marginBottom: '14px' }}>{titulo}</h2>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                <thead>
                    <tr>
                        <th style={{ ...th, width: '13%' }}>Código</th>
                        <th style={{ ...th, width: '33%' }}>Concepto</th>
                        <th style={{ ...th, width: '8%' }}>Unidad</th>
                        <th style={{ ...th, width: '12%' }}>Cantidad</th>
                        <th style={{ ...th, width: '11%' }}>Precio</th>
                        <th style={{ ...th, width: '13%' }}>Importe</th>
                        <th style={{ ...th, width: '10%' }}>% Incid.</th>
                    </tr>
                </thead>
                <tbody>{GRUPOS.map((g, idx) => renderGrupo(g.tipos, g.titulo, totalPorGrupo[idx]))}</tbody>
            </table>

            <div style={{ marginTop: '24px', maxWidth: '420px' }}>
                <h3 style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>TOTALES DE INSUMOS</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ ...tdBase, textAlign: 'left', fontWeight: 'bold' }}></th>
                            <th style={{ ...tdBase, textAlign: 'right', fontWeight: 'bold' }}>Importe</th>
                            <th style={{ ...tdBase, textAlign: 'right', fontWeight: 'bold' }}>%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {['Materiales', 'Mano de obra', 'Equipo'].map((etiqueta, idx) => (
                            <tr key={etiqueta}>
                                <td style={tdBase}>{etiqueta}</td>
                                <td style={tdRight}>{formatMoney(totalPorGrupo[idx])}</td>
                                <td style={tdRight}>{formatPct(pctDe(totalPorGrupo[idx]))}</td>
                            </tr>
                        ))}
                        <tr>
                            <td style={{ ...tdBase, fontWeight: 'bold', borderTop: '1px solid #000' }}>Total</td>
                            <td style={{ ...tdRight, fontWeight: 'bold', borderTop: '1px solid #000' }}>{formatMoney(granTotal)}</td>
                            <td style={{ ...tdRight, fontWeight: 'bold', borderTop: '1px solid #000' }}>100.00%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
});

ListadoInsumosPrint.displayName = 'ListadoInsumosPrint';

export default ListadoInsumosPrint;
