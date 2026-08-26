'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { DataTableFilterMeta } from 'primereact/datatable';
import Link from 'next/link';
import {
    fetchBitacoras,
    updateBitacora,
    resolverBitacora,
    deleteBitacora,
    BitacoraTaller
} from '../../../../Services/BD/taller/bitacoraTallerService';
import { fetchOperadores } from '../../../../Services/BD/operadoresService';
import { getUserNombreFromLocalStorage } from '../../../../Services/BD/userService';
import { getProductos, Inventario } from '../../../../Services/BD/inventario/inventarioService';
import {
    generarOrGetOrdenTrabajo,
    fetchOrdenTrabajoPorBitacora,
    fetchDetalleOrden,
    agregarProductoAOrden,
    eliminarProductoDeOrden,
    numeroOrden,
    OrdenTrabajo,
    OrdenTrabajoDetalle
} from '../../../../Services/BD/taller/ordenTrabajoService';

const DEPARTAMENTO_MANTENIMIENTO = 'MANTENIMIENTO';

const estatusRefaccionOptions = [
    { label: 'En Posesión', value: 'En Posesión' },
    { label: 'No Cotizado', value: 'No Cotizado' },
    { label: 'Ya Cotizado, Pendiente de Pago', value: 'Ya Cotizado, Pendiente de Pago' },
    { label: 'Pendiente Adquisición', value: 'Pendiente Adquisición' },
    { label: 'Sin Refacción Requerida', value: 'Sin Refacción Requerida' }
];

const BitacoraTallerPage = () => {
    const [bitacoras, setBitacoras] = useState<BitacoraTaller[]>([]);
    const [tecnicosMantenimiento, setTecnicosMantenimiento] = useState<{ label: string; value: string }[]>([]);
    const [bitacora, setBitacora] = useState<BitacoraTaller | null>(null);
    const [bitacoraDialog, setBitacoraDialog] = useState(false);
    const [resolverDialog, setResolverDialog] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [loading, setLoading] = useState(false);
    const [soloAbiertas, setSoloAbiertas] = useState(true);

    // Orden de Trabajo (generada desde la bitácora, para pedir refacciones en Almacén)
    const [ordenTrabajo, setOrdenTrabajo] = useState<OrdenTrabajo | null>(null);
    const [detalleOrden, setDetalleOrden] = useState<OrdenTrabajoDetalle[]>([]);
    const [generandoOrden, setGenerandoOrden] = useState(false);
    const [productos, setProductos] = useState<Inventario[]>([]);
    const [busquedaProducto, setBusquedaProducto] = useState('');
    const [cantidadesPorProducto, setCantidadesPorProducto] = useState<Record<number, number>>({});
    const [confirmExcesoVisible, setConfirmExcesoVisible] = useState(false);
    const [pendienteAgregar, setPendienteAgregar] = useState<{ producto: Inventario; cantidad: number } | null>(null);

    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const toast = useRef<Toast>(null);

    const loadBitacoras = async () => {
        setLoading(true);
        try {
            const data = await fetchBitacoras();
            setBitacoras(data);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBitacoras();
        fetchOperadores().then(operadores => {
            const deMantenimiento = operadores
                .filter(o => (o.departamento_nombre || '').toUpperCase().trim() === DEPARTAMENTO_MANTENIMIENTO)
                .map(o => ({ label: o.nombre, value: o.nombre }));
            setTecnicosMantenimiento(deMantenimiento);
        });
        getProductos().then(setProductos);
    }, []);

    const cargarOrdenTrabajo = async (b: BitacoraTaller) => {
        if (!b.id) return;
        try {
            const orden = await fetchOrdenTrabajoPorBitacora(b.id);
            setOrdenTrabajo(orden);
            setDetalleOrden(orden ? await fetchDetalleOrden(orden.id) : []);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const generarOrden = async () => {
        if (!bitacora) return;
        setGenerandoOrden(true);
        try {
            const orden = await generarOrGetOrdenTrabajo(bitacora, getUserNombreFromLocalStorage());
            setOrdenTrabajo(orden);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: `Orden de trabajo ${orden.numero} generada`, life: 3000 });
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setGenerandoOrden(false);
        }
    };

    const agregarProducto = (producto: Inventario, cantidad: number, forzar: boolean = false) => {
        if (!cantidad || cantidad <= 0) {
            toast.current?.show({ severity: 'warn', summary: 'Advertencia', detail: 'Indica una cantidad válida', life: 3000 });
            return;
        }
        if (cantidad > producto.stock_actual && !forzar) {
            setPendienteAgregar({ producto, cantidad });
            setConfirmExcesoVisible(true);
            return;
        }
        confirmarAgregarProducto(producto, cantidad);
    };

    const confirmarAgregarProducto = async (producto: Inventario, cantidad: number) => {
        if (!ordenTrabajo) return;
        try {
            const resultado = await agregarProductoAOrden(
                ordenTrabajo.id,
                { id: producto.id, stock_actual: producto.stock_actual, precio_compra: producto.precio_compra },
                cantidad
            );
            setDetalleOrden([...detalleOrden, {
                ...resultado.detalle,
                producto_codigo: producto.codigo,
                producto_nombre: producto.nombre,
                producto_unidad: producto.unidad,
                stock_actual: producto.stock_actual
            }]);
            setCantidadesPorProducto(prev => ({ ...prev, [producto.id]: 0 }));

            if (resultado.requisicionCreada) {
                toast.current?.show({ severity: 'warn', summary: 'Excede el stock', detail: `Se generó una requisición de compra por ${cantidad - producto.stock_actual} ${producto.unidad}`, life: 5000 });
            } else {
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Producto agregado a la orden', life: 3000 });
            }
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setConfirmExcesoVisible(false);
            setPendienteAgregar(null);
        }
    };

    const quitarProductoDeOrden = async (detalle: OrdenTrabajoDetalle) => {
        try {
            await eliminarProductoDeOrden(detalle.id);
            setDetalleOrden(detalleOrden.filter(d => d.id !== detalle.id));
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Producto quitado de la orden', life: 3000 });
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const productosFiltrados = productos.filter(p => {
        const termino = busquedaProducto.trim().toLowerCase();
        if (!termino) return false;
        return p.codigo.toLowerCase().includes(termino) || p.nombre.toLowerCase().includes(termino);
    });

    const equipoLabel = (b: BitacoraTaller) =>
        b.tipo_equipo === 'camion'
            ? `${b.camion_nombre || 'Camión'} (${b.camion_placa || 's/placa'})`
            : `${b.maquinaria_eco ? b.maquinaria_eco + ' - ' : ''}${b.maquinaria_equipo || 'Maquinaria'}`;

    const editBitacora = (row: BitacoraTaller) => {
        setBitacora({ ...row });
        setBitacoraDialog(true);
        setBusquedaProducto('');
        setCantidadesPorProducto({});
        cargarOrdenTrabajo(row);
    };

    const hideDialog = () => {
        setBitacoraDialog(false);
        setBitacora(null);
        setOrdenTrabajo(null);
        setDetalleOrden([]);
    };

    const saveBitacora = async () => {
        if (!bitacora?.id) return;
        try {
            await updateBitacora(bitacora.id, {
                reportado_por: bitacora.reportado_por,
                tecnico_asignado: bitacora.tecnico_asignado,
                es_taller_externo: bitacora.es_taller_externo,
                costo_mano_obra: bitacora.costo_mano_obra,
                motivo: bitacora.motivo,
                estatus_refaccion: bitacora.estatus_refaccion,
                observaciones: bitacora.observaciones,
                estatus_bitacora: bitacora.estatus_bitacora
            });
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Bitácora actualizada', life: 3000 });
            hideDialog();
            loadBitacoras();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const confirmResolver = (row: BitacoraTaller) => {
        setBitacora(row);
        setResolverDialog(true);
    };

    const resolver = async () => {
        if (!bitacora) return;
        try {
            await resolverBitacora(bitacora);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Bitácora resuelta, el equipo vuelve a estar Activo', life: 4000 });
            setResolverDialog(false);
            setBitacora(null);
            loadBitacoras();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const confirmDelete = (row: BitacoraTaller) => {
        setBitacora(row);
        setDeleteDialog(true);
    };

    const eliminar = async () => {
        if (!bitacora?.id) return;
        try {
            await deleteBitacora(bitacora.id);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Bitácora eliminada', life: 3000 });
            setDeleteDialog(false);
            setBitacora(null);
            loadBitacoras();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const tipoBodyTemplate = (row: BitacoraTaller) => (
        <div className="flex align-items-center gap-2">
            <i className={row.tipo_equipo === 'camion' ? 'pi pi-car' : 'pi pi-cog'} />
            <span>{equipoLabel(row)}</span>
        </div>
    );

    const fechaBodyTemplate = (row: BitacoraTaller) => (
        <span>{row.fecha_reporte ? new Date(row.fecha_reporte).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</span>
    );

    const textoBodyTemplate = (value: string | null | undefined) => (
        <span>{value && value.trim() !== '' ? value : '-'}</span>
    );

    const montoBodyTemplate = (value: number | null | undefined) => (
        <span>{value ? value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '-'}</span>
    );

    const estatusBodyTemplate = (row: BitacoraTaller) => {
        let severity: 'success' | 'warning' | 'danger' = 'danger';
        if (row.estatus_bitacora === 'En Proceso') severity = 'warning';
        if (row.estatus_bitacora === 'Resuelta') severity = 'success';
        return <Tag severity={severity} value={row.estatus_bitacora} />;
    };

    const externoBodyTemplate = (row: BitacoraTaller) =>
        row.es_taller_externo ? <Tag severity="warning" icon="pi pi-external-link" value="Taller Externo" /> : <span className="text-500">Interno</span>;

    const actionBodyTemplate = (row: BitacoraTaller) => (
        <div className="flex gap-2">
            <Button icon="pi pi-pencil" rounded severity="info" onClick={() => editBitacora(row)} tooltip="Editar / Reportar" />
            {row.estatus_bitacora !== 'Resuelta' && (
                <Button icon="pi pi-check" rounded severity="success" onClick={() => confirmResolver(row)} tooltip="Resolver y reactivar equipo" />
            )}
            <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDelete(row)} tooltip="Eliminar" />
        </div>
    );

    const bitacorasFiltradas = soloAbiertas ? bitacoras.filter(b => b.estatus_bitacora !== 'Resuelta') : bitacoras;

    const leftToolbarTemplate = () => (
        <div className="my-2 flex gap-2 align-items-center">
            <Button
                label={soloAbiertas ? 'Viendo: Abiertas / En Proceso' : 'Viendo: Todas'}
                icon="pi pi-filter"
                severity="secondary"
                outlined
                onClick={() => setSoloAbiertas(!soloAbiertas)}
            />
        </div>
    );

    const rightToolbarTemplate = () => (
        <Link href="/taller/estatus">
            <Button label="Ver Estatus General" icon="pi pi-th-large" severity="help" />
        </Link>
    );

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Bitácora de Taller</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })} placeholder="Buscar..." />
            </span>
        </div>
    );

    const bitacoraDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveBitacora} />
        </>
    );

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} right={rightToolbarTemplate} />

                    <DataTable
                        value={bitacorasFiltradas}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        loading={loading}
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No hay bitácoras registradas"
                        header={header}
                        sortField="fecha_reporte"
                        sortOrder={-1}
                        responsiveLayout="scroll"
                    >
                        <Column header="Equipo" body={tipoBodyTemplate} style={{ minWidth: '220px' }} />
                        <Column field="fecha_reporte" header="Fecha Reporte" body={fechaBodyTemplate} sortable style={{ width: '160px' }} />
                        <Column field="tecnico_asignado" header="Técnico Asignado" body={(r) => textoBodyTemplate(r.tecnico_asignado)} sortable style={{ width: '170px' }} />
                        <Column header="Taller" body={externoBodyTemplate} style={{ width: '150px' }} />
                        <Column field="reportado_por" header="Reportado por" body={(r) => textoBodyTemplate(r.reportado_por)} sortable style={{ width: '160px' }} />
                        <Column field="motivo" header="Motivo" body={(r) => textoBodyTemplate(r.motivo)} style={{ minWidth: '200px' }} />
                        <Column field="estatus_refaccion" header="Estatus de Refacción" body={(r) => textoBodyTemplate(r.estatus_refaccion)} style={{ width: '190px' }} />
                        <Column field="costo_mano_obra" header="Costo M. de Obra" body={(r) => montoBodyTemplate(r.costo_mano_obra)} sortable style={{ width: '160px' }} />
                        <Column field="estatus_bitacora" header="Estatus" body={estatusBodyTemplate} sortable style={{ width: '130px' }} />
                        <Column header="Acciones" body={actionBodyTemplate} style={{ width: '140px' }} />
                    </DataTable>

                    <Dialog visible={bitacoraDialog} style={{ width: '900px' }} header="Reportar / Editar Bitácora" modal className="p-fluid" footer={bitacoraDialogFooter} onHide={hideDialog}>
                        {bitacora && (
                            <>
                                <div className="field">
                                    <label>Equipo</label>
                                    <InputText value={equipoLabel(bitacora)} disabled />
                                </div>

                                <div className="field">
                                    <label>Orden de Trabajo (Almacén)</label>
                                    {!ordenTrabajo ? (
                                        <Button label="Generar Orden de Trabajo" icon="pi pi-file" severity="help" loading={generandoOrden} onClick={generarOrden} className="w-auto" />
                                    ) : (
                                        <div className="border-1 surface-border border-round p-3">
                                            <div className="flex align-items-center gap-2 mb-3">
                                                <Tag severity="info" value={ordenTrabajo.numero} />
                                                <Tag severity={ordenTrabajo.estatus === 'Surtida' ? 'success' : ordenTrabajo.estatus === 'Parcialmente Surtida' ? 'warning' : undefined} value={ordenTrabajo.estatus} />
                                                {ordenTrabajo.estatus === 'Surtida' ? (
                                                    <span className="text-sm" style={{ color: 'var(--green-600)' }}>Ya se recogieron todas las refacciones — puedes marcar esta bitácora como Resuelta.</span>
                                                ) : (
                                                    <span className="text-500 text-sm">Preséntala en Almacén para recoger las refacciones.</span>
                                                )}
                                            </div>

                                            <label htmlFor="busquedaProducto">Buscar producto en Inventario</label>
                                            <InputText id="busquedaProducto" value={busquedaProducto} onChange={(e) => setBusquedaProducto(e.target.value)} placeholder="Busca por código o nombre..." className="mb-3" />

                                            {busquedaProducto.trim() !== '' && (
                                                <DataTable value={productosFiltrados} emptyMessage="Sin coincidencias" size="small" className="mb-3">
                                                    <Column field="codigo" header="Código" style={{ width: '110px' }} />
                                                    <Column field="nombre" header="Producto" />
                                                    <Column field="stock_actual" header="Stock" body={(p: Inventario) => <span>{p.stock_actual} {p.unidad}</span>} style={{ width: '110px' }} />
                                                    <Column
                                                        header="Cantidad"
                                                        style={{ width: '130px' }}
                                                        body={(p: Inventario) => (
                                                            <InputNumber
                                                                value={cantidadesPorProducto[p.id] || null}
                                                                onValueChange={(e) => setCantidadesPorProducto(prev => ({ ...prev, [p.id]: e.value || 0 }))}
                                                                min={0}
                                                                placeholder="0"
                                                                className="w-full"
                                                            />
                                                        )}
                                                    />
                                                    <Column
                                                        header=""
                                                        style={{ width: '110px' }}
                                                        body={(p: Inventario) => (
                                                            <Button label="Agregar" icon="pi pi-plus" size="small" onClick={() => agregarProducto(p, cantidadesPorProducto[p.id] || 0)} />
                                                        )}
                                                    />
                                                </DataTable>
                                            )}

                                            <label>Refacciones solicitadas en esta orden</label>
                                            <DataTable value={detalleOrden} emptyMessage="Aún no se han agregado refacciones" size="small">
                                                <Column field="producto_nombre" header="Producto" />
                                                <Column field="cantidad_solicitada" header="Cantidad" style={{ width: '100px' }} />
                                                <Column field="stock_al_solicitar" header="Stock al pedir" style={{ width: '120px' }} />
                                                <Column header="Excede Stock" style={{ width: '130px' }} body={(d: OrdenTrabajoDetalle) => (d.excede_stock ? <Tag severity="warning" value="Requisición" /> : <span className="text-500">No</span>)} />
                                                <Column header="Surtido" style={{ width: '110px' }} body={(d: OrdenTrabajoDetalle) => (d.surtido ? <Tag severity="success" value="Sí" /> : <Tag value="Pendiente" />)} />
                                                <Column
                                                    header=""
                                                    style={{ width: '60px' }}
                                                    body={(d: OrdenTrabajoDetalle) => (
                                                        !d.surtido && <Button icon="pi pi-trash" text severity="danger" onClick={() => quitarProductoDeOrden(d)} />
                                                    )}
                                                />
                                            </DataTable>
                                        </div>
                                    )}
                                </div>

                                <div className="field">
                                    <label htmlFor="tecnico_asignado">Técnico Asignado</label>
                                    <Dropdown
                                        id="tecnico_asignado"
                                        value={bitacora.tecnico_asignado}
                                        options={tecnicosMantenimiento}
                                        onChange={(e) => setBitacora({ ...bitacora, tecnico_asignado: e.value })}
                                        editable
                                        placeholder="Selecciona un técnico de Mantenimiento o escribe uno externo"
                                        className="w-full"
                                    />
                                    <small className="text-500">Solo se listan operadores del departamento de Mantenimiento; si es un mecánico externo, escribe su nombre directamente.</small>
                                </div>

                                <div className="flex align-items-center gap-2 field">
                                    <InputSwitch inputId="es_taller_externo" checked={!!bitacora.es_taller_externo} onChange={(e) => setBitacora({ ...bitacora, es_taller_externo: e.value })} />
                                    <label htmlFor="es_taller_externo" className="m-0">La unidad está en un taller externo</label>
                                </div>

                                <div className="grid">
                                    <div className="col-6">
                                        <div className="field">
                                            <label htmlFor="reportado_por">Reportado por</label>
                                            <InputText id="reportado_por" value={bitacora.reportado_por || ''} onChange={(e) => setBitacora({ ...bitacora, reportado_por: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="field">
                                            <label htmlFor="estatus_bitacora">Estatus de la Bitácora</label>
                                            <Dropdown
                                                id="estatus_bitacora"
                                                value={bitacora.estatus_bitacora}
                                                options={[
                                                    { label: 'Abierta', value: 'Abierta' },
                                                    { label: 'En Proceso', value: 'En Proceso' },
                                                    { label: 'Resuelta', value: 'Resuelta' }
                                                ]}
                                                onChange={(e) => setBitacora({ ...bitacora, estatus_bitacora: e.value })}
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="field">
                                    <label htmlFor="motivo">Reparaciòn</label>
                                    <InputTextarea id="motivo" rows={3} autoResize value={bitacora.motivo || ''} onChange={(e) => setBitacora({ ...bitacora, motivo: e.target.value })} placeholder="Describe la falla o el motivo del mantenimiento..." />
                                </div>

                                <div className="field">
                                    <label htmlFor="costo_mano_obra">Costo de Mano de Obra</label>
                                    <InputNumber
                                        id="costo_mano_obra"
                                        value={bitacora.costo_mano_obra || 0}
                                        onValueChange={(e) => setBitacora({ ...bitacora, costo_mano_obra: e.value || 0 })}
                                        mode="currency"
                                        currency="MXN"
                                        locale="es-MX"
                                        min={0}
                                        className="w-full"
                                    />
                                </div>

                                <div className="field">
                                    <label htmlFor="estatus_refaccion">Estatus de Refacción</label>
                                    <Dropdown
                                        id="estatus_refaccion"
                                        value={bitacora.estatus_refaccion}
                                        options={estatusRefaccionOptions}
                                        onChange={(e) => setBitacora({ ...bitacora, estatus_refaccion: e.value })}
                                        editable
                                        placeholder="Selecciona o escribe un estatus"
                                        className="w-full"
                                    />
                                </div>

                                <div className="field">
                                    <label htmlFor="observaciones">Observaciones</label>
                                    <InputTextarea id="observaciones" rows={4} autoResize value={bitacora.observaciones || ''} onChange={(e) => setBitacora({ ...bitacora, observaciones: e.target.value })} placeholder="Notas adicionales, avances, piezas pendientes..." />
                                </div>
                            </>
                        )}
                    </Dialog>

                    <Dialog visible={resolverDialog} style={{ width: '450px' }} header="Confirmar Resolución" modal onHide={() => setResolverDialog(false)} footer={
                        <>
                            <Button label="No" icon="pi pi-times" text onClick={() => setResolverDialog(false)} />
                            <Button label="Sí, resolver" icon="pi pi-check" text onClick={resolver} />
                        </>
                    }>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            <span>¿Marcar esta bitácora como <b>Resuelta</b>? El equipo volverá a estatus <b>Activo</b>.</span>
                        </div>
                    </Dialog>

                    <Dialog visible={deleteDialog} style={{ width: '450px' }} header="Confirmar Eliminación" modal onHide={() => setDeleteDialog(false)} footer={
                        <>
                            <Button label="No" icon="pi pi-times" text onClick={() => setDeleteDialog(false)} />
                            <Button label="Sí" icon="pi pi-check" text onClick={eliminar} />
                        </>
                    }>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            <span>¿Eliminar esta bitácora? Esta acción no puede deshacerse.</span>
                        </div>
                    </Dialog>

                    <Dialog visible={confirmExcesoVisible} style={{ width: '480px' }} header="La cantidad excede el stock disponible" modal onHide={() => setConfirmExcesoVisible(false)} footer={
                        <>
                            <Button label="Cancelar" icon="pi pi-times" text onClick={() => setConfirmExcesoVisible(false)} />
                            <Button label="Sí, generar requisición" icon="pi pi-check" text onClick={() => pendienteAgregar && confirmarAgregarProducto(pendienteAgregar.producto, pendienteAgregar.cantidad)} />
                        </>
                    }>
                        {pendienteAgregar && (
                            <div className="flex align-items-start">
                                <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f59e0b' }} />
                                <span>
                                    Estás pidiendo <b>{pendienteAgregar.cantidad}</b> {pendienteAgregar.producto.unidad} de <b>{pendienteAgregar.producto.nombre}</b>, pero solo hay <b>{pendienteAgregar.producto.stock_actual}</b> disponibles.
                                    Si continúas, se agregará la línea a la orden y se generará automáticamente una <b>requisición de compra</b> por la diferencia ({pendienteAgregar.cantidad - pendienteAgregar.producto.stock_actual} {pendienteAgregar.producto.unidad}).
                                </span>
                            </div>
                        )}
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default BitacoraTallerPage;
