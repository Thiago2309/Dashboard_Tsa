"use client";

import React, { useState, useEffect, useRef } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { DataTableFilterMeta } from 'primereact/datatable';

import {
    getProductos,
    buscarProductos,
    filtrarPorCategoria,
    getCategorias,
    eliminarProducto,
    Inventario
} from '../../../../Services/BD/inventario/inventarioService';

import ProductoForm from '../ProductoForm';
import MovimientoForm from '../MovimientoForm';
import HistorialMovimientos from '../HistorialMovimientos';

const InventarioPage = () => {
    const [productos, setProductos] = useState<Inventario[]>([]);
    const [productosFiltrados, setProductosFiltrados] = useState<Inventario[]>([]);
    const [categorias, setCategorias] = useState<string[]>([]);
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedProductos, setSelectedProductos] = useState<Inventario[]>([]);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });

    // Estados para diálogos
    const [productoDialog, setProductoDialog] = useState(false);
    const [deleteProductoDialog, setDeleteProductoDialog] = useState(false);
    const [deleteProductosDialog, setDeleteProductosDialog] = useState(false);
    const [movimientoDialog, setMovimientoDialog] = useState(false);
    const [historialDialog, setHistorialDialog] = useState(false);

    const [productoSeleccionado, setProductoSeleccionado] = useState<Inventario | null>(null);
    const [modoEdicion, setModoEdicion] = useState(false);
    const [tipoMovimiento, setTipoMovimiento] = useState<'entrada' | 'salida'>('entrada');

    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    // Cargar datos iniciales
    const cargarProductos = async () => {
        setLoading(true);
        try {
            const data = await getProductos();
            setProductos(data);
            setProductosFiltrados(data);
            const cats = await getCategorias();
            setCategorias(cats);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarProductos();
    }, []);

    // Buscar productos
    useEffect(() => {
        const filtrar = async () => {
            if (busqueda.trim()) {
                const resultados = await buscarProductos(busqueda);
                setProductosFiltrados(resultados);
            } else if (categoriaSeleccionada) {
                const resultados = await filtrarPorCategoria(categoriaSeleccionada);
                setProductosFiltrados(resultados);
            } else {
                setProductosFiltrados(productos);
            }
        };
        filtrar();
    }, [busqueda, categoriaSeleccionada, productos]);

    const showToast = (severity: 'success' | 'error' | 'warn', summary: string, detail: string) => {
        toast.current?.show({ severity, summary, detail, life: 3000 });
    };

    // Template de stock con colores
    const stockBodyTemplate = (rowData: Inventario) => {
        const stock = rowData.stock_actual;
        const minimo = rowData.stock_minimo;
        let severity: 'success' | 'warning' | 'danger' = 'success';
        let texto = `${stock} ${rowData.unidad}`;

        if (stock === 0) {
            severity = 'danger';
            texto = `AGOTADO - ${texto}`;
        } else if (stock <= minimo) {
            severity = 'warning';
            texto = `⚠️ ¡COMPRAR! - ${texto}`;
        }

        return <Tag severity={severity} value={texto} />;
    };

    // Acciones
    const openNew = () => {
        setProductoSeleccionado(null);
        setModoEdicion(false);
        setProductoDialog(true);
    };

    const editProducto = (producto: Inventario) => {
        setProductoSeleccionado(producto);
        setModoEdicion(true);
        setProductoDialog(true);
    };

    const confirmDeleteProducto = (producto: Inventario) => {
        setProductoSeleccionado(producto);
        setDeleteProductoDialog(true);
    };

    const confirmDeleteSelected = () => {
        if (selectedProductos.length === 0) {
            showToast('warn', 'Advertencia', 'Seleccione al menos un producto');
            return;
        }
        setDeleteProductosDialog(true);
    };

    const deleteProductoConfirmado = async () => {
        try {
            await eliminarProducto(productoSeleccionado!.id);
            setProductos(productos.filter((p) => p.id !== productoSeleccionado!.id));
            setProductosFiltrados(productosFiltrados.filter((p) => p.id !== productoSeleccionado!.id));
            setDeleteProductoDialog(false);
            showToast('success', 'Éxito', 'Producto eliminado correctamente');
        } catch (error: any) {
            showToast('error', 'Error', error.message);
        }
    };

    const deleteSelectedProductos = async () => {
        try {
            await Promise.all(selectedProductos.map((p) => eliminarProducto(p.id)));
            setProductos(productos.filter((p) => !selectedProductos.includes(p)));
            setProductosFiltrados(productosFiltrados.filter((p) => !selectedProductos.includes(p)));
            setDeleteProductosDialog(false);
            setSelectedProductos([]);
            showToast('success', 'Éxito', 'Productos eliminados correctamente');
        } catch (error: any) {
            showToast('error', 'Error', error.message);
        }
    };

    const openMovimiento = (producto: Inventario, tipo: 'entrada' | 'salida') => {
        setProductoSeleccionado(producto);
        setTipoMovimiento(tipo);
        setMovimientoDialog(true);
    };

    const openHistorial = (producto: Inventario) => {
        setProductoSeleccionado(producto);
        setHistorialDialog(true);
    };

    const exportCSV = () => dt.current?.exportCSV();

    const actionBodyTemplate = (rowData: Inventario) => {
        return (
            <div className="flex gap-2">
                <Button
                    icon="pi pi-plus"
                    rounded
                    severity="success"
                    tooltip="Registrar Entrada"
                    onClick={() => openMovimiento(rowData, 'entrada')}
                />
                <Button
                    icon="pi pi-minus"
                    rounded
                    severity="warning"
                    tooltip="Registrar Salida"
                    onClick={() => openMovimiento(rowData, 'salida')}
                />
                <Button
                    icon="pi pi-history"
                    rounded
                    severity="info"
                    tooltip="Ver Historial"
                    onClick={() => openHistorial(rowData)}
                />
                <Button
                    icon="pi pi-pencil"
                    rounded
                    severity="secondary"
                    tooltip="Editar Producto"
                    onClick={() => editProducto(rowData)}
                />
                <Button
                    icon="pi pi-trash"
                    rounded
                    severity="danger"
                    tooltip="Eliminar Producto"
                    onClick={() => confirmDeleteProducto(rowData)}
                />
            </div>
        );
    };

    // Toolbars
    const leftToolbarTemplate = () => (
        <div className="my-2 flex gap-2">
            <Button label="Nuevo Producto" icon="pi pi-plus" severity="info" onClick={openNew} />
            <Button
                label="Eliminar"
                icon="pi pi-trash"
                severity="danger"
                onClick={confirmDeleteSelected}
                disabled={!selectedProductos || selectedProductos.length === 0}
            />
        </div>
    );

    const rightToolbarTemplate = () => (
        <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={exportCSV} />
    );

    // Header tabla
    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Inventario</h5>
            <div className="flex gap-2 mt-2 md:mt-0">
                <span className="p-input-icon-left">
                    <i className="pi pi-search" />
                    <InputText
                        type="search"
                        onInput={(e) =>
                            setFilters({
                                ...filters,
                                global: { value: e.currentTarget.value, matchMode: 'contains' }
                            })
                        }
                        placeholder="Buscar..."
                    />
                </span>
                <Dropdown
                    value={categoriaSeleccionada}
                    options={categorias.map(cat => ({ label: cat, value: cat }))}
                    onChange={(e) => setCategoriaSeleccionada(e.value)}
                    placeholder="Todas las categorías"
                    showClear
                    style={{ minWidth: '180px' }}
                />
            </div>
        </div>
    );

    // Footer diálogos
    const productoDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={() => setProductoDialog(false)} />
            <Button label="Guardar" icon="pi pi-check" text onClick={() => {
                // El submit se maneja dentro del ProductoForm
                // Por eso llamamos a un ref o pasamos la función
            }} />
        </>
    );

    const deleteProductoDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={() => setDeleteProductoDialog(false)} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteProductoConfirmado} />
        </>
    );

    const deleteProductosDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={() => setDeleteProductosDialog(false)} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteSelectedProductos} />
        </>
    );

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} right={rightToolbarTemplate} />

                    <DataTable
                        ref={dt}
                        value={productosFiltrados}
                        selection={selectedProductos}
                        onSelectionChange={(e) => setSelectedProductos(e.value || [])}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} productos"
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No se encontraron productos"
                        header={header}
                        responsiveLayout="scroll"
                        loading={loading}
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} exportable={false} />
                        <Column field="id" header="ID" sortable style={{ width: '80px' }} />
                        <Column field="codigo" header="Código" sortable style={{ width: '150px' }} />
                        <Column field="nombre" header="Producto" sortable style={{ minWidth: '200px' }} />
                        <Column field="categoria" header="Categoría" sortable style={{ width: '150px' }} />
                        <Column field="stock_actual" header="Stock" body={stockBodyTemplate} sortable style={{ width: '180px' }} />
                        <Column field="stock_minimo" header="Stock Mínimo" sortable style={{ width: '120px' }} />
                        <Column field="ubicacion" header="Ubicación" style={{ width: '150px' }} />
                        <Column field="unidad" header="Unidad" style={{ width: '100px' }} />
                        <Column
                            header="Acciones"
                            body={actionBodyTemplate}
                            headerStyle={{ minWidth: '280px' }}
                            exportable={false}
                        />
                    </DataTable>

                    {/* Diálogo Producto (Crear/Editar) */}
                    <Dialog
                        visible={productoDialog}
                        style={{ width: '550px' }}
                        header={modoEdicion ? 'Editar Producto' : 'Nuevo Producto'}
                        modal
                        className="p-fluid"
                        footer={null} // El footer se maneja dentro del ProductoForm para controlar el submit
                        onHide={() => setProductoDialog(false)}
                    >
                        <ProductoForm
                            producto={productoSeleccionado}
                            modoEdicion={modoEdicion}
                            onSuccess={() => {
                                setProductoDialog(false);
                                cargarProductos();
                                showToast('success', 'Éxito', modoEdicion ? 'Producto actualizado' : 'Producto creado');
                            }}
                            onCancel={() => setProductoDialog(false)}
                        />
                    </Dialog>

                    {/* Diálogo Movimiento (Entrada/Salida) */}
                    <Dialog
                        visible={movimientoDialog}
                        style={{ width: '500px' }}
                        header={tipoMovimiento === 'entrada' ? 'Registrar Entrada' : 'Registrar Salida'}
                        modal
                        className="p-fluid"
                        onHide={() => setMovimientoDialog(false)}
                    >
                        <MovimientoForm
                            producto={productoSeleccionado}
                            tipo={tipoMovimiento}
                            onSuccess={() => {
                                setMovimientoDialog(false);
                                cargarProductos();
                                showToast('success', 'Éxito', 'Movimiento registrado correctamente');
                            }}
                            onCancel={() => setMovimientoDialog(false)}
                        />
                    </Dialog>

                    {/* Diálogo Historial */}
                    <Dialog
                        visible={historialDialog}
                        style={{ width: '750px' }}
                        header={`Historial - ${productoSeleccionado?.nombre || ''}`}
                        modal
                        onHide={() => setHistorialDialog(false)}
                    >
                        <HistorialMovimientos productoId={productoSeleccionado?.id || 0} />
                    </Dialog>

                    {/* Confirmar eliminación individual */}
                    <Dialog
                        visible={deleteProductoDialog}
                        style={{ width: '450px' }}
                        header="Confirmar Eliminación"
                        modal
                        footer={deleteProductoDialogFooter}
                        onHide={() => setDeleteProductoDialog(false)}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            {productoSeleccionado && (
                                <span>
                                    ¿Está seguro de eliminar el producto <b>{productoSeleccionado.nombre}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    {/* Confirmar eliminación múltiple */}
                    <Dialog
                        visible={deleteProductosDialog}
                        style={{ width: '450px' }}
                        header="Confirmar Eliminación Múltiple"
                        modal
                        footer={deleteProductosDialogFooter}
                        onHide={() => setDeleteProductosDialog(false)}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            <span>
                                ¿Está seguro de eliminar los {selectedProductos.length} productos seleccionados?
                            </span>
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default InventarioPage;