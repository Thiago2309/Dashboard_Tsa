'use client';
import React, { forwardRef } from 'react';
import { TarjetaApu, TarjetaInsumoApu } from '../../../../../Services/BD/apu/tarjetasApuService';
import { TipoInsumoApu } from '../../../../../Services/BD/apu/insumosApuService';
import { convertirImporteALetras } from '../../../../../Services/BD/apu/numeroALetrasApu';

interface TarjetaApuPrintProps {
    tarjeta: TarjetaApu;
}

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
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: 'center' };
const seccionRowStyle: React.CSSProperties = { ...tdBase, fontWeight: 'bold', textDecoration: 'underline', paddingTop: '8px' };
const subtotalRowStyle: React.CSSProperties = { ...tdBase, fontWeight: 'bold', borderTop: '1px solid #000' };
const finalRowStyle: React.CSSProperties = { ...tdBase, fontWeight: 'bold', borderTop: '1px solid #000', borderBottom: '3px double #000', fontSize: '13px' };

const SECCIONES: { tipo: TipoInsumoApu; titulo: string }[] = [
    { tipo: 'MATERIAL', titulo: 'MATERIALES' },
    { tipo: 'MANO_OBRA', titulo: 'MANO DE OBRA' },
    { tipo: 'MAQUINARIA', titulo: 'MAQUINARIA Y EQUIPO' }
];

export const TarjetaApuPrint = forwardRef<HTMLDivElement, TarjetaApuPrintProps>(({ tarjeta }, ref) => {
    const insumos = tarjeta.insumos || [];
    const costoDirecto = tarjeta.costo_directo || 0;
    const pctDe = (importe: number) => (costoDirecto > 0 ? (importe / costoDirecto) * 100 : 0);

    const renderFilaInsumo = (i: TarjetaInsumoApu) => {
        const importe = (i.cantidad || 0) * (i.precio_unitario || 0);
        return (
            <tr key={`${i.tipo}-${i.id_insumo}`}>
                <td style={tdBase}>{i.insumo_clave}</td>
                <td style={tdBase}>{i.insumo_descripcion}</td>
                <td style={tdCenter}>{i.insumo_unidad}</td>
                <td style={tdRight}>{formatMoney(i.precio_unitario)}</td>
                <td style={tdRight}>{formatQty(i.cantidad)}</td>
                <td style={tdRight}>{formatMoney(importe)}</td>
                <td style={tdRight}>{formatPct(pctDe(importe))}</td>
            </tr>
        );
    };

    const renderSeccion = (tipo: TipoInsumoApu, titulo: string, subtotal: number) => {
        const filas = insumos.filter((i) => i.tipo === tipo);
        if (filas.length === 0) return null;

        return (
            <React.Fragment key={tipo}>
                <tr>
                    <td colSpan={7} style={seccionRowStyle}>
                        {titulo}
                    </td>
                </tr>
                {filas.map(renderFilaInsumo)}
                <tr>
                    <td colSpan={5} style={{ ...subtotalRowStyle, textAlign: 'right' }}>
                        Subtotal: {titulo}
                    </td>
                    <td style={subtotalRowStyle}>{formatMoney(subtotal)}</td>
                    <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>{formatPct(pctDe(subtotal))}</td>
                </tr>
            </React.Fragment>
        );
    };

    const renderLineaResumen = (etiqueta: string, pct: number | undefined, monto: number, destacado = false) => (
        <tr>
            <td colSpan={2} style={destacado ? { ...subtotalRowStyle, textAlign: 'left' } : tdBase}>
                {etiqueta}
            </td>
            <td style={tdCenter}>{pct !== undefined ? formatPct(pct) : ''}</td>
            <td colSpan={2}></td>
            <td style={destacado ? subtotalRowStyle : tdRight}>{formatMoney(monto)}</td>
            <td></td>
        </tr>
    );

    const subtotalTrasIndirectos = costoDirecto + (tarjeta.monto_indirectos || 0) + (tarjeta.monto_financiamiento || 0);

    return (
        <div
            ref={ref}
            style={{
                width: '100%',
                maxWidth: '900px',
                margin: '0 auto',
                background: 'white',
                padding: '20px 25px',
                fontFamily: 'Arial, Helvetica, sans-serif',
                color: '#000'
            }}
        >
            <h2 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '1px' }}>Análisis de Precios Unitarios</h2>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                <thead>
                    <tr>
                        <th style={{ ...th, width: '11%' }}>Código</th>
                        <th style={{ ...th, width: '35%' }}>Concepto</th>
                        <th style={{ ...th, width: '8%' }}>Unidad</th>
                        <th style={{ ...th, width: '10%' }}>Costo</th>
                        <th style={{ ...th, width: '11%' }}>Cantidad</th>
                        <th style={{ ...th, width: '12%' }}>Importe</th>
                        <th style={{ ...th, width: '8%' }}>%</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colSpan={7} style={{ ...tdBase, paddingTop: '8px' }}>
                            <b>Análisis: {tarjeta.concepto_clave}</b>
                            &nbsp;&nbsp;&nbsp;&nbsp;
                            <b>Unidad: {tarjeta.concepto_unidad}.</b>
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={7} style={{ ...tdBase, paddingBottom: '8px' }}>
                            {tarjeta.concepto_descripcion}
                        </td>
                    </tr>

                    {SECCIONES.map((s) =>
                        renderSeccion(s.tipo, s.titulo, s.tipo === 'MATERIAL' ? tarjeta.costo_materiales || 0 : s.tipo === 'MANO_OBRA' ? tarjeta.costo_mano_obra || 0 : tarjeta.costo_maquinaria || 0)
                    )}

                    {(tarjeta.costo_herramienta || 0) > 0 && renderLineaResumen(`Herramienta Menor (${tarjeta.pct_herramienta || 0}% de Mano de Obra)`, undefined, tarjeta.costo_herramienta || 0)}

                    <tr>
                        <td colSpan={5} style={{ ...subtotalRowStyle, textAlign: 'right' }}>
                            Costo Directo
                        </td>
                        <td style={subtotalRowStyle}>{formatMoney(costoDirecto)}</td>
                        <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>100.00%</td>
                    </tr>

                    {renderLineaResumen('Indirectos', tarjeta.pct_indirectos, tarjeta.monto_indirectos || 0)}
                    {(tarjeta.pct_financiamiento || 0) > 0 && renderLineaResumen('Financiamiento', tarjeta.pct_financiamiento, tarjeta.monto_financiamiento || 0)}

                    <tr>
                        <td colSpan={5} style={{ ...tdBase, textAlign: 'right', fontWeight: 'bold' }}>
                            Subtotal
                        </td>
                        <td style={{ ...tdBase, fontWeight: 'bold' }}>{formatMoney(subtotalTrasIndirectos)}</td>
                        <td></td>
                    </tr>

                    {renderLineaResumen('Utilidad', tarjeta.pct_utilidad, tarjeta.monto_utilidad || 0)}
                    {(tarjeta.pct_cargos_adicionales || 0) > 0 && renderLineaResumen('Cargos Adicionales', tarjeta.pct_cargos_adicionales, tarjeta.monto_cargos_adicionales || 0)}

                    <tr>
                        <td colSpan={5} style={{ ...finalRowStyle, textAlign: 'right' }}>
                            PRECIO UNITARIO
                        </td>
                        <td style={finalRowStyle}>{formatMoney(tarjeta.precio_unitario || 0)}</td>
                        <td style={finalRowStyle}></td>
                    </tr>

                    <tr>
                        <td colSpan={7} style={{ ...tdBase, textAlign: 'center', paddingTop: '10px', fontStyle: 'italic' }}>
                            ( * {convertirImporteALetras(tarjeta.precio_unitario || 0)} * )
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
});

TarjetaApuPrint.displayName = 'TarjetaApuPrint';

export default TarjetaApuPrint;
