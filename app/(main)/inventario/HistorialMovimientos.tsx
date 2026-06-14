"use client";

import React, { useState, useEffect } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { getMovimientosByProducto, MovimientoInventario } from '../../../Services/BD/inventario/inventarioService';

interface HistorialMovimientosProps {
    productoId: number;
}

const HistorialMovimientos: React.FC<HistorialMovimientosProps> = ({ productoId }) => {
    const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (productoId > 0) {
            cargarMovimientos();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productoId]);

    const cargarMovimientos = async () => {
        setLoading(true);
        try {
            const data = await getMovimientosByProducto(productoId);
            setMovimientos(data);
        } catch (error: any) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const tipoBodyTemplate = (rowData: MovimientoInventario) => {
        return (
            <Tag
                severity={rowData.tipo === 'entrada' ? 'success' : 'warning'}
                value={rowData.tipo === 'entrada' ? '➕ ENTRADA' : '➖ SALIDA'}
            />
        );
    };

    const fechaBodyTemplate = (rowData: MovimientoInventario) => {
        return new Date(rowData.fecha).toLocaleString('es-MX');
    };

    return (
        <DataTable value={movimientos} loading={loading} size="small" emptyMessage="No hay movimientos registrados">
            <Column field="id" header="#" style={{ width: '70px' }} />
            <Column field="tipo" header="Tipo" body={tipoBodyTemplate} style={{ width: '120px' }} />
            <Column field="cantidad" header="Cantidad" style={{ width: '100px' }} />
            <Column field="motivo" header="Motivo" />
            <Column field="camion_id" header="Camión" body={(rowData) => {
                if (!rowData.camion_id) return '—';
                return `ID: ${rowData.camion_id}`;
            }} style={{ width: '120px' }} />
            <Column field="usuario_id" header="Usuario" body={(rowData) => {
                return rowData.usuario_id || '—';
            }} style={{ width: '150px' }} />
            <Column field="fecha" header="Fecha y Hora" body={fechaBodyTemplate} style={{ width: '200px' }} />
        </DataTable>
    );
};

export default HistorialMovimientos;