"use client";

import React, { useState, useEffect } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { crearProducto, actualizarProducto, Inventario } from '../../../Services/BD/inventario/inventarioService';

interface ProductoFormProps {
    producto?: Inventario | null;
    modoEdicion: boolean;
    onSuccess: () => void;
    onCancel: () => void;
}

const categoriasOptions = [
    { label: 'Neumáticos', value: 'Neumáticos' },
    { label: 'Lubricantes', value: 'Lubricantes' },
    { label: 'Filtros', value: 'Filtros' },
    { label: 'Frenos', value: 'Frenos' },
    { label: 'Eléctricos', value: 'Eléctricos' },
    { label: 'Hidráulicos', value: 'Hidráulicos' },
    { label: 'Herramientas', value: 'Herramientas' },
    { label: 'Refacciones', value: 'Refacciones' },
    { label: 'Otros', value: 'Otros' }
];

const unidadesOptions = [
    { label: 'Pieza(s)', value: 'pza' },
    { label: 'Kilogramo(s)', value: 'kg' },
    { label: 'Litro(s)', value: 'litro' },
    { label: 'Juego', value: 'juego' },
    { label: 'Metro(s)', value: 'metro' },
    { label: 'Caja', value: 'caja' }
];

const ProductoForm: React.FC<ProductoFormProps> = ({ producto, modoEdicion, onSuccess, onCancel }) => {
    const [formData, setFormData] = useState({
        codigo: '',
        nombre: '',
        categoria: null as string | null,
        descripcion: '',
        stock_actual: 0,
        stock_minimo: 5,
        stock_maximo: null as number | null,
        unidad: 'pza',
        ubicacion: '',
        precio_compra: null as number | null
    });
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (producto && modoEdicion) {
            setFormData({
                codigo: producto.codigo,
                nombre: producto.nombre,
                categoria: producto.categoria,
                descripcion: producto.descripcion || '',
                stock_actual: producto.stock_actual,
                stock_minimo: producto.stock_minimo,
                stock_maximo: producto.stock_maximo,
                unidad: producto.unidad,
                ubicacion: producto.ubicacion || '',
                precio_compra: producto.precio_compra
            });
        }
    }, [producto, modoEdicion]);

    const handleSubmit = async () => {
        setSubmitted(true);

        if (!formData.codigo.trim() || !formData.nombre.trim()) {
            return;
        }

        setLoading(true);
        try {
            if (modoEdicion && producto) {
                await actualizarProducto(producto.id, formData);
            } else {
                await crearProducto(formData as any);
            }
            onSuccess();
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-column gap-3">
            <div className="field">
                <label htmlFor="codigo">Código <span style={{ color: 'red' }}> *</span></label>
                <InputText
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    placeholder="Ej: FIL-001, LLANTA-01"
                    className={`w-full ${submitted && !formData.codigo ? 'p-invalid' : ''}`}
                    autoFocus
                />
                {submitted && !formData.codigo && (
                    <small className="p-error">El código es requerido.</small>
                )}
            </div>

            <div className="field">
                <label htmlFor="nombre">Nombre <span style={{ color: 'red' }}> *</span></label>
                <InputText
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Nombre del producto"
                    className={`w-full ${submitted && !formData.nombre ? 'p-invalid' : ''}`}
                />
                {submitted && !formData.nombre && (
                    <small className="p-error">El nombre es requerido.</small>
                )}
            </div>

            <div className="field">
                <label htmlFor="categoria">Categoría</label>
                <Dropdown
                    id="categoria"
                    value={formData.categoria}
                    options={categoriasOptions}
                    onChange={(e) => setFormData({ ...formData, categoria: e.value })}
                    placeholder="Seleccionar categoría"
                    className="w-full"
                    showClear
                />
            </div>

            <div className="field">
                <label htmlFor="descripcion">Descripción</label>
                <InputText
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Descripción opcional"
                    className="w-full"
                />
            </div>

            <div className="grid">
                <div className="col-6">
                    <div className="field">
                        <label htmlFor="unidad">Unidad</label>
                        <Dropdown
                            id="unidad"
                            value={formData.unidad}
                            options={unidadesOptions}
                            onChange={(e) => setFormData({ ...formData, unidad: e.value })}
                            className="w-full"
                        />
                    </div>
                </div>
                <div className="col-6">
                    <div className="field">
                        <label htmlFor="ubicacion">Ubicación</label>
                        <InputText
                            id="ubicacion"
                            value={formData.ubicacion}
                            onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                            placeholder="Estante, anaquel"
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            <div className="grid">
                <div className="col-4">
                    <div className="field">
                        <label htmlFor="stock_actual">Stock Actual</label>
                        <InputNumber
                            id="stock_actual"
                            value={formData.stock_actual}
                            onValueChange={(e) => setFormData({ ...formData, stock_actual: e.value || 0 })}
                            min={0}
                            className="w-full"
                        />
                    </div>
                </div>
                <div className="col-4">
                    <div className="field">
                        <label htmlFor="stock_minimo">Stock Mínimo</label>
                        <InputNumber
                            id="stock_minimo"
                            value={formData.stock_minimo}
                            onValueChange={(e) => setFormData({ ...formData, stock_minimo: e.value || 0 })}
                            min={0}
                            className="w-full"
                        />
                    </div>
                </div>
                <div className="col-4">
                    <div className="field">
                        <label htmlFor="stock_maximo">Stock Máximo</label>
                        <InputNumber
                            id="stock_maximo"
                            value={formData.stock_maximo}
                            onValueChange={(e) => setFormData({ ...formData, stock_maximo: e.value || null })}
                            min={0}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            <div className="field">
                <label htmlFor="precio_compra">Precio de Compra</label>
                <InputNumber
                    id="precio_compra"
                    value={formData.precio_compra}
                    onValueChange={(e) => setFormData({ ...formData, precio_compra: e.value || null })}
                    mode="currency"
                    currency="MXN"
                    locale="es-MX"
                    min={0}
                    className="w-full"
                />
            </div>

            <div className="flex justify-content-end gap-2 mt-3">
                <Button label="Cancelar" icon="pi pi-times" text onClick={onCancel} />
                <Button label={modoEdicion ? "Actualizar" : "Guardar"} icon="pi pi-save" onClick={handleSubmit} loading={loading} />
            </div>
        </div>
    );
};

export default ProductoForm;            