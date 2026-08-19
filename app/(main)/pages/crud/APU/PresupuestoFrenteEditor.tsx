'use client';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import React, { useState } from 'react';
import { calcularSubtotalFrente, PresupuestoConceptoApu, PresupuestoFrenteApu } from '../../../../../Services/BD/apu/presupuestosApuService';
import { TarjetaApu } from '../../../../../Services/BD/apu/tarjetasApuService';

const formatMoney = (v = 0) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

// Trunca la descripción del concepto en el Dropdown para que no empuje el resto de los controles
// del renglón fuera de la vista cuando el texto es muy largo.
const conceptoOptionTemplate = (option: TarjetaApu) => (
    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={option.concepto_descripcion}>
        <b>{option.concepto_clave}</b> — {option.concepto_descripcion}
    </div>
);

interface PresupuestoFrenteEditorProps {
    frente: PresupuestoFrenteApu;
    opcionesConcepto: TarjetaApu[];
    onRenombrar: (nombre: string) => void;
    onEliminarFrente: () => void;
    onAgregarConcepto: (linea: PresupuestoConceptoApu) => void;
    onQuitarConcepto: (id_concepto: number) => void;
    onCambiarCantidad: (id_concepto: number, cantidad: number) => void;
    onCambiarAplicaIva: (id_concepto: number, aplica: boolean) => void;
}

export const PresupuestoFrenteEditor: React.FC<PresupuestoFrenteEditorProps> = ({ frente, opcionesConcepto, onRenombrar, onEliminarFrente, onAgregarConcepto, onQuitarConcepto, onCambiarCantidad, onCambiarAplicaIva }) => {
    const [idConceptoParaAgregar, setIdConceptoParaAgregar] = useState<number | null>(null);
    const [cantidadParaAgregar, setCantidadParaAgregar] = useState<number>(0);
    const [aplicaIvaParaAgregar, setAplicaIvaParaAgregar] = useState<boolean>(true);

    const agregar = () => {
        if (!idConceptoParaAgregar || cantidadParaAgregar <= 0) return;

        const tarjeta = opcionesConcepto.find((t) => t.id === idConceptoParaAgregar);
        if (!tarjeta) return;

        onAgregarConcepto({
            id_concepto: tarjeta.id_concepto,
            concepto_clave: tarjeta.concepto_clave,
            concepto_descripcion: tarjeta.concepto_descripcion,
            concepto_unidad: tarjeta.concepto_unidad,
            orden: frente.conceptos.length,
            cantidad: cantidadParaAgregar,
            precio_unitario: tarjeta.precio_unitario || 0,
            aplica_iva: aplicaIvaParaAgregar
        });

        setIdConceptoParaAgregar(null);
        setCantidadParaAgregar(0);
        setAplicaIvaParaAgregar(true);
    };

    const subtotalFrente = calcularSubtotalFrente(frente);

    return (
        <div className="surface-card border-1 surface-border border-round p-3 mb-3">
            <div className="flex align-items-center gap-2 mb-3">
                <InputText value={frente.nombre} onChange={(e) => onRenombrar(e.target.value)} placeholder="Nombre del Frente (p.ej. Frente 1: Terracerías en Sicilia)" className="flex-grow-1" />
                <span className="font-bold white-space-nowrap">{formatMoney(subtotalFrente)}</span>
                <Button icon="pi pi-trash" rounded text severity="danger" onClick={onEliminarFrente} tooltip="Eliminar Frente" tooltipOptions={{ position: 'top' }} />
            </div>

            <DataTable value={frente.conceptos} emptyMessage="Agrega conceptos a este Frente." className="mb-3">
                <Column field="concepto_clave" header="Clave" style={{ width: '100px' }}></Column>
                <Column field="concepto_descripcion" header="Concepto"></Column>
                <Column field="concepto_unidad" header="Unidad" style={{ width: '80px' }}></Column>
                <Column
                    header="Cantidad"
                    style={{ width: '130px' }}
                    body={(row: PresupuestoConceptoApu) => <InputNumber value={row.cantidad} onValueChange={(e) => onCambiarCantidad(row.id_concepto, e.value || 0)} mode="decimal" minFractionDigits={2} maxFractionDigits={4} min={0} />}
                ></Column>
                <Column header="P. Unitario" style={{ width: '110px' }} body={(row: PresupuestoConceptoApu) => formatMoney(row.precio_unitario)}></Column>
                <Column header="Importe" style={{ width: '120px' }} body={(row: PresupuestoConceptoApu) => formatMoney((row.cantidad || 0) * (row.precio_unitario || 0))}></Column>
                <Column
                    header="IVA"
                    style={{ width: '70px' }}
                    body={(row: PresupuestoConceptoApu) => <Checkbox checked={row.aplica_iva} onChange={(e) => onCambiarAplicaIva(row.id_concepto, e.checked ?? true)} tooltip="Aplica IVA" tooltipOptions={{ position: 'top' }} />}
                ></Column>
                <Column header="" style={{ width: '50px' }} body={(row: PresupuestoConceptoApu) => <Button icon="pi pi-trash" rounded text severity="danger" onClick={() => onQuitarConcepto(row.id_concepto)} />}></Column>
            </DataTable>

            <div className="flex gap-2 align-items-end flex-wrap">
                <div className="flex-grow-1" style={{ minWidth: '260px' }}>
                    <label className="block text-sm mb-1">Concepto (solo los que ya tienen Tarjeta de Precio Unitario)</label>
                    <Dropdown
                        value={idConceptoParaAgregar}
                        options={opcionesConcepto}
                        optionLabel="concepto_descripcion"
                        optionValue="id"
                        filter
                        placeholder="Selecciona un concepto"
                        onChange={(e) => setIdConceptoParaAgregar(e.value)}
                        itemTemplate={conceptoOptionTemplate}
                        valueTemplate={(option) => (option ? conceptoOptionTemplate(option) : <span>Selecciona un concepto</span>)}
                        className="w-full"
                        style={{ minWidth: 0 }}
                    />
                </div>
                <div style={{ width: '150px', flexShrink: 0 }}>
                    <label className="block text-sm mb-1">Cantidad</label>
                    <InputNumber value={cantidadParaAgregar} onValueChange={(e) => setCantidadParaAgregar(e.value || 0)} mode="decimal" minFractionDigits={2} min={0} />
                </div>
                <div className="flex align-items-center gap-2" style={{ flexShrink: 0, paddingBottom: '8px' }}>
                    <Checkbox checked={aplicaIvaParaAgregar} onChange={(e) => setAplicaIvaParaAgregar(e.checked ?? true)} inputId={`iva-${frente.nombre}`} />
                    <label htmlFor={`iva-${frente.nombre}`} className="text-sm">
                        Aplica IVA
                    </label>
                </div>
                <Button icon="pi pi-plus" label="Agregar" onClick={agregar} style={{ flexShrink: 0 }} />
            </div>
        </div>
    );
};

export default PresupuestoFrenteEditor;
