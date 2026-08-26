'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { TabView, TabPanel } from 'primereact/tabview';
import {
    fetchRequisiciones,
    fetchOrdenesCompra,
    generarOrdenCompra,
    aprobarOrdenCompra,
    RequisicionCompra,
    OrdenCompra
} from '../../../Services/BD/compras/comprasService';
import { fetchProveedores, Proveedor } from '../../../Services/BD/provedoresService';
import { getUserNombreFromLocalStorage } from '../../../Services/BD/userService';

const comprobanteOptions = [
    { label: 'Nota', value: 'nota' },
    { label: 'Factura', value: 'factura' }
];

const tipoPagoOptions = [
    { label: 'Contado', value: 'contado' },
    { label: 'Crédito', value: 'credito' }
];

const requisicionSeverity = (estatus: string): 'success' | 'warning' | 'info' | undefined => {
    switch (estatus) {
        case 'Comprada': return 'success';
        case 'Cotizada': return 'info';
        case 'Cancelada': return undefined;
        default: return 'warning'; // Pendiente
    }
};

const ordenCompraSeverity = (estatus: string): 'success' | 'warning' | undefined => {
    if (estatus === 'Aprobada') return 'success';
    if (estatus === 'Cancelada') return undefined;
    return 'warning'; // Pendiente
};

const ComprasPage = () => {
    const [requisiciones, setRequisiciones] = useState<RequisicionCompra[]>([]);
    const [ordenesCompra, setOrdenesCompra] = useState<OrdenCompra[]>([]);
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);

    const [dialogVisible, setDialogVisible] = useState(false);
    const [requisicionSeleccionada, setRequisicionSeleccionada] = useState<RequisicionCompra | null>(null);
    const [cantidad, setCantidad] = useState<number | null>(null);
    const [costoUnitario, setCostoUnitario] = useState<number | null>(null);
    const [proveedorId, setProveedorId] = useState<number | null>(null);
    const [tipoComprobante, setTipoComprobante] = useState<'nota' | 'factura' | null>(null);
    const [folio, setFolio] = useState('');
    const [tipoPago, setTipoPago] = useState<'credito' | 'contado' | null>(null);
    const [guardando, setGuardando] = useState(false);

    const [aprobarDialog, setAprobarDialog] = useState(false);
    const [ordenAAprobar, setOrdenAAprobar] = useState<OrdenCompra | null>(null);
    const [aprobando, setAprobando] = useState(false);

    const cargar = async () => {
        setLoading(true);
        try {
            const [reqs, ocs] = await Promise.all([fetchRequisiciones(), fetchOrdenesCompra()]);
            setRequisiciones(reqs);
            setOrdenesCompra(ocs);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
        fetchProveedores().then(setProveedores);
    }, []);

    const abrirGenerarOrden = (requisicion: RequisicionCompra) => {
        setRequisicionSeleccionada(requisicion);
        setCantidad(requisicion.cantidad_faltante);
        setCostoUnitario(requisicion.precioCompra ?? null);
        setProveedorId(null);
        setTipoComprobante(null);
        setFolio('');
        setTipoPago(null);
        setDialogVisible(true);
    };

    const guardarOrdenCompra = async () => {
        if (!requisicionSeleccionada || !cantidad || cantidad <= 0) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Indica una cantidad válida', life: 3000 });
            return;
        }
        setGuardando(true);
        try {
            await generarOrdenCompra(requisicionSeleccionada, {
                cantidad,
                costo_unitario: costoUnitario,
                proveedor_id: proveedorId,
                tipo_comprobante: tipoComprobante,
                folio: folio.trim() || null,
                tipo_pago: tipoPago,
                creado_por: getUserNombreFromLocalStorage()
            });
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Orden de compra generada', life: 3000 });
            setDialogVisible(false);
            cargar();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setGuardando(false);
        }
    };

    const confirmarAprobar = (orden: OrdenCompra) => {
        setOrdenAAprobar(orden);
        setAprobarDialog(true);
    };

    const aprobar = async () => {
        if (!ordenAAprobar) return;
        setAprobando(true);
        try {
            await aprobarOrdenCompra(ordenAAprobar);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Orden de compra aprobada. Avisa a Almacén para que registre la entrada del producto.', life: 5000 });
            setAprobarDialog(false);
            setOrdenAAprobar(null);
            cargar();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setAprobando(false);
        }
    };

    const requisicionesPendientesCount = requisiciones.filter(r => r.estatus === 'Pendiente').length;
    const ordenesPendientesCount = ordenesCompra.filter(o => o.estatus === 'Pendiente').length;

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <h5>Compras</h5>

                    <TabView>
                        <TabPanel header={`Requisiciones Pendientes (${requisicionesPendientesCount})`}>
                            <DataTable
                                value={requisiciones}
                                loading={loading}
                                dataKey="id"
                                paginator
                                rows={10}
                                emptyMessage="No hay requisiciones de compra"
                                sortField="fecha"
                                sortOrder={-1}
                                responsiveLayout="scroll"
                            >
                                <Column field="productoNombre" header="Producto" />
                                <Column field="cantidad_faltante" header="Cant. Faltante" body={(r: RequisicionCompra) => <span>{r.cantidad_faltante} {r.productoUnidad}</span>} style={{ width: '140px' }} />
                                <Column field="numeroOrdenTrabajo" header="Orden de Trabajo" style={{ width: '160px' }} />
                                <Column field="equipoLabel" header="Equipo" style={{ minWidth: '180px' }} />
                                <Column field="motivoBitacora" header="Motivo" body={(r: RequisicionCompra) => r.motivoBitacora || '-'} style={{ minWidth: '180px' }} />
                                <Column field="fecha" header="Fecha" body={(r: RequisicionCompra) => new Date(r.fecha).toLocaleDateString('es-MX')} sortable style={{ width: '120px' }} />
                                <Column field="estatus" header="Estatus" body={(r: RequisicionCompra) => <Tag severity={requisicionSeverity(r.estatus)} value={r.estatus} />} style={{ width: '130px' }} />
                                <Column
                                    header=""
                                    style={{ width: '190px' }}
                                    body={(r: RequisicionCompra) => (
                                        r.estatus === 'Pendiente'
                                            ? <Button label="Generar Orden de Compra" icon="pi pi-shopping-cart" size="small" onClick={() => abrirGenerarOrden(r)} />
                                            : <span className="text-500 text-sm">Ya en proceso</span>
                                    )}
                                />
                            </DataTable>
                        </TabPanel>

                        <TabPanel header={`Órdenes de Compra (${ordenesPendientesCount} pendientes)`}>
                            <DataTable
                                value={ordenesCompra}
                                loading={loading}
                                dataKey="id"
                                paginator
                                rows={10}
                                emptyMessage="No hay órdenes de compra"
                                sortField="fecha_creacion"
                                sortOrder={-1}
                                responsiveLayout="scroll"
                            >
                                <Column field="productoNombre" header="Producto" />
                                <Column field="cantidad" header="Cantidad" body={(o: OrdenCompra) => <span>{o.cantidad} {o.productoUnidad}</span>} style={{ width: '120px' }} />
                                <Column field="costo_unitario" header="Costo Unit." body={(o: OrdenCompra) => (o.costo_unitario != null ? o.costo_unitario.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '-')} style={{ width: '120px' }} />
                                <Column field="proveedorNombre" header="Proveedor" body={(o: OrdenCompra) => o.proveedorNombre || '-'} style={{ width: '160px' }} />
                                <Column field="numeroOrdenTrabajo" header="Orden de Trabajo" body={(o: OrdenCompra) => o.numeroOrdenTrabajo || '-'} style={{ width: '160px' }} />
                                <Column field="fecha_creacion" header="Fecha" body={(o: OrdenCompra) => new Date(o.fecha_creacion).toLocaleDateString('es-MX')} sortable style={{ width: '120px' }} />
                                <Column field="estatus" header="Estatus" body={(o: OrdenCompra) => <Tag severity={ordenCompraSeverity(o.estatus)} value={o.estatus} />} style={{ width: '130px' }} />
                                <Column
                                    header=""
                                    style={{ width: '120px' }}
                                    body={(o: OrdenCompra) => (
                                        o.estatus === 'Pendiente'
                                            ? <Button label="Aprobar" icon="pi pi-check" severity="success" size="small" onClick={() => confirmarAprobar(o)} />
                                            : null
                                    )}
                                />
                            </DataTable>
                        </TabPanel>
                    </TabView>

                    <Dialog visible={dialogVisible} style={{ width: '550px' }} header="Generar Orden de Compra" modal className="p-fluid" onHide={() => setDialogVisible(false)} footer={
                        <>
                            <Button label="Cancelar" icon="pi pi-times" text onClick={() => setDialogVisible(false)} />
                            <Button label="Guardar" icon="pi pi-check" text loading={guardando} onClick={guardarOrdenCompra} />
                        </>
                    }>
                        {requisicionSeleccionada && (
                            <>
                                <p className="text-500 mt-0">
                                    <b>{requisicionSeleccionada.productoNombre}</b> para {requisicionSeleccionada.equipoLabel} ({requisicionSeleccionada.numeroOrdenTrabajo})
                                </p>

                                <div className="field">
                                    <label htmlFor="cantidad">Cantidad a comprar <span style={{ color: 'red' }}>*</span></label>
                                    <InputNumber id="cantidad" value={cantidad} onValueChange={(e) => setCantidad(e.value ?? null)} min={0} className="w-full" />
                                </div>

                                <div className="field">
                                    <label htmlFor="costoUnitario">Costo por Unidad</label>
                                    <InputNumber id="costoUnitario" value={costoUnitario} onValueChange={(e) => setCostoUnitario(e.value ?? null)} mode="currency" currency="MXN" locale="es-MX" min={0} className="w-full" />
                                </div>

                                <div className="field">
                                    <label htmlFor="proveedor">Proveedor</label>
                                    <Dropdown id="proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.value)} options={proveedores} optionLabel="nombre" optionValue="id" placeholder="Seleccionar proveedor" filter className="w-full" showClear />
                                </div>

                                <div className="grid">
                                    <div className="col-6">
                                        <div className="field">
                                            <label htmlFor="tipoComprobante">Comprobante</label>
                                            <Dropdown id="tipoComprobante" value={tipoComprobante} onChange={(e) => setTipoComprobante(e.value)} options={comprobanteOptions} placeholder="Nota o Factura" className="w-full" showClear />
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="field">
                                            <label htmlFor="folio">Folio</label>
                                            <InputText id="folio" value={folio} onChange={(e) => setFolio(e.target.value)} disabled={!tipoComprobante} className="w-full" />
                                        </div>
                                    </div>
                                </div>

                                <div className="field">
                                    <label htmlFor="tipoPago">Forma de Pago</label>
                                    <Dropdown id="tipoPago" value={tipoPago} onChange={(e) => setTipoPago(e.value)} options={tipoPagoOptions} placeholder="Contado o Crédito" className="w-full" showClear />
                                    {tipoPago === 'credito' && <small className="text-500">Se generará una cuenta por pagar al proveedor.</small>}
                                </div>
                            </>
                        )}
                    </Dialog>

                    <Dialog visible={aprobarDialog} style={{ width: '480px' }} header="Aprobar Orden de Compra" modal onHide={() => setAprobarDialog(false)} footer={
                        <>
                            <Button label="No" icon="pi pi-times" text onClick={() => setAprobarDialog(false)} />
                            <Button label="Sí, aprobar" icon="pi pi-check" text loading={aprobando} onClick={aprobar} />
                        </>
                    }>
                        {ordenAAprobar && (
                            <div className="flex align-items-start">
                                <i className="pi pi-info-circle mr-3" style={{ fontSize: '2rem', color: 'var(--primary-color)' }} />
                                <span>
                                    Al aprobar, esta orden de compra quedará marcada como <b>Aprobada</b>. Esto no mueve el stock: avisa a Almacén para que registre manualmente la entrada de <b>{ordenAAprobar.cantidad} {ordenAAprobar.productoUnidad}</b> de <b>{ordenAAprobar.productoNombre}</b> desde Inventario cuando la reciban físicamente.
                                </span>
                            </div>
                        )}
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default ComprasPage;
