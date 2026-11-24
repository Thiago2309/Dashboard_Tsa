'use client';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { SelectButton } from 'primereact/selectbutton';
import { Tag } from 'primereact/tag';
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

type ModoCaptura = 'catalogo' | 'manual';

const opcionesModo = [
    { label: 'Del catálogo', value: 'catalogo', icon: 'pi pi-list' },
    { label: 'Manual', value: 'manual', icon: 'pi pi-pencil' }
];

interface PresupuestoFrenteEditorProps {
    frente: PresupuestoFrenteApu;
    opcionesConcepto: TarjetaApu[];
    onRenombrar: (nombre: string) => void;
    onEliminarFrente: () => void;
    onAgregarConcepto: (linea: PresupuestoConceptoApu) => void;
    onQuitarConcepto: (indexConcepto: number) => void;
    onActualizarConcepto: (indexConcepto: number, cambios: Partial<PresupuestoConceptoApu>) => void;
}

export const PresupuestoFrenteEditor: React.FC<PresupuestoFrenteEditorProps> = ({ frente, opcionesConcepto, onRenombrar, onEliminarFrente, onAgregarConcepto, onQuitarConcepto, onActualizarConcepto }) => {
    const [modo, setModo] = useState<ModoCaptura>('catalogo');
    const [idConceptoParaAgregar, setIdConceptoParaAgregar] = useState<number | null>(null);
    const [cantidadParaAgregar, setCantidadParaAgregar] = useState<number>(0);
    const [aplicaIvaParaAgregar, setAplicaIvaParaAgregar] = useState<boolean>(true);

    // Captura manual (concepto que no existe en el catálogo)
    const [claveManual, setClaveManual] = useState('');
    const [descripcionManual, setDescripcionManual] = useState('');
    const [unidadManual, setUnidadManual] = useState('');
    const [precioManual, setPrecioManual] = useState<number>(0);
    const [intentoManual, setIntentoManual] = useState(false);

    const limpiarCaptura = () => {
        setIdConceptoParaAgregar(null);
        setCantidadParaAgregar(0);
        setAplicaIvaParaAgregar(true);
        setClaveManual('');
        setDescripcionManual('');
        setUnidadManual('');
        setPrecioManual(0);
        setIntentoManual(false);
    };

    const agregarDelCatalogo = () => {
        if (!idConceptoParaAgregar || cantidadParaAgregar <= 0) return;

        const tarjeta = opcionesConcepto.find((t) => t.id === idConceptoParaAgregar);
        if (!tarjeta) return;

        onAgregarConcepto({
            id_concepto: tarjeta.id_concepto,
            es_manual: false,
            concepto_clave: tarjeta.concepto_clave,
            concepto_descripcion: tarjeta.concepto_descripcion,
            concepto_unidad: tarjeta.concepto_unidad,
            orden: frente.conceptos.length,
            cantidad: cantidadParaAgregar,
            precio_unitario: tarjeta.precio_unitario || 0,
            aplica_iva: aplicaIvaParaAgregar
        });

        limpiarCaptura();
    };

    const agregarManual = () => {
        setIntentoManual(true);
        if (!descripcionManual.trim() || !unidadManual.trim() || cantidadParaAgregar <= 0) return;

        onAgregarConcepto({
            id_concepto: null,
            es_manual: true,
            concepto_clave: claveManual.trim(),
            concepto_descripcion: descripcionManual.trim(),
            concepto_unidad: unidadManual.trim(),
            orden: frente.conceptos.length,
            cantidad: cantidadParaAgregar,
            precio_unitario: precioManual || 0,
            aplica_iva: aplicaIvaParaAgregar
        });

        limpiarCaptura();
    };

    const subtotalFrente = calcularSubtotalFrente(frente);
    const idIva = `iva-${frente.id ?? frente.nombre}`;

    // En los renglones manuales, clave/descripción/unidad/P. Unitario se pueden corregir directo en la tabla.
    const textoEditable = (campo: 'concepto_clave' | 'concepto_descripcion' | 'concepto_unidad') => (row: PresupuestoConceptoApu, opts: { rowIndex: number }) =>
        row.es_manual ? <InputText value={row[campo] || ''} onChange={(e) => onActualizarConcepto(opts.rowIndex, { [campo]: e.target.value })} className="p-inputtext-sm w-full" /> : row[campo];

    return (
        <div className="surface-card border-1 surface-border border-round p-3 mb-3">
            <div className="flex align-items-center gap-2 mb-3">
                <InputText value={frente.nombre} onChange={(e) => onRenombrar(e.target.value)} placeholder="Nombre del Frente (p.ej. Frente 1: Terracerías en Sicilia)" className="flex-grow-1" />
                <span className="font-bold white-space-nowrap">{formatMoney(subtotalFrente)}</span>
                <Button icon="pi pi-trash" rounded text severity="danger" onClick={onEliminarFrente} tooltip="Eliminar Frente" tooltipOptions={{ position: 'top' }} />
            </div>

            <DataTable value={frente.conceptos} emptyMessage="Agrega conceptos a este Frente." className="mb-3">
                <Column header="Clave" style={{ width: '110px' }} body={textoEditable('concepto_clave')}></Column>
                <Column
                    header="Concepto"
                    body={(row: PresupuestoConceptoApu, opts: { rowIndex: number }) => (
                        <div className="flex align-items-center gap-2">
                            {row.es_manual && <Tag value="Manual" severity="warning" />}
                            <div className="flex-grow-1">{textoEditable('concepto_descripcion')(row, opts)}</div>
                        </div>
                    )}
                ></Column>
                <Column header="Unidad" style={{ width: '90px' }} body={textoEditable('concepto_unidad')}></Column>
                <Column
                    header="Cantidad"
                    style={{ width: '130px' }}
                    body={(row: PresupuestoConceptoApu, opts: { rowIndex: number }) => (
                        <InputNumber value={row.cantidad} onValueChange={(e) => onActualizarConcepto(opts.rowIndex, { cantidad: e.value || 0 })} mode="decimal" minFractionDigits={2} maxFractionDigits={4} min={0} />
                    )}
                ></Column>
                <Column
                    header="P. Unitario"
                    style={{ width: '130px' }}
                    body={(row: PresupuestoConceptoApu, opts: { rowIndex: number }) =>
                        row.es_manual ? (
                            <InputNumber value={row.precio_unitario} onValueChange={(e) => onActualizarConcepto(opts.rowIndex, { precio_unitario: e.value || 0 })} mode="currency" currency="MXN" locale="es-MX" min={0} />
                        ) : (
                            formatMoney(row.precio_unitario)
                        )
                    }
                ></Column>
                <Column header="Importe" style={{ width: '120px' }} body={(row: PresupuestoConceptoApu) => formatMoney((row.cantidad || 0) * (row.precio_unitario || 0))}></Column>
                <Column
                    header="IVA"
                    style={{ width: '70px' }}
                    body={(row: PresupuestoConceptoApu, opts: { rowIndex: number }) => (
                        <Checkbox checked={row.aplica_iva} onChange={(e) => onActualizarConcepto(opts.rowIndex, { aplica_iva: e.checked ?? true })} tooltip="Aplica IVA" tooltipOptions={{ position: 'top' }} />
                    )}
                ></Column>
                <Column header="" style={{ width: '50px' }} body={(_row: PresupuestoConceptoApu, opts: { rowIndex: number }) => <Button icon="pi pi-trash" rounded text severity="danger" onClick={() => onQuitarConcepto(opts.rowIndex)} />}></Column>
            </DataTable>

            <div className="mb-2">
                <SelectButton value={modo} options={opcionesModo} onChange={(e) => e.value && setModo(e.value)} itemTemplate={(o) => (
                    <span>
                        <i className={`${o.icon} mr-2`} />
                        {o.label}
                    </span>
                )} style={{ width: 'auto', display: 'inline-flex' }} />
            </div>

            {modo === 'catalogo' ? (
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
                        <Checkbox checked={aplicaIvaParaAgregar} onChange={(e) => setAplicaIvaParaAgregar(e.checked ?? true)} inputId={idIva} />
                        <label htmlFor={idIva} className="text-sm">
                            Aplica IVA
                        </label>
                    </div>
                    <Button icon="pi pi-plus" label="Agregar" onClick={agregarDelCatalogo} style={{ flexShrink: 0, width: 'auto' }} />
                </div>
            ) : (
                <div className="flex gap-2 align-items-end flex-wrap">
                    <div style={{ width: '110px', flexShrink: 0 }}>
                        <label className="block text-sm mb-1">Clave</label>
                        <InputText value={claveManual} onChange={(e) => setClaveManual(e.target.value)} placeholder="Opcional" />
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: '240px' }}>
                        <label className="block text-sm mb-1">Concepto (escrito a mano)</label>
                        <InputText value={descripcionManual} onChange={(e) => setDescripcionManual(e.target.value)} placeholder="Descripción del concepto" className={intentoManual && !descripcionManual.trim() ? 'p-invalid' : ''} />
                    </div>
                    <div style={{ width: '90px', flexShrink: 0 }}>
                        <label className="block text-sm mb-1">Unidad</label>
                        <InputText value={unidadManual} onChange={(e) => setUnidadManual(e.target.value)} placeholder="m3, viaje..." className={intentoManual && !unidadManual.trim() ? 'p-invalid' : ''} />
                    </div>
                    <div style={{ width: '130px', flexShrink: 0 }}>
                        <label className="block text-sm mb-1">Cantidad</label>
                        <InputNumber value={cantidadParaAgregar} onValueChange={(e) => setCantidadParaAgregar(e.value || 0)} mode="decimal" minFractionDigits={2} maxFractionDigits={4} min={0} className={intentoManual && cantidadParaAgregar <= 0 ? 'p-invalid' : ''} />
                    </div>
                    <div style={{ width: '140px', flexShrink: 0 }}>
                        <label className="block text-sm mb-1">P. Unitario</label>
                        <InputNumber value={precioManual} onValueChange={(e) => setPrecioManual(e.value || 0)} mode="currency" currency="MXN" locale="es-MX" min={0} />
                    </div>
                    <div className="flex align-items-center gap-2" style={{ flexShrink: 0, paddingBottom: '8px' }}>
                        <Checkbox checked={aplicaIvaParaAgregar} onChange={(e) => setAplicaIvaParaAgregar(e.checked ?? true)} inputId={`${idIva}-manual`} />
                        <label htmlFor={`${idIva}-manual`} className="text-sm">
                            Aplica IVA
                        </label>
                    </div>
                    <Button icon="pi pi-plus" label="Agregar" onClick={agregarManual} style={{ flexShrink: 0, width: 'auto' }} />
                </div>
            )}
        </div>
    );
};

export default PresupuestoFrenteEditor;
