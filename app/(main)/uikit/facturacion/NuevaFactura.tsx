"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { AutoComplete } from 'primereact/autocomplete';

import {
    crearFactura,
    timbrarFactura,
    getClientesFiscales,
    ClienteFiscal,
    ProductoFactura
} from '../../../../Services/BD/facturacion/fiscalApiService';
import { getProductos, Inventario } from '../../../../Services/BD/inventario/inventarioService';

// Catálogos SAT (simplificados)
const FORMAS_PAGO = [
    { label: 'Efectivo', value: '01' },
    { label: 'Cheque', value: '02' },
    { label: 'Transferencia', value: '03' },
    { label: 'Tarjeta', value: '04' },
    { label: 'Monedero', value: '28' }
];

const METODOS_PAGO = [
    { label: 'Pago en una sola exhibición', value: 'PUE' },
    { label: 'Pago en parcialidades', value: 'PPD' }
];

const USOS_CFDI = [
    { label: 'Adquisición de mercancías', value: 'G01' },
    { label: 'Devoluciones, descuentos o bonificaciones', value: 'G02' },
    { label: 'Gastos en general', value: 'G03' },
    { label: 'Construcciones', value: 'I01' },
    { label: 'Mobiliario y equipo de oficina', value: 'I02' },
    { label: 'Equipo de transporte', value: 'I03' },
    { label: 'Equipo de cómputo', value: 'I04' },
    { label: 'Dados, troqueles, moldes, matrices y herramental', value: 'I05' },
    { label: 'Comunicaciones telefónicas', value: 'I06' },
    { label: 'Comunicaciones satelitales', value: 'I07' },
    { label: 'Otra maquinaria y equipo', value: 'I08' },
    { label: 'Honorarios médicos, dentales y gastos hospitalarios', value: 'D01' },
    { label: 'Gastos médicos por incapacidad', value: 'D02' },
    { label: 'Gastos funerarios', value: 'D03' },
    { label: 'Donativos', value: 'D04' },
    { label: 'Intereses reales', value: 'D05' },
    { label: 'Aportaciones voluntarias al SAR', value: 'D06' },
    { label: 'Primas de seguros de gastos médicos', value: 'D07' },
    { label: 'Gastos de transportación escolar', value: 'D08' },
    { label: 'Depósitos en cuentas especiales de ahorro', value: 'D09' },
    { label: 'Pagos por servicios educativos', value: 'D10' },
    { label: 'Sin obligaciones fiscales', value: 'S01' }
];

const NuevaFactura = () => {
    const [clientes, setClientes] = useState<ClienteFiscal[]>([]);
    const [productos, setProductos] = useState<Inventario[]>([]);
    const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteFiscal | null>(null);
    const [productosFactura, setProductosFactura] = useState<ProductoFactura[]>([]);
    const [productoSeleccionado, setProductoSeleccionado] = useState<Inventario | null>(null);
    const [cantidad, setCantidad] = useState(1);
    const [metodoPago, setMetodoPago] = useState('PUE');
    const [formaPago, setFormaPago] = useState('01');
    const [usoCFDI, setUsoCFDI] = useState('G01');
    const [tipoComprobante, setTipoComprobante] = useState('I');
    const [loading, setLoading] = useState(false);
    const [showProductoDialog, setShowProductoDialog] = useState(false);
    const [filteredProductos, setFilteredProductos] = useState<Inventario[]>([]);
    const [searchProducto, setSearchProducto] = useState('');

    const toast = useRef<Toast>(null);

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            const [clientesData, productosData] = await Promise.all([
                getClientesFiscales(),
                getProductos()
            ]);
            
            // ✅ Filtrar clientes que tengan RFC válido
            const clientesConRFC = clientesData.filter(cliente => 
                cliente.rfc && cliente.rfc.trim().length >= 12
            );
            
            setClientes(clientesConRFC);
            setProductos(productosData);
            
            if (clientesConRFC.length === 0) {
                toast.current?.show({
                    severity: 'warn',
                    summary: 'Sin clientes válidos',
                    detail: 'No hay clientes con RFC registrado. Agrega un RFC a tus clientes.',
                    life: 5000
                });
            }
        } catch (error: any) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: error.message,
                life: 3000
            });
        }
    };

    // ✅ Nueva función para validar cliente antes de timbrar
    const validarCliente = (cliente: ClienteFiscal): { valid: boolean; message?: string } => {
        if (!cliente.rfc || cliente.rfc.trim().length < 12) {
            return { 
                valid: false, 
                message: `El cliente "${cliente.empresa}" no tiene RFC válido. RFC actual: "${cliente.rfc || 'VACÍO'}"` 
            };
        }

        // Validar formato básico de RFC (Persona Moral: 12 caracteres, Persona Física: 13 caracteres)
        const rfcRegex = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
        if (!rfcRegex.test(cliente.rfc.toUpperCase())) {
            return {
                valid: false,
                message: `El RFC "${cliente.rfc}" no tiene un formato válido. Debe ser 12 o 13 caracteres alfanuméricos.`
            };
        }

        if (!cliente.regimen_fiscal) {
            return {
                valid: false,
                message: `El cliente "${cliente.empresa}" no tiene régimen fiscal registrado.`
            };
        }

        if (!cliente.uso_cfdi) {
            return {
                valid: false,
                message: `El cliente "${cliente.empresa}" no tiene uso de CFDI registrado.`
            };
        }

        return { valid: true };
    };

    const searchProductos = (event: any) => {
        const query = event.query.toLowerCase();
        const filtered = productos.filter(p => 
            p.nombre.toLowerCase().includes(query) ||
            p.codigo?.toLowerCase().includes(query)
        );
        setFilteredProductos(filtered);
    };

    const agregarProducto = () => {
        if (productoSeleccionado) {
            const nuevoProducto: ProductoFactura = {
                id: productoSeleccionado.id,
                codigo: productoSeleccionado.codigo,
                descripcion: productoSeleccionado.nombre,
                cantidad: cantidad,
                unidad: productoSeleccionado.unidad || 'pza',
                precio_unitario: productoSeleccionado.precio_compra || 0,
                impuesto: 'IVA',
                tasa_impuesto: 16
            };
            setProductosFactura([...productosFactura, nuevoProducto]);
            setProductoSeleccionado(null);
            setCantidad(1);
            setShowProductoDialog(false);
            toast.current?.show({
                severity: 'success',
                summary: 'Producto agregado',
                detail: `${nuevoProducto.cantidad} x ${nuevoProducto.descripcion}`,
                life: 2000
            });
        }
    };

    const eliminarProducto = (index: number) => {
        const nuevos = [...productosFactura];
        nuevos.splice(index, 1);
        setProductosFactura(nuevos);
    };

    const calcularTotales = () => {
        let subtotal = 0;
        let iva = 0;
        productosFactura.forEach(p => {
            const importe = p.cantidad * p.precio_unitario;
            subtotal += importe;
            iva += (importe * (p.tasa_impuesto || 16)) / 100;
        });
        return { subtotal, iva, total: subtotal + iva };
    };

    const handleSubmit = async () => {
        if (!clienteSeleccionado) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Cliente requerido',
                detail: 'Selecciona un cliente',
                life: 3000
            });
            return;
        }

        // ✅ Validar cliente antes de continuar
        const validacion = validarCliente(clienteSeleccionado);
        if (!validacion.valid) {
            toast.current?.show({
                severity: 'error',
                summary: 'Cliente inválido',
                detail: validacion.message,
                life: 5000
            });
            return;
        }

        if (productosFactura.length === 0) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Productos requeridos',
                detail: 'Agrega al menos un producto',
                life: 3000
            });
            return;
        }

        setLoading(true);
        try {
            // 1. Crear factura
            const factura = await crearFactura({
                cliente_id: clienteSeleccionado.id,
                tipo_comprobante: tipoComprobante as 'I' | 'E' | 'T',
                metodo_pago: metodoPago as 'PUE' | 'PPD',
                forma_pago: formaPago,
                uso_cfdi: usoCFDI,
                productos: productosFactura
            });

            // 2. Timbrar factura
            const resultado = await timbrarFactura(factura.id!);

            if (resultado.success) {
                toast.current?.show({
                    severity: 'success',
                    summary: '¡Factura timbrada!',
                    detail: `UUID: ${resultado.uuid}`,
                    life: 5000
                });
                
                // Limpiar formulario
                setProductosFactura([]);
                setClienteSeleccionado(null);
            } else {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Error al timbrar',
                    detail: resultado.error,
                    life: 5000
                });
            }
        } catch (error: any) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: error.message,
                life: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    const { subtotal, iva, total } = calcularTotales();

    return (
        <div className="card">
            <Toast ref={toast} />
            <h2>Nueva Factura</h2>

            {/* Datos del cliente */}
            <div className="grid mb-4">
                <div className="col-12 md:col-6">
                    <label>Cliente *</label>
                    <Dropdown
                        value={clienteSeleccionado}
                        onChange={(e) => setClienteSeleccionado(e.value)}
                        options={clientes}
                        optionLabel="empresa"
                        placeholder="Seleccionar cliente"
                        className="w-full"
                        filter
                        emptyMessage="No hay clientes con RFC registrado"
                    />
                    {clienteSeleccionado && (
                        <small className="text-gray-500">
                            RFC: {clienteSeleccionado.rfc} | Régimen: {clienteSeleccionado.regimen_fiscal || 'No registrado'}
                        </small>
                    )}
                </div>
                <div className="col-12 md:col-3">
                    <label>Uso CFDI *</label>
                    <Dropdown
                        value={usoCFDI}
                        onChange={(e) => setUsoCFDI(e.value)}
                        options={USOS_CFDI}
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Seleccionar uso"
                        className="w-full"
                    />
                </div>
                <div className="col-12 md:col-3">
                    <label>Método de pago *</label>
                    <Dropdown
                        value={metodoPago}
                        onChange={(e) => setMetodoPago(e.value)}
                        options={METODOS_PAGO}
                        optionLabel="label"
                        optionValue="value"
                        className="w-full"
                    />
                </div>
                <div className="col-12 md:col-3">
                    <label>Forma de pago *</label>
                    <Dropdown
                        value={formaPago}
                        onChange={(e) => setFormaPago(e.value)}
                        options={FORMAS_PAGO}
                        optionLabel="label"
                        optionValue="value"
                        className="w-full"
                    />
                </div>
                <div className="col-12 md:col-3">
                    <label>Tipo de comprobante</label>
                    <Dropdown
                        value={tipoComprobante}
                        onChange={(e) => setTipoComprobante(e.value)}
                        options={[
                            { label: 'Ingreso', value: 'I' },
                            { label: 'Egreso', value: 'E' },
                            { label: 'Traslado', value: 'T' }
                        ]}
                        className="w-full"
                    />
                </div>
            </div>

            {/* Productos */}
            <div className="mb-4">
                <div className="flex justify-content-between align-items-center mb-2">
                    <h3>Productos</h3>
                    <Button
                        label="Agregar producto"
                        icon="pi pi-plus"
                        onClick={() => setShowProductoDialog(true)}
                    />
                </div>

                <DataTable value={productosFactura} emptyMessage="No hay productos agregados">
                    <Column field="codigo" header="Código" style={{ width: '100px' }} />
                    <Column field="descripcion" header="Descripción" />
                    <Column field="cantidad" header="Cantidad" style={{ width: '100px' }} />
                    <Column field="unidad" header="Unidad" style={{ width: '100px' }} />
                    <Column 
                        field="precio_unitario" 
                        header="Precio" 
                        style={{ width: '120px' }}
                        body={(rowData) => `$${rowData.precio_unitario.toFixed(2)}`}
                    />
                    <Column 
                        header="Importe" 
                        style={{ width: '120px' }}
                        body={(rowData) => `$${(rowData.cantidad * rowData.precio_unitario).toFixed(2)}`}
                    />
                    <Column
                        header="Acciones"
                        style={{ width: '80px' }}
                        body={(rowData, { rowIndex }) => (
                            <Button
                                icon="pi pi-trash"
                                severity="danger"
                                rounded
                                onClick={() => eliminarProducto(rowIndex)}
                            />
                        )}
                    />
                </DataTable>

                <div className="flex justify-content-end mt-3">
                    <div className="text-right">
                        <div>Subtotal: <strong>${subtotal.toFixed(2)}</strong></div>
                        <div>IVA (16%): <strong>${iva.toFixed(2)}</strong></div>
                        <div className="text-xl mt-2">Total: <strong>${total.toFixed(2)}</strong></div>
                    </div>
                </div>
            </div>

            {/* Botones */}
            <div className="flex justify-content-end gap-2">
                <Button label="Cancelar" severity="secondary" />
                <Button
                    label="Timbrar Factura"
                    icon="pi pi-check"
                    onClick={handleSubmit}
                    loading={loading}
                    disabled={productosFactura.length === 0 || !clienteSeleccionado}
                />
            </div>

            {/* Dialog agregar producto */}
            <Dialog
                visible={showProductoDialog}
                header="Agregar producto"
                modal
                style={{ width: '500px' }}
                onHide={() => setShowProductoDialog(false)}
            >
                <div className="flex flex-column gap-3">
                    <div className="field">
                        <label>Producto</label>
                        <AutoComplete
                            value={productoSeleccionado}
                            suggestions={filteredProductos}
                            completeMethod={searchProductos}
                            field="nombre"
                            onChange={(e) => setProductoSeleccionado(e.value)}
                            placeholder="Buscar producto"
                            className="w-full"
                        />
                    </div>
                    <div className="field">
                        <label>Cantidad</label>
                        <InputNumber
                            value={cantidad}
                            onValueChange={(e) => setCantidad(e.value || 1)}
                            min={1}
                            className="w-full"
                        />
                    </div>
                    <Button label="Agregar" onClick={agregarProducto} />
                </div>
            </Dialog>
        </div>
    );
};

export default NuevaFactura;