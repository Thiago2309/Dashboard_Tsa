"use client";

import React, { useState, useEffect } from 'react';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { registrarEntrada, registrarSalida, getCamionesActivos, Inventario, Camion } from '../../../Services/BD/inventario/inventarioService';

interface MovimientoFormProps {
    producto: Inventario | null;
    tipo: 'entrada' | 'salida';
    onSuccess: () => void;
    onCancel: () => void;
}

const MovimientoForm: React.FC<MovimientoFormProps> = ({ producto, tipo, onSuccess, onCancel }) => {
    const [cantidad, setCantidad] = useState<number>(1);
    const [motivo, setMotivo] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [camiones, setCamiones] = useState<Camion[]>([]);
    const [camionSeleccionadoId, setCamionSeleccionadoId] = useState<number | null>(null);
    const [usuario, setUsuario] = useState('');

    useEffect(() => {
        if (tipo === 'salida') {
            cargarCamiones();
        }
    }, [tipo]);

    const cargarCamiones = async () => {
        try {
            const data = await getCamionesActivos();
            setCamiones(data);
        } catch (error) {
            console.error('Error al cargar camiones:', error);
        }
    };

    const handleSubmit = async () => {
        setSubmitted(true);

        if (cantidad <= 0) return;
        if (!motivo.trim()) return;
        
        if (tipo === 'salida' && !usuario.trim()) return;

        if (tipo === 'salida' && cantidad > producto!.stock_actual) {
            alert(`Stock insuficiente. Solo hay ${producto!.stock_actual} ${producto!.unidad} disponibles`);
            return;
        }

        setLoading(true);
        try {
            if (tipo === 'entrada') {
                await registrarEntrada(producto!.id, cantidad, motivo);
            } else {
                await registrarSalida(
                    producto!.id, 
                    cantidad, 
                    motivo, 
                    camionSeleccionadoId || undefined,
                    usuario.trim()
                );
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

            {tipo === 'salida' && (
                <>
                    <div className="field">
                        <label htmlFor="camion">Camión (opcional)</label>
                        <Dropdown
                            id="camion"
                            value={camionSeleccionadoId}
                            onChange={(e) => setCamionSeleccionadoId(e.value)}
                            options={camiones}
                            optionLabel="numero_economico"
                            optionValue="id"
                            placeholder="Seleccionar camión"
                            className="w-full"
                            showClear
                        />
                        <small className="text-gray-500">Nota: La unidad debe estar en Mantenimiento</small>
                    </div>

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