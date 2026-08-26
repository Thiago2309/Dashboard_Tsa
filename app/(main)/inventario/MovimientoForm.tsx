"use client";

import React, { useState, useEffect } from 'react';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { registrarEntrada, registrarSalida, getCamionesActivos, getMaquinariasActivas, Inventario, Camion, MaquinariaMini } from '../../../Services/BD/inventario/inventarioService';
import { fetchProveedores, Proveedor } from '../../../Services/BD/provedoresService';

interface MovimientoFormProps {
    producto: Inventario | null;
    tipo: 'entrada' | 'salida';
    onSuccess: () => void;
    onCancel: () => void;
}

const comprobanteOptions = [
    { label: 'Nota', value: 'nota' },
    { label: 'Factura', value: 'factura' }
];

const tipoPagoOptions = [
    { label: 'Contado', value: 'contado' },
    { label: 'Crédito', value: 'credito' }
];

const MovimientoForm: React.FC<MovimientoFormProps> = ({ producto, tipo, onSuccess, onCancel }) => {
    const [cantidad, setCantidad] = useState<number>(1);
    const [motivo, setMotivo] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [camiones, setCamiones] = useState<Camion[]>([]);
    const [maquinarias, setMaquinarias] = useState<MaquinariaMini[]>([]);
    const [tipoUnidad, setTipoUnidad] = useState<'camion' | 'maquinaria' | null>(null);
    const [camionSeleccionadoId, setCamionSeleccionadoId] = useState<number | null>(null);
    const [maquinariaSeleccionadaId, setMaquinariaSeleccionadaId] = useState<number | null>(null);
    const [usuario, setUsuario] = useState('');

    // Campos de entrada (compra)
    const [costoUnitario, setCostoUnitario] = useState<number | null>(null);
    const [tipoComprobante, setTipoComprobante] = useState<'nota' | 'factura' | null>(null);
    const [folio, setFolio] = useState('');
    const [tipoPago, setTipoPago] = useState<'credito' | 'contado' | null>(null);
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [proveedorId, setProveedorId] = useState<number | null>(null);

    // Campo de salida
    const [ordenTrabajo, setOrdenTrabajo] = useState('');

    useEffect(() => {
        if (tipo === 'salida') {
            cargarCamiones();
            cargarMaquinarias();
            setCostoUnitario(producto?.precio_compra ?? null);
        } else {
            cargarProveedores();
            setCostoUnitario(producto?.precio_compra ?? null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipo]);

    const cargarCamiones = async () => {
        try {
            const data = await getCamionesActivos();
            setCamiones(data);
        } catch (error) {
            console.error('Error al cargar camiones:', error);
        }
    };

    const cargarMaquinarias = async () => {
        try {
            const data = await getMaquinariasActivas();
            setMaquinarias(data);
        } catch (error) {
            console.error('Error al cargar maquinarias:', error);
        }
    };

    const cargarProveedores = async () => {
        try {
            const data = await fetchProveedores();
            setProveedores(data);
        } catch (error) {
            console.error('Error al cargar proveedores:', error);
        }
    };

    const requiereFolio = tipo === 'entrada' && !!tipoComprobante;

    const handleSubmit = async () => {
        setSubmitted(true);

        if (cantidad <= 0) return;
        if (!motivo.trim()) return;

        if (tipo === 'entrada') {
            if (!proveedorId) return;
            if (!tipoPago) return;
            if (requiereFolio && !folio.trim()) return;
        }

        if (tipo === 'salida') {
            if (!usuario.trim()) return;
            if (!ordenTrabajo.trim()) return;
        }

        if (tipo === 'salida' && cantidad > producto!.stock_actual) {
            alert(`Stock insuficiente. Solo hay ${producto!.stock_actual} ${producto!.unidad} disponibles`);
            return;
        }

        setLoading(true);
        try {
            if (tipo === 'entrada') {
                await registrarEntrada({
                    producto_id: producto!.id,
                    cantidad,
                    motivo,
                    costo_unitario: costoUnitario,
                    tipo_comprobante: tipoComprobante,
                    folio: requiereFolio ? folio.trim() : null,
                    tipo_pago: tipoPago,
                    proveedor_id: proveedorId
                });
            } else {
                await registrarSalida({
                    producto_id: producto!.id,
                    cantidad,
                    motivo,
                    orden_trabajo: ordenTrabajo.trim(),
                    camion_id: tipoUnidad === 'camion' ? camionSeleccionadoId || undefined : undefined,
                    maquinaria_id: tipoUnidad === 'maquinaria' ? maquinariaSeleccionadaId || undefined : undefined,
                    usuario_id: usuario.trim(),
                    costo_unitario: costoUnitario
                });
            }
            onSuccess();
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!producto) return null;

    return (
        <div className="flex flex-column gap-3">
            <div className="text-center mb-2">
                <strong>{producto.codigo}</strong> - {producto.nombre}
                <div className="text-sm mt-1">Stock actual: <strong>{producto.stock_actual} {producto.unidad}</strong></div>
            </div>

            <div className="field">
                <label htmlFor="cantidad">Cantidad ({producto.unidad}) <span style={{ color: 'red' }}> *</span></label>
                <InputNumber
                    id="cantidad"
                    value={cantidad}
                    onValueChange={(e) => setCantidad(e.value || 1)}
                    min={1}
                    max={tipo === 'salida' ? producto.stock_actual : undefined}
                    className={`w-full ${submitted && cantidad <= 0 ? 'p-invalid' : ''}`}
                />
                {submitted && cantidad <= 0 && (
                    <small className="p-error">La cantidad debe ser mayor a 0.</small>
                )}
            </div>

            <div className="field">
                <label htmlFor="motivo">Motivo <span style={{ color: 'red' }}> *</span></label>
                <InputText
                    id="motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder={tipo === 'entrada' ? 'Ej: Compra a proveedor, Devolución' : 'Ej: Reparación camión XYZ, Mantenimiento'}
                    className={`w-full ${submitted && !motivo.trim() ? 'p-invalid' : ''}`}
                />
                {submitted && !motivo.trim() && (
                    <small className="p-error">El motivo es requerido.</small>
                )}
            </div>

            {tipo === 'entrada' && (
                <>
                    <div className="field">
                        <label htmlFor="proveedor">Proveedor <span style={{ color: 'red' }}> *</span></label>
                        <Dropdown
                            id="proveedor"
                            value={proveedorId}
                            onChange={(e) => setProveedorId(e.value)}
                            options={proveedores}
                            optionLabel="nombre"
                            optionValue="id"
                            placeholder="Seleccionar proveedor"
                            className={`w-full ${submitted && !proveedorId ? 'p-invalid' : ''}`}
                            filter
                        />
                        {submitted && !proveedorId && (
                            <small className="p-error">El proveedor es requerido.</small>
                        )}
                    </div>

                    <div className="grid">
                        <div className="col-6">
                            <div className="field">
                                <label htmlFor="tipoComprobante">Comprobante (opcional)</label>
                                <Dropdown
                                    id="tipoComprobante"
                                    value={tipoComprobante}
                                    onChange={(e) => setTipoComprobante(e.value)}
                                    options={comprobanteOptions}
                                    placeholder="Nota o Factura"
                                    className="w-full"
                                    showClear
                                />
                            </div>
                        </div>
                        <div className="col-6">
                            <div className="field">
                                <label htmlFor="folio">Folio {requiereFolio && <span style={{ color: 'red' }}>*</span>}</label>
                                <InputText
                                    id="folio"
                                    value={folio}
                                    onChange={(e) => setFolio(e.target.value)}
                                    placeholder="Folio de la nota/factura"
                                    disabled={!tipoComprobante}
                                    className={`w-full ${submitted && requiereFolio && !folio.trim() ? 'p-invalid' : ''}`}
                                />
                                {submitted && requiereFolio && !folio.trim() && (
                                    <small className="p-error">El folio es requerido.</small>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="field">
                        <label htmlFor="tipoPago">Forma de Pago <span style={{ color: 'red' }}> *</span></label>
                        <Dropdown
                            id="tipoPago"
                            value={tipoPago}
                            onChange={(e) => setTipoPago(e.value)}
                            options={tipoPagoOptions}
                            placeholder="Contado o Crédito"
                            className={`w-full ${submitted && !tipoPago ? 'p-invalid' : ''}`}
                        />
                        {submitted && !tipoPago && (
                            <small className="p-error">La forma de pago es requerida.</small>
                        )}
                        {tipoPago === 'credito' && (
                            <small className="text-gray-500">Se generará una cuenta por pagar al proveedor.</small>
                        )}
                    </div>

                    <div className="field">
                        <label htmlFor="costoUnitarioEntrada">Precio por Unidad</label>
                        <InputNumber
                            id="costoUnitarioEntrada"
                            value={costoUnitario}
                            onValueChange={(e) => setCostoUnitario(e.value ?? null)}
                            mode="currency"
                            currency="MXN"
                            locale="es-MX"
                            min={0}
                            className="w-full"
                        />
                    </div>
                </>
            )}

            {tipo === 'salida' && (
                <>
                    <div className="field">
                        <label htmlFor="ordenTrabajo">Orden de Trabajo <span style={{ color: 'red' }}> *</span></label>
                        <InputText
                            id="ordenTrabajo"
                            value={ordenTrabajo}
                            onChange={(e) => setOrdenTrabajo(e.target.value)}
                            placeholder="Ej: OT-0025"
                            className={`w-full ${submitted && !ordenTrabajo.trim() ? 'p-invalid' : ''}`}
                        />
                        {submitted && !ordenTrabajo.trim() && (
                            <small className="p-error">La orden de trabajo es requerida.</small>
                        )}
                    </div>

                    <div className="field">
                        <label htmlFor="costoUnitarioSalida">Costo por Unidad que Sale</label>
                        <InputNumber
                            id="costoUnitarioSalida"
                            value={costoUnitario}
                            onValueChange={(e) => setCostoUnitario(e.value ?? null)}
                            mode="currency"
                            currency="MXN"
                            locale="es-MX"
                            min={0}
                            className="w-full"
                            disabled
                        />
                        <small className="text-gray-500">Por defecto toma el precio por unidad del producto.</small>
                    </div>

                    <div className="field">
                        <label htmlFor="tipoUnidad">Unidad destino (opcional)</label>
                        <Dropdown
                            id="tipoUnidad"
                            value={tipoUnidad}
                            onChange={(e) => {
                                setTipoUnidad(e.value);
                                setCamionSeleccionadoId(null);
                                setMaquinariaSeleccionadaId(null);
                            }}
                            options={[
                                { label: 'Camión', value: 'camion' },
                                { label: 'Maquinaria', value: 'maquinaria' }
                            ]}
                            placeholder="¿A qué tipo de unidad va?"
                            className="w-full"
                            showClear
                        />
                    </div>

                    {tipoUnidad === 'camion' && (
                        <div className="field">
                            <label htmlFor="camion">Camión</label>
                            <Dropdown
                                id="camion"
                                value={camionSeleccionadoId}
                                onChange={(e) => setCamionSeleccionadoId(e.value)}
                                options={camiones}
                                optionLabel="nombre"
                                optionValue="id"
                                placeholder="Seleccionar camión"
                                className="w-full"
                                showClear
                                filter
                            />
                        </div>
                    )}

                    {tipoUnidad === 'maquinaria' && (
                        <div className="field">
                            <label htmlFor="maquinaria">Maquinaria</label>
                            <Dropdown
                                id="maquinaria"
                                value={maquinariaSeleccionadaId}
                                onChange={(e) => setMaquinariaSeleccionadaId(e.value)}
                                options={maquinarias.map(m => ({ label: `${m.eco} - ${m.equipo}`, value: m.id }))}
                                placeholder="Seleccionar maquinaria"
                                className="w-full"
                                showClear
                                filter
                            />
                        </div>
                    )}

                    <div className="field">
                        <label htmlFor="usuario">Usuario que retira <span style={{ color: 'red' }}> *</span></label>
                        <InputText
                            id="usuario"
                            value={usuario}
                            onChange={(e) => setUsuario(e.target.value)}
                            placeholder="Ej: Juan Pérez, Mecánico de turno"
                            className={`w-full ${submitted && !usuario.trim() ? 'p-invalid' : ''}`}
                        />
                        {submitted && !usuario.trim() && (
                            <small className="p-error">El usuario es requerido para registrar la salida.</small>
                        )}
                    </div>
                </>
            )}

            <div className="flex justify-content-end gap-2 mt-3">
                <Button label="Cancelar" icon="pi pi-times" text onClick={onCancel} />
                <Button
                    label={tipo === 'entrada' ? 'Registrar Entrada' : 'Registrar Salida'}
                    icon={tipo === 'entrada' ? 'pi pi-plus' : 'pi pi-minus'}
                    severity={tipo === 'entrada' ? 'success' : 'warning'}
                    onClick={handleSubmit}
                    loading={loading}
                />
            </div>
        </div>
    );
};

export default MovimientoForm;