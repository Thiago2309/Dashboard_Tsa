'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { SelectButton } from 'primereact/selectbutton';
import { TabPanel, TabView } from 'primereact/tabview';
import { Toast } from 'primereact/toast';
import React, { useRef, useState } from 'react';
import { exportarExplosionInsumosExcel, InsumoExplosionApu } from '../../../../../Services/BD/apu/explosionInsumosApuService';
import { fetchInsumosApuPorTipo, InsumoApu, TipoInsumoApu } from '../../../../../Services/BD/apu/insumosApuService';
import { calcularCostoMaquinaria, TipoCalculoMaquinariaApu } from '../../../../../Services/BD/apu/maquinariaApuService';
import { exportarMaquinariaPresupuestoExcel, fetchPresupuestoMaquinariaApu, PresupuestoMaquinariaApu, updatePresupuestoMaquinariaApu } from '../../../../../Services/BD/apu/presupuestoMaquinariaApuService';
import { fetchPresupuestosApu, PresupuestoApu } from '../../../../../Services/BD/apu/presupuestosApuService';
import {
    exportarMatrizPresupuestoExcel,
    exportarTarjetasPresupuestoExcel,
    fetchExplosionInsumosPresupuesto,
    fetchPresupuestoTarjetaApuPorId,
    fetchPresupuestoTarjetasApu,
    PresupuestoTarjetaApu,
    PresupuestoTarjetaInsumoApu,
    updatePresupuestoTarjetaApu
} from '../../../../../Services/BD/apu/presupuestoTarjetasApuService';
import { calcularCantidadSugerida, calcularTotalesTarjeta } from '../../../../../Services/BD/apu/tarjetasApuService';
import { ListadoInsumosPrint } from './ListadoInsumosPrint';

const formatMoney = (v = 0) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const formatPct = (v = 0) => `${v.toFixed(1)} %`;

const tipoLabel: Record<TipoInsumoApu, string> = {
    MATERIAL: 'Material',
    MANO_OBRA: 'Mano de Obra',
    MAQUINARIA: 'Maquinaria',
    HERRAMIENTA: 'Herramienta'
};

type Vista = 'TARJETAS' | 'COSTO_MAQUINA' | 'MATRIZ' | 'INSUMOS';

const opcionesVista: { label: string; value: Vista }[] = [
    { label: 'Tarjetas', value: 'TARJETAS' },
    { label: 'Costo Máquina', value: 'COSTO_MAQUINA' },
    { label: 'Matriz', value: 'MATRIZ' },
    { label: 'Insumos', value: 'INSUMOS' }
];

const opcionesTipoCalculo: { label: string; value: TipoCalculoMaquinariaApu }[] = [
    { label: 'Estándar', value: 'ESTANDAR' },
    { label: 'Manual', value: 'MANUAL' }
];

const th: React.CSSProperties = {
    border: '1px solid #000',
    borderTop: 'none',
    borderBottom: '2px solid #000',
    padding: '4px 6px',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: '11px'
};
const tdBase: React.CSSProperties = { padding: '3px 6px', fontSize: '11px', verticalAlign: 'top', border: '1px solid #ddd' };
const tdRight: React.CSSProperties = { ...tdBase, textAlign: 'right' };
const tdCenter: React.CSSProperties = { ...tdBase, textAlign: 'center' };

const imprimirSeccion = (ref: React.RefObject<HTMLDivElement>, tituloArchivo: string) => {
    if (!ref.current) return;

    const printContent = ref.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) return;

    const styles = `
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: white !important; font-family: Arial, Helvetica, sans-serif !important; padding: 20px !important; }
            .no-print { display: none !important; }
            @media print { body { padding: 10mm !important; } @page { size: portrait; margin: 10mm; } }
        </style>
    `;

    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>${tituloArchivo}</title>${styles}</head><body>${printContent}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
};

const TarjetasPorPresupuestoApuCrud = () => {
    const [presupuestos, setPresupuestos] = useState<PresupuestoApu[]>([]);
    const [idPresupuesto, setIdPresupuesto] = useState<number | null>(null);
    const [vista, setVista] = useState<Vista>('TARJETAS');
    const [loading, setLoading] = useState(false);

    // Tarjetas
    const [tarjetas, setTarjetas] = useState<PresupuestoTarjetaApu[]>([]);
    const [cargandoTarjetas, setCargandoTarjetas] = useState(false);
    const [insumosMaterial, setInsumosMaterial] = useState<InsumoApu[]>([]);
    const [insumosManoObra, setInsumosManoObra] = useState<InsumoApu[]>([]);
    const [insumosMaquinaria, setInsumosMaquinaria] = useState<InsumoApu[]>([]);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [tarjeta, setTarjeta] = useState<PresupuestoTarjetaApu | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [nuevoInsumo, setNuevoInsumo] = useState<Record<TipoInsumoApu, { id_insumo: number | null; cantidad: number }>>({
        MATERIAL: { id_insumo: null, cantidad: 0 },
        MANO_OBRA: { id_insumo: null, cantidad: 0 },
        MAQUINARIA: { id_insumo: null, cantidad: 0 },
        HERRAMIENTA: { id_insumo: null, cantidad: 0 }
    });

    // Costo Máquina
    const [maquinarias, setMaquinarias] = useState<PresupuestoMaquinariaApu[]>([]);
    const [cargandoMaquinarias, setCargandoMaquinarias] = useState(false);
    const [maquinariaDialogVisible, setMaquinariaDialogVisible] = useState(false);
    const [maquinaria, setMaquinaria] = useState<PresupuestoMaquinariaApu | null>(null);
    const [guardandoMaquinaria, setGuardandoMaquinaria] = useState(false);

    // Insumos
    const [insumosPresupuesto, setInsumosPresupuesto] = useState<InsumoExplosionApu[]>([]);
    const [cargandoInsumos, setCargandoInsumos] = useState(false);
    const [exportandoInsumos, setExportandoInsumos] = useState(false);
    const printRefInsumos = useRef<HTMLDivElement>(null);

    const [exportandoTarjetas, setExportandoTarjetas] = useState(false);
    const [exportandoMaquinaria, setExportandoMaquinaria] = useState(false);
    const [exportandoMatriz, setExportandoMatriz] = useState(false);
    const printRefTarjetas = useRef<HTMLDivElement>(null);
    const printRefMaquinaria = useRef<HTMLDivElement>(null);
    const printRefMatriz = useRef<HTMLDivElement>(null);

    const toast = useRef<Toast>(null);

    React.useEffect(() => {
        setLoading(true);
        Promise.all([fetchPresupuestosApu(), fetchInsumosApuPorTipo('MATERIAL'), fetchInsumosApuPorTipo('MANO_OBRA'), fetchInsumosApuPorTipo('MAQUINARIA')])
            .then(([presupuestosData, materiales, manoObra, maquinariaData]) => {
                setPresupuestos(presupuestosData);
                setInsumosMaterial(materiales);
                setInsumosManoObra(manoObra);
                setInsumosMaquinaria(maquinariaData);
            })
            .catch(() => toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar Presupuestos', life: 3000 }))
            .finally(() => setLoading(false));
    }, []);

    const opcionesInsumoPorTipo: Record<TipoInsumoApu, InsumoApu[]> = {
        MATERIAL: insumosMaterial,
        MANO_OBRA: insumosManoObra,
        MAQUINARIA: insumosMaquinaria,
        HERRAMIENTA: []
    };

    const presupuestoActual = presupuestos.find((p) => p.id === idPresupuesto);

    const cargarVista = async (id: number, nuevaVista: Vista) => {
        if (nuevaVista === 'COSTO_MAQUINA') {
            setCargandoMaquinarias(true);
            try {
                setMaquinarias(await fetchPresupuestoMaquinariaApu(id));
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar el Costo de Maquinaria del Presupuesto', life: 3000 });
            } finally {
                setCargandoMaquinarias(false);
            }
        }

        if (nuevaVista === 'INSUMOS') {
            setCargandoInsumos(true);
            try {
                setInsumosPresupuesto(await fetchExplosionInsumosPresupuesto(id));
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al calcular la Explosión de Insumos del Presupuesto', life: 3000 });
            } finally {
                setCargandoInsumos(false);
            }
        }
    };

    const cambiarVista = (nuevaVista: Vista) => {
        setVista(nuevaVista);
        if (idPresupuesto) cargarVista(idPresupuesto, nuevaVista);
    };

    const seleccionarPresupuesto = async (id: number | null) => {
        setIdPresupuesto(id);
        setMaquinarias([]);
        setInsumosPresupuesto([]);

        if (!id) {
            setTarjetas([]);
            return;
        }

        setCargandoTarjetas(true);
        try {
            setTarjetas(await fetchPresupuestoTarjetasApu(id));
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar las Tarjetas del Presupuesto', life: 3000 });
        } finally {
            setCargandoTarjetas(false);
        }

        cargarVista(id, vista);
    };

    // ---------- Tarjetas ----------

    const editTarjeta = async (row: PresupuestoTarjetaApu) => {
        try {
            const completa = await fetchPresupuestoTarjetaApuPorId(row.id!);
            setTarjeta(completa);
            setDialogVisible(true);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al abrir la Tarjeta', life: 3000 });
        }
    };

    const hideDialog = () => {
        setDialogVisible(false);
        setTarjeta(null);
    };

    const totales = tarjeta ? calcularTotalesTarjeta(tarjeta.insumos || [], tarjeta) : null;

    const save = async () => {
        if (!tarjeta) return;

        setGuardando(true);
        try {
            const actualizada = await updatePresupuestoTarjetaApu(tarjeta);
            setTarjetas((prev) => prev.map((t) => (t.id === actualizada.id ? actualizada : t)));
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Tarjeta del presupuesto actualizada. Se recalculó el total del presupuesto.', life: 4000 });
            setDialogVisible(false);
            setTarjeta(null);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar la Tarjeta del Presupuesto', life: 3000 });
        } finally {
            setGuardando(false);
        }
    };

    const agregarInsumo = (tipo: TipoInsumoApu) => {
        if (!tarjeta) return;
        const seleccion = nuevoInsumo[tipo];
        if (!seleccion.id_insumo || seleccion.cantidad <= 0) return;

        const opciones = opcionesInsumoPorTipo[tipo];
        const insumoCatalogo = opciones.find((i) => i.id === seleccion.id_insumo);
        if (!insumoCatalogo) return;

        const linea: PresupuestoTarjetaInsumoApu = {
            id_insumo: insumoCatalogo.id!,
            tipo,
            insumo_clave: insumoCatalogo.clave,
            insumo_descripcion: insumoCatalogo.descripcion,
            insumo_unidad: insumoCatalogo.unidad,
            cantidad: seleccion.cantidad,
            precio_unitario: insumoCatalogo.precio_unitario
        };

        setTarjeta({ ...tarjeta, insumos: [...(tarjeta.insumos || []), linea] });
        setNuevoInsumo({ ...nuevoInsumo, [tipo]: { id_insumo: null, cantidad: 0 } });
    };

    const quitarInsumo = (indice: number) => {
        if (!tarjeta) return;
        setTarjeta({ ...tarjeta, insumos: (tarjeta.insumos || []).filter((_, i) => i !== indice) });
    };

    const cambiarCantidadInsumo = (indice: number, cantidad: number) => {
        if (!tarjeta) return;
        setTarjeta({ ...tarjeta, insumos: (tarjeta.insumos || []).map((insumo, i) => (i === indice ? { ...insumo, cantidad } : insumo)) });
    };

    const renderSeccionInsumos = (tipo: TipoInsumoApu) => {
        if (!tarjeta) return null;
        const lineas = (tarjeta.insumos || []).map((insumo, indice) => ({ insumo, indice })).filter((l) => l.insumo.tipo === tipo);
        const opciones = opcionesInsumoPorTipo[tipo];
        const sugerencia = tipo === 'MANO_OBRA' || tipo === 'MAQUINARIA' ? calcularCantidadSugerida(tarjeta.jornada_horas, tarjeta.rendimiento) : null;

        return (
            <div>
                {sugerencia !== null && (
                    <p className="text-500 text-sm mt-0 flex align-items-center gap-2 flex-wrap">
                        <span>
                            Cantidad sugerida por rendimiento: <b>{sugerencia.toFixed(4)}</b> hr por {tarjeta.concepto_unidad || 'unidad'} (jornada {tarjeta.jornada_horas} hr ÷ rendimiento {tarjeta.rendimiento})
                        </span>
                        <Button
                            label="Usar sugerida"
                            icon="pi pi-bolt"
                            className="p-button-sm p-button-text"
                            type="button"
                            onClick={() => setNuevoInsumo({ ...nuevoInsumo, [tipo]: { ...nuevoInsumo[tipo], cantidad: sugerencia } })}
                        />
                    </p>
                )}

                <DataTable value={lineas} emptyMessage={`Sin ${tipoLabel[tipo].toLowerCase()} agregados.`} className="mb-3">
                    <Column header="Clave" style={{ width: '100px' }} body={(row: { insumo: PresupuestoTarjetaInsumoApu }) => row.insumo.insumo_clave}></Column>
                    <Column header="Descripción" body={(row: { insumo: PresupuestoTarjetaInsumoApu }) => row.insumo.insumo_descripcion}></Column>
                    <Column header="Unidad" style={{ width: '90px' }} body={(row: { insumo: PresupuestoTarjetaInsumoApu }) => row.insumo.insumo_unidad}></Column>
                    <Column
                        header="Cantidad"
                        style={{ width: '190px' }}
                        body={(row: { insumo: PresupuestoTarjetaInsumoApu; indice: number }) => (
                            <div className="flex align-items-center gap-1">
                                <InputNumber value={row.insumo.cantidad} onValueChange={(e) => cambiarCantidadInsumo(row.indice, e.value || 0)} mode="decimal" minFractionDigits={2} maxFractionDigits={4} min={0} size={6} />
                                {sugerencia !== null && (
                                    <Button
                                        icon="pi pi-bolt"
                                        rounded
                                        text
                                        severity="secondary"
                                        type="button"
                                        tooltip={`Usar sugerida (${sugerencia.toFixed(4)})`}
                                        tooltipOptions={{ position: 'top' }}
                                        onClick={() => cambiarCantidadInsumo(row.indice, sugerencia)}
                                    />
                                )}
                            </div>
                        )}
                    ></Column>
                    <Column header="Precio Unitario" style={{ width: '130px' }} body={(row: { insumo: PresupuestoTarjetaInsumoApu }) => formatMoney(row.insumo.precio_unitario)}></Column>
                    <Column header="Importe" style={{ width: '130px' }} body={(row: { insumo: PresupuestoTarjetaInsumoApu }) => formatMoney((row.insumo.cantidad || 0) * (row.insumo.precio_unitario || 0))}></Column>
                    <Column header="" style={{ width: '60px' }} body={(row: { indice: number }) => <Button icon="pi pi-trash" rounded text severity="danger" onClick={() => quitarInsumo(row.indice)} />}></Column>
                </DataTable>

                <div className="flex gap-2 align-items-end">
                    <div className="flex-grow-1">
                        <label className="block text-sm mb-1">Agregar {tipoLabel[tipo].toLowerCase()}</label>
                        <Dropdown
                            value={nuevoInsumo[tipo].id_insumo}
                            options={opciones}
                            optionLabel="descripcion"
                            optionValue="id"
                            filter
                            placeholder={`Selecciona ${tipoLabel[tipo].toLowerCase()}`}
                            onChange={(e) => setNuevoInsumo({ ...nuevoInsumo, [tipo]: { ...nuevoInsumo[tipo], id_insumo: e.value } })}
                            className="w-full"
                        />
                    </div>
                    <div style={{ width: '160px' }}>
                        <label className="block text-sm mb-1">Cantidad</label>
                        <InputNumber value={nuevoInsumo[tipo].cantidad} onValueChange={(e) => setNuevoInsumo({ ...nuevoInsumo, [tipo]: { ...nuevoInsumo[tipo], cantidad: e.value || 0 } })} mode="decimal" minFractionDigits={2} maxFractionDigits={4} min={0} />
                    </div>
                    <Button icon="pi pi-plus" label="Agregar" onClick={() => agregarInsumo(tipo)} />
                </div>
            </div>
        );
    };

    const dialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={save} loading={guardando} />
        </>
    );

    // ---------- Costo Máquina ----------

    const editMaquinaria = (row: PresupuestoMaquinariaApu) => {
        setMaquinaria({ ...row });
        setMaquinariaDialogVisible(true);
    };

    const hideMaquinariaDialog = () => {
        setMaquinariaDialogVisible(false);
        setMaquinaria(null);
    };

    const costoMaquinariaCalculado = maquinaria ? calcularCostoMaquinaria(maquinaria) : null;
    const esManual = maquinaria?.tipo_calculo === 'MANUAL';

    const saveMaquinaria = async () => {
        if (!maquinaria) return;

        setGuardandoMaquinaria(true);
        try {
            const actualizada = await updatePresupuestoMaquinariaApu(maquinaria);
            setMaquinarias((prev) => prev.map((m) => (m.id === actualizada.id ? actualizada : m)));
            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Maquinaria del presupuesto actualizada. Se recalcularon las tarjetas y el total del presupuesto que la usan.',
                life: 4500
            });
            hideMaquinariaDialog();
            if (idPresupuesto) setTarjetas(await fetchPresupuestoTarjetasApu(idPresupuesto));
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar la Maquinaria del Presupuesto', life: 3000 });
        } finally {
            setGuardandoMaquinaria(false);
        }
    };

    const maquinariaDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideMaquinariaDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveMaquinaria} loading={guardandoMaquinaria} />
        </>
    );

    // ---------- Exportar Tarjetas / Costo Máquina / Matriz ----------

    const exportarTarjetas = async () => {
        setExportandoTarjetas(true);
        try {
            await exportarTarjetasPresupuestoExcel(tarjetas, presupuestoActual?.nombre || 'presupuesto');
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al exportar las Tarjetas a Excel', life: 3000 });
        } finally {
            setExportandoTarjetas(false);
        }
    };

    const exportarMaquinariaExcel = async () => {
        setExportandoMaquinaria(true);
        try {
            await exportarMaquinariaPresupuestoExcel(maquinarias, presupuestoActual?.nombre || 'presupuesto');
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al exportar el Costo de Maquinaria a Excel', life: 3000 });
        } finally {
            setExportandoMaquinaria(false);
        }
    };

    const exportarMatriz = async () => {
        setExportandoMatriz(true);
        try {
            await exportarMatrizPresupuestoExcel(tarjetas, presupuestoActual?.nombre || 'presupuesto');
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al exportar la Matriz a Excel', life: 3000 });
        } finally {
            setExportandoMatriz(false);
        }
    };

    // ---------- Insumos ----------

    const exportarInsumos = async () => {
        setExportandoInsumos(true);
        try {
            await exportarExplosionInsumosExcel(insumosPresupuesto, `Insumos_${presupuestoActual?.nombre || 'presupuesto'}`);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al exportar los Insumos a Excel', life: 3000 });
        } finally {
            setExportandoInsumos(false);
        }
    };

    const imprimirInsumos = () => {
        if (!printRefInsumos.current) return;

        const printContent = printRefInsumos.current.innerHTML;
        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) return;

        const styles = `
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { background: white !important; font-family: Arial, Helvetica, sans-serif !important; padding: 20px !important; }
                @media print { body { padding: 10mm !important; } @page { size: portrait; margin: 10mm; } }
            </style>
        `;

        printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Insumos_Presupuesto</title>${styles}</head><body>${printContent}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <h5 className="m-0 mb-1">Detalle por Presupuesto</h5>
                    <p className="m-0 mb-3 text-500">
                        Tarjetas, Costo de Maquinaria, Matriz e Insumos propios de cada presupuesto: son copias editables independientes de los catálogos maestros, así que cambiarlas aquí no afecta el resto del sistema.
                    </p>

                    <div className="field md:w-8 mb-3">
                        <label>Presupuesto</label>
                        <Dropdown
                            value={idPresupuesto}
                            options={presupuestos}
                            optionLabel="nombre"
                            optionValue="id"
                            filter
                            disabled={loading}
                            placeholder="Selecciona un presupuesto"
                            onChange={(e) => seleccionarPresupuesto(e.value)}
                            className="w-full"
                        />
                    </div>

                    {idPresupuesto && (
                        <div className="mb-4">
                            <SelectButton value={vista} options={opcionesVista} onChange={(e) => e.value && cambiarVista(e.value)} />
                        </div>
                    )}

                    {!idPresupuesto && <p className="text-500">Selecciona un presupuesto para ver su información.</p>}

                    {idPresupuesto && vista === 'TARJETAS' && (
                        <div>
                            {cargandoTarjetas && (
                                <div className="flex justify-content-center p-5">
                                    <i className="pi pi-spinner pi-spin" style={{ fontSize: '2rem' }} />
                                </div>
                            )}
                            {!cargandoTarjetas && tarjetas.length === 0 && <p className="text-500">Este presupuesto no tiene tarjetas.</p>}
                            {!cargandoTarjetas && tarjetas.length > 0 && (
                                <>
                                    <div className="flex justify-content-end gap-2 mb-3">
                                        <Button label="Imprimir" icon="pi pi-print" text onClick={() => imprimirSeccion(printRefTarjetas, 'Tarjetas_Presupuesto')} />
                                        <Button label="Exportar a Excel" icon="pi pi-file-excel" severity="success" onClick={exportarTarjetas} loading={exportandoTarjetas} />
                                    </div>
                                    <div ref={printRefTarjetas} style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', background: 'white', padding: '20px 25px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000' }}>
                                        <h2 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', textTransform: 'uppercase', marginBottom: '14px' }}>Tarjetas de Precio Unitario del Presupuesto: {presupuestoActual?.nombre}</h2>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ ...th, width: '11%' }}>Clave</th>
                                                    <th style={{ ...th, width: '33%' }}>Concepto</th>
                                                    <th style={{ ...th, width: '8%' }}>Unidad</th>
                                                    <th style={{ ...th, width: '15%' }}>Costo Directo</th>
                                                    <th style={{ ...th, width: '11%' }}>% Material</th>
                                                    <th style={{ ...th, width: '10%' }}>% M.O.</th>
                                                    <th style={{ ...th, width: '15%' }}>Precio Unitario</th>
                                                    <th style={{ ...th, width: '7%' }} className="no-print"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tarjetas.map((t) => (
                                                    <tr key={t.id}>
                                                        <td style={tdBase}>{t.concepto_clave}</td>
                                                        <td style={tdBase}>{t.concepto_descripcion}</td>
                                                        <td style={tdCenter}>{t.concepto_unidad}</td>
                                                        <td style={tdRight}>{formatMoney(t.costo_directo)}</td>
                                                        <td style={tdRight}>{formatPct(t.pct_material)}</td>
                                                        <td style={tdRight}>{formatPct(t.pct_mano_obra)}</td>
                                                        <td style={tdRight}>{formatMoney(t.precio_unitario)}</td>
                                                        <td style={tdCenter} className="no-print">
                                                            <Button icon="pi pi-pencil" rounded text severity="info" onClick={() => editTarjeta(t)} tooltip="Editar" tooltipOptions={{ position: 'top' }} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {idPresupuesto && vista === 'COSTO_MAQUINA' && (
                        <div>
                            {cargandoMaquinarias && (
                                <div className="flex justify-content-center p-5">
                                    <i className="pi pi-spinner pi-spin" style={{ fontSize: '2rem' }} />
                                </div>
                            )}
                            {!cargandoMaquinarias && maquinarias.length === 0 && <p className="text-500">Este presupuesto no usa maquinaria en sus tarjetas.</p>}
                            {!cargandoMaquinarias && maquinarias.length > 0 && (
                                <>
                                    <div className="flex justify-content-end gap-2 mb-3">
                                        <Button label="Imprimir" icon="pi pi-print" text onClick={() => imprimirSeccion(printRefMaquinaria, 'Costo_Maquinaria_Presupuesto')} />
                                        <Button label="Exportar a Excel" icon="pi pi-file-excel" severity="success" onClick={exportarMaquinariaExcel} loading={exportandoMaquinaria} />
                                    </div>
                                    <div ref={printRefMaquinaria} style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', background: 'white', padding: '20px 25px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000' }}>
                                        <h2 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', textTransform: 'uppercase', marginBottom: '14px' }}>Costo Horario de Maquinaria del Presupuesto: {presupuestoActual?.nombre}</h2>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ ...th, width: '11%' }}>Clave</th>
                                                    <th style={{ ...th, width: '35%' }}>Descripción</th>
                                                    <th style={{ ...th, width: '12%' }}>Tipo</th>
                                                    <th style={{ ...th, width: '14%' }}>Costo Fijo</th>
                                                    <th style={{ ...th, width: '14%' }}>Costo Operación</th>
                                                    <th style={{ ...th, width: '14%' }}>Costo Total</th>
                                                    <th style={{ ...th, width: '7%' }} className="no-print"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {maquinarias.map((m) => (
                                                    <tr key={m.id}>
                                                        <td style={tdBase}>{m.clave}</td>
                                                        <td style={tdBase}>{m.descripcion}</td>
                                                        <td style={tdCenter}>{m.tipo_calculo === 'MANUAL' ? 'Manual' : 'Estándar'}</td>
                                                        <td style={tdRight}>{formatMoney(m.costo_fijo_hora)}</td>
                                                        <td style={tdRight}>{formatMoney(m.costo_operacion_hora)}</td>
                                                        <td style={tdRight}>{formatMoney(m.costo_hora_total)}</td>
                                                        <td style={tdCenter} className="no-print">
                                                            <Button icon="pi pi-pencil" rounded text severity="info" onClick={() => editMaquinaria(m)} tooltip="Editar" tooltipOptions={{ position: 'top' }} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {idPresupuesto && vista === 'MATRIZ' && (
                        <div>
                            {cargandoTarjetas && (
                                <div className="flex justify-content-center p-5">
                                    <i className="pi pi-spinner pi-spin" style={{ fontSize: '2rem' }} />
                                </div>
                            )}
                            {!cargandoTarjetas && tarjetas.length === 0 && <p className="text-500">Este presupuesto no tiene tarjetas.</p>}
                            {!cargandoTarjetas && tarjetas.length > 0 && (
                                <>
                                    <div className="flex justify-content-end gap-2 mb-3">
                                        <Button label="Imprimir" icon="pi pi-print" text onClick={() => imprimirSeccion(printRefMatriz, 'Matriz_Presupuesto')} />
                                        <Button label="Exportar a Excel" icon="pi pi-file-excel" severity="success" onClick={exportarMatriz} loading={exportandoMatriz} />
                                    </div>
                                    <div ref={printRefMatriz} style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', background: 'white', padding: '20px 25px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', overflowX: 'auto' }}>
                                        <h2 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', textTransform: 'uppercase', marginBottom: '14px' }}>Matriz de Precios Unitarios del Presupuesto: {presupuestoActual?.nombre}</h2>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ ...th, width: '10%' }}>Clave</th>
                                                    <th style={{ ...th, width: '26%' }}>Concepto</th>
                                                    <th style={{ ...th, width: '7%' }}>Unidad</th>
                                                    <th style={{ ...th, width: '11%' }}>Materiales</th>
                                                    <th style={{ ...th, width: '11%' }}>Mano de Obra</th>
                                                    <th style={{ ...th, width: '11%' }}>Maquinaria</th>
                                                    <th style={{ ...th, width: '8%' }}>% Mat.</th>
                                                    <th style={{ ...th, width: '8%' }}>% M.O.</th>
                                                    <th style={{ ...th, width: '8%' }}>% Maq.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tarjetas.map((t) => (
                                                    <tr key={t.id}>
                                                        <td style={tdBase}>{t.concepto_clave}</td>
                                                        <td style={tdBase}>{t.concepto_descripcion}</td>
                                                        <td style={tdCenter}>{t.concepto_unidad}</td>
                                                        <td style={tdRight}>{formatMoney(t.costo_materiales)}</td>
                                                        <td style={tdRight}>{formatMoney(t.costo_mano_obra)}</td>
                                                        <td style={tdRight}>{formatMoney(t.costo_maquinaria)}</td>
                                                        <td style={tdRight}>{formatPct(t.pct_material)}</td>
                                                        <td style={tdRight}>{formatPct(t.pct_mano_obra)}</td>
                                                        <td style={tdRight}>{formatPct(t.pct_maquinaria)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {idPresupuesto && vista === 'INSUMOS' && (
                        <div>
                            {cargandoInsumos && (
                                <div className="flex justify-content-center p-5">
                                    <i className="pi pi-spinner pi-spin" style={{ fontSize: '2rem' }} />
                                </div>
                            )}
                            {!cargandoInsumos && insumosPresupuesto.length === 0 && <p className="text-500">Este presupuesto no tiene insumos que mostrar.</p>}
                            {!cargandoInsumos && insumosPresupuesto.length > 0 && (
                                <>
                                    <div className="flex justify-content-end gap-2 mb-3">
                                        <Button label="Imprimir" icon="pi pi-print" text onClick={imprimirInsumos} />
                                        <Button label="Exportar a Excel" icon="pi pi-file-excel" severity="success" onClick={exportarInsumos} loading={exportandoInsumos} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                                        <ListadoInsumosPrint ref={printRefInsumos} insumos={insumosPresupuesto} titulo={`Listado de Insumos del Presupuesto: ${presupuestoActual?.nombre || ''}`} />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {tarjeta && totales && (
                        <Dialog visible={dialogVisible} style={{ width: '95vw', maxWidth: '1100px' }} header={`Tarjeta del Presupuesto — ${tarjeta.concepto_descripcion}`} modal className="p-fluid" footer={dialogFooter} onHide={hideDialog}>
                            <TabView>
                                <TabPanel header="Datos Generales">
                                    <div className="grid">
                                        <div className="col-12">
                                            <div className="field">
                                                <label>Concepto</label>
                                                <p className="m-0 p-2 surface-100 border-round">
                                                    <b>{tarjeta.concepto_clave}</b> — {tarjeta.concepto_descripcion} ({tarjeta.concepto_unidad})
                                                </p>
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Rendimiento (unidades/jornada)</label>
                                                <InputNumber value={tarjeta.rendimiento} onValueChange={(e) => setTarjeta({ ...tarjeta, rendimiento: e.value || 0 })} mode="decimal" minFractionDigits={2} maxFractionDigits={4} min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Jornada (horas)</label>
                                                <InputNumber value={tarjeta.jornada_horas} onValueChange={(e) => setTarjeta({ ...tarjeta, jornada_horas: e.value || 0 })} mode="decimal" minFractionDigits={1} min={0} />
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <div className="field">
                                                <label>Notas</label>
                                                <InputTextarea value={tarjeta.notas} onChange={(e) => setTarjeta({ ...tarjeta, notas: e.target.value })} rows={3} />
                                            </div>
                                        </div>
                                    </div>
                                </TabPanel>

                                <TabPanel header={`Materiales (${(tarjeta.insumos || []).filter((i) => i.tipo === 'MATERIAL').length})`}>{renderSeccionInsumos('MATERIAL')}</TabPanel>

                                <TabPanel header={`Mano de Obra (${(tarjeta.insumos || []).filter((i) => i.tipo === 'MANO_OBRA').length})`}>{renderSeccionInsumos('MANO_OBRA')}</TabPanel>

                                <TabPanel header={`Maquinaria (${(tarjeta.insumos || []).filter((i) => i.tipo === 'MAQUINARIA').length})`}>{renderSeccionInsumos('MAQUINARIA')}</TabPanel>

                                <TabPanel header="Indirectos, Utilidad y Resumen">
                                    <div className="grid">
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Herramienta Menor (% M.O.)</label>
                                                <InputNumber value={tarjeta.pct_herramienta} onValueChange={(e) => setTarjeta({ ...tarjeta, pct_herramienta: e.value || 0 })} suffix=" %" min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Indirectos (%)</label>
                                                <InputNumber value={tarjeta.pct_indirectos} onValueChange={(e) => setTarjeta({ ...tarjeta, pct_indirectos: e.value || 0 })} suffix=" %" min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Financiamiento (%)</label>
                                                <InputNumber value={tarjeta.pct_financiamiento} onValueChange={(e) => setTarjeta({ ...tarjeta, pct_financiamiento: e.value || 0 })} suffix=" %" min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Utilidad (%)</label>
                                                <InputNumber value={tarjeta.pct_utilidad} onValueChange={(e) => setTarjeta({ ...tarjeta, pct_utilidad: e.value || 0 })} suffix=" %" min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Cargos Adicionales (%)</label>
                                                <InputNumber value={tarjeta.pct_cargos_adicionales} onValueChange={(e) => setTarjeta({ ...tarjeta, pct_cargos_adicionales: e.value || 0 })} suffix=" %" min={0} />
                                            </div>
                                        </div>

                                        <div className="col-12">
                                            <div className="surface-100 border-round p-3 mt-2">
                                                <div className="grid">
                                                    <div className="col-6 md:col-3">
                                                        <span className="block text-500 text-sm">Costo Materiales</span>
                                                        <span className="font-bold">{formatMoney(totales.costo_materiales)}</span>
                                                    </div>
                                                    <div className="col-6 md:col-3">
                                                        <span className="block text-500 text-sm">Costo Mano de Obra</span>
                                                        <span className="font-bold">{formatMoney(totales.costo_mano_obra)}</span>
                                                    </div>
                                                    <div className="col-6 md:col-3">
                                                        <span className="block text-500 text-sm">Costo Maquinaria</span>
                                                        <span className="font-bold">{formatMoney(totales.costo_maquinaria)}</span>
                                                    </div>
                                                    <div className="col-6 md:col-3">
                                                        <span className="block text-500 text-sm">Costo Herramienta</span>
                                                        <span className="font-bold">{formatMoney(totales.costo_herramienta)}</span>
                                                    </div>

                                                    <div className="col-12">
                                                        <hr />
                                                    </div>

                                                    <div className="col-4 text-center">
                                                        <span className="block text-500 text-sm">% Material</span>
                                                        <span className="text-xl font-bold">{formatPct(totales.pct_material)}</span>
                                                    </div>
                                                    <div className="col-4 text-center">
                                                        <span className="block text-500 text-sm">% Mano de Obra</span>
                                                        <span className="text-xl font-bold">{formatPct(totales.pct_mano_obra)}</span>
                                                    </div>
                                                    <div className="col-4 text-center">
                                                        <span className="block text-500 text-sm">% Maquinaria</span>
                                                        <span className="text-xl font-bold">{formatPct(totales.pct_maquinaria)}</span>
                                                    </div>

                                                    <div className="col-12">
                                                        <hr />
                                                    </div>

                                                    <div className="col-6 md:col-3">
                                                        <span className="block text-500 text-sm">Costo Directo</span>
                                                        <span className="font-bold">{formatMoney(totales.costo_directo)}</span>
                                                    </div>
                                                    <div className="col-6 md:col-3">
                                                        <span className="block text-500 text-sm">Indirectos + Financiamiento</span>
                                                        <span className="font-bold">{formatMoney(totales.monto_indirectos + totales.monto_financiamiento)}</span>
                                                    </div>
                                                    <div className="col-6 md:col-3">
                                                        <span className="block text-500 text-sm">Utilidad + Cargos</span>
                                                        <span className="font-bold">{formatMoney(totales.monto_utilidad + totales.monto_cargos_adicionales)}</span>
                                                    </div>
                                                    <div className="col-6 md:col-3">
                                                        <span className="block text-500 text-sm">Precio Unitario</span>
                                                        <span className="text-xl font-bold text-primary">{formatMoney(totales.precio_unitario)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </TabPanel>
                            </TabView>
                        </Dialog>
                    )}

                    {maquinaria && costoMaquinariaCalculado && (
                        <Dialog visible={maquinariaDialogVisible} style={{ width: '95vw', maxWidth: '780px' }} header={`Maquinaria del Presupuesto — ${maquinaria.descripcion}`} modal className="p-fluid" footer={maquinariaDialogFooter} onHide={hideMaquinariaDialog}>
                            <div className="grid">
                                <div className="col-12 md:col-6">
                                    <div className="field">
                                        <label>Descripción</label>
                                        <InputText value={maquinaria.descripcion} onChange={(e) => setMaquinaria({ ...maquinaria, descripcion: e.target.value })} />
                                    </div>
                                </div>
                                <div className="col-12 md:col-6">
                                    <div className="field">
                                        <label>Tipo de Cálculo</label>
                                        <SelectButton value={maquinaria.tipo_calculo} options={opcionesTipoCalculo} onChange={(e) => e.value && setMaquinaria({ ...maquinaria, tipo_calculo: e.value })} />
                                    </div>
                                </div>

                                {esManual ? (
                                    <>
                                        <div className="col-6 md:col-4">
                                            <div className="field">
                                                <label>Precio del Flete</label>
                                                <InputNumber value={maquinaria.precio_flete} onValueChange={(e) => setMaquinaria({ ...maquinaria, precio_flete: e.value || 0 })} mode="decimal" minFractionDigits={2} min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-4">
                                            <div className="field">
                                                <label>Abundamiento</label>
                                                <InputNumber value={maquinaria.abundamiento} onValueChange={(e) => setMaquinaria({ ...maquinaria, abundamiento: e.value ?? 1 })} mode="decimal" minFractionDigits={2} maxFractionDigits={4} min={0} />
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <div className="surface-100 border-round p-3 mt-2 text-center">
                                                <span className="block text-500 text-sm">Costo Total (Precio del Flete × Abundamiento)</span>
                                                <span className="text-xl font-bold text-primary">{formatMoney(costoMaquinariaCalculado.costo_hora_total)} / M3</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="col-12">
                                            <h6 className="mb-2">Costos Fijos</h6>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Valor de Adquisición</label>
                                                <InputNumber value={maquinaria.valor_adquisicion} onValueChange={(e) => setMaquinaria({ ...maquinaria, valor_adquisicion: e.value || 0 })} mode="decimal" minFractionDigits={2} min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Valor de Rescate (%)</label>
                                                <InputNumber value={maquinaria.valor_rescate_pct} onValueChange={(e) => setMaquinaria({ ...maquinaria, valor_rescate_pct: e.value || 0 })} suffix=" %" min={0} max={100} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Vida Útil (años)</label>
                                                <InputNumber value={maquinaria.vida_util_anios} onValueChange={(e) => setMaquinaria({ ...maquinaria, vida_util_anios: e.value || 0 })} min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Horas de Uso Anual</label>
                                                <InputNumber value={maquinaria.horas_uso_anual} onValueChange={(e) => setMaquinaria({ ...maquinaria, horas_uso_anual: e.value || 0 })} min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-4">
                                            <div className="field">
                                                <label>Tasa de Interés Anual (%)</label>
                                                <InputNumber value={maquinaria.tasa_interes_pct} onValueChange={(e) => setMaquinaria({ ...maquinaria, tasa_interes_pct: e.value || 0 })} suffix=" %" min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-4">
                                            <div className="field">
                                                <label>Tasa de Seguros Anual (%)</label>
                                                <InputNumber value={maquinaria.tasa_seguros_pct} onValueChange={(e) => setMaquinaria({ ...maquinaria, tasa_seguros_pct: e.value || 0 })} suffix=" %" min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-4">
                                            <div className="field">
                                                <label>Mantenimiento (% de depreciación)</label>
                                                <InputNumber value={maquinaria.factor_mantenimiento_pct} onValueChange={(e) => setMaquinaria({ ...maquinaria, factor_mantenimiento_pct: e.value || 0 })} suffix=" %" min={0} />
                                            </div>
                                        </div>

                                        <div className="col-12">
                                            <h6 className="mb-2">Costos de Operación</h6>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Consumo Combustible (lt/hr)</label>
                                                <InputNumber value={maquinaria.consumo_combustible_litros_hora} onValueChange={(e) => setMaquinaria({ ...maquinaria, consumo_combustible_litros_hora: e.value || 0 })} min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Precio Combustible ($/lt)</label>
                                                <InputNumber value={maquinaria.precio_combustible_litro} onValueChange={(e) => setMaquinaria({ ...maquinaria, precio_combustible_litro: e.value || 0 })} mode="decimal" minFractionDigits={2} min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Lubricantes (% del combustible)</label>
                                                <InputNumber value={maquinaria.consumo_lubricantes_pct} onValueChange={(e) => setMaquinaria({ ...maquinaria, consumo_lubricantes_pct: e.value || 0 })} suffix=" %" min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Llantas ($/hr)</label>
                                                <InputNumber value={maquinaria.costo_llantas_hora} onValueChange={(e) => setMaquinaria({ ...maquinaria, costo_llantas_hora: e.value || 0 })} mode="decimal" minFractionDigits={2} min={0} />
                                            </div>
                                        </div>
                                        <div className="col-6 md:col-3">
                                            <div className="field">
                                                <label>Otros Consumibles ($/hr)</label>
                                                <InputNumber value={maquinaria.otros_consumibles_hora} onValueChange={(e) => setMaquinaria({ ...maquinaria, otros_consumibles_hora: e.value || 0 })} mode="decimal" minFractionDigits={2} min={0} />
                                            </div>
                                        </div>

                                        <div className="col-12">
                                            <div className="surface-100 border-round p-3 mt-2">
                                                <div className="grid">
                                                    <div className="col-4 text-center">
                                                        <span className="block text-500 text-sm">Costo Fijo / hr</span>
                                                        <span className="text-xl font-bold">{formatMoney(costoMaquinariaCalculado.costo_fijo_hora)}</span>
                                                    </div>
                                                    <div className="col-4 text-center">
                                                        <span className="block text-500 text-sm">Costo Operación / hr</span>
                                                        <span className="text-xl font-bold">{formatMoney(costoMaquinariaCalculado.costo_operacion_hora)}</span>
                                                    </div>
                                                    <div className="col-4 text-center">
                                                        <span className="block text-500 text-sm">Costo Total / hr</span>
                                                        <span className="text-xl font-bold text-primary">{formatMoney(costoMaquinariaCalculado.costo_hora_total)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Dialog>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TarjetasPorPresupuestoApuCrud;
