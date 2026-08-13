"use client";

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Chart } from 'primereact/chart';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import * as XLSX from 'xlsx';
import { ChartData, ChartOptions } from 'chart.js';
import { LayoutContext } from '../../../../layout/context/layoutcontext';
import { getEstadisticasMovimientos, EstadisticaProducto, RecomendacionCompra } from '../../../../Services/BD/inventario/inventarioService';

const periodoOptions = [
    { label: 'Últimos 7 días', value: 7 },
    { label: 'Últimos 30 días', value: 30 },
    { label: 'Últimos 60 días', value: 60 },
    { label: 'Últimos 90 días', value: 90 }
];

const severidadPorRecomendacion: Record<RecomendacionCompra, 'success' | 'info' | 'warning' | 'danger'> = {
    'Comprar más': 'success',
    Mantener: 'warning',
    'Comprar menos': 'danger',
    'Sin movimiento': 'info'
};

const EstadisticosInventarioPage = () => {
    const { layoutConfig } = useContext(LayoutContext);
    const [dias, setDias] = useState<number>(30);
    const [estadisticas, setEstadisticas] = useState<EstadisticaProducto[]>([]);
    const [loading, setLoading] = useState(false);
    const [chartOptions, setChartOptions] = useState<ChartOptions>({});

    const cargarEstadisticas = async () => {
        setLoading(true);
        try {
            const data = await getEstadisticasMovimientos(dias);
            setEstadisticas(data);
        } catch (error) {
            console.error('Error al cargar estadísticas de inventario:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarEstadisticas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dias]);

    useEffect(() => {
        const esOscuro = layoutConfig.colorScheme !== 'light';
        const colorTexto = esOscuro ? '#ebedef' : '#495057';
        const colorGrid = esOscuro ? 'rgba(160, 167, 181, .3)' : '#ebedef';

        setChartOptions({
            indexAxis: 'y' as const,
            plugins: {
                legend: { labels: { color: colorTexto } }
            },
            scales: {
                x: { ticks: { color: colorTexto }, grid: { color: colorGrid } },
                y: { ticks: { color: colorTexto }, grid: { color: colorGrid } }
            }
        });
    }, [layoutConfig.colorScheme]);

    const conMovimiento = useMemo(() => estadisticas.filter((e) => e.cantidad_salida > 0), [estadisticas]);
    const top10 = useMemo(() => conMovimiento.slice(0, 10), [conMovimiento]);
    const productoMasMovido = conMovimiento[0] || null;
    const productoMenosMovido = conMovimiento.length > 0 ? conMovimiento[conMovimiento.length - 1] : null;
    const totalUnidadesSalida = useMemo(() => conMovimiento.reduce((sum, e) => sum + e.cantidad_salida, 0), [conMovimiento]);

    const chartData: ChartData = {
        labels: top10.map((e) => e.nombre),
        datasets: [
            {
                label: `Unidades de salida (últimos ${dias} días)`,
                data: top10.map((e) => e.cantidad_salida),
                backgroundColor: '#2f4860'
            }
        ]
    };

    const recomendacionBodyTemplate = (rowData: EstadisticaProducto) => {
        return <Tag severity={severidadPorRecomendacion[rowData.recomendacion]} value={rowData.recomendacion} />;
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
    };

    const generarReporte = () => {
        const filas = estadisticas.map((e) => ({
            Código: e.codigo,
            Producto: e.nombre,
            Categoría: e.categoria || '',
            Unidad: e.unidad,
            [`Cantidad Salida (${dias} días)`]: e.cantidad_salida,
            'N° Movimientos': e.num_movimientos,
            'Costo Total Salida': e.costo_total_salida,
            'Stock Actual': e.stock_actual,
            'Stock Mínimo': e.stock_minimo,
            Recomendación: e.recomendacion
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(filas);
        XLSX.utils.book_append_sheet(wb, ws, 'Estadisticas Inventario');
        XLSX.writeFile(wb, `Reporte_Inventario_${dias}dias_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center gap-3 mb-4">
                        <div>
                            <h5 className="m-0">Estadísticos de Inventario</h5>
                            <p className="m-0 text-500">Qué producto se mueve más y qué producto se mueve menos, para orientar tus compras.</p>
                        </div>
                        <div className="flex gap-2 align-items-center">
                            <Dropdown value={dias} options={periodoOptions} onChange={(e) => setDias(e.value)} style={{ minWidth: '180px' }} />
                            <Button label="Generar Reporte" icon="pi pi-file-excel" severity="success" onClick={generarReporte} disabled={loading || estadisticas.length === 0} />
                        </div>
                    </div>

                    <div className="grid">
                        <div className="col-12 md:col-4">
                            <div className="surface-card border-round p-3 h-full">
                                <span className="block text-500 font-medium mb-2">Unidades de Salida en el Periodo</span>
                                <div className="text-900 font-bold text-2xl">{loading ? <i className="pi pi-spinner pi-spin" /> : totalUnidadesSalida.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="col-12 md:col-4">
                            <div className="surface-card border-round p-3 h-full">
                                <span className="block text-500 font-medium mb-2">Se Mueve Más — Comprar Más</span>
                                <div className="text-900 font-bold text-xl">{loading ? <i className="pi pi-spinner pi-spin" /> : productoMasMovido ? `${productoMasMovido.nombre} (${productoMasMovido.cantidad_salida})` : 'Sin datos'}</div>
                            </div>
                        </div>
                        <div className="col-12 md:col-4">
                            <div className="surface-card border-round p-3 h-full">
                                <span className="block text-500 font-medium mb-2">Se Mueve Menos — Comprar Menos</span>
                                <div className="text-900 font-bold text-xl">{loading ? <i className="pi pi-spinner pi-spin" /> : productoMenosMovido ? `${productoMenosMovido.nombre} (${productoMenosMovido.cantidad_salida})` : 'Sin datos'}</div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4">
                        <h6>Top 10 productos con más salidas</h6>
                        {top10.length > 0 ? (
                            <Chart type="bar" data={chartData} options={chartOptions} style={{ maxHeight: '420px' }} />
                        ) : (
                            <p className="text-500">No hay salidas registradas en este periodo.</p>
                        )}
                    </div>

                    <div className="mt-4">
                        <h6>Detalle por producto</h6>
                        <DataTable
                            value={estadisticas}
                            loading={loading}
                            paginator
                            rows={10}
                            rowsPerPageOptions={[10, 25, 50]}
                            sortField="cantidad_salida"
                            sortOrder={-1}
                            emptyMessage="No hay productos registrados"
                        >
                            <Column field="codigo" header="Código" sortable style={{ width: '120px' }} />
                            <Column field="nombre" header="Producto" sortable style={{ minWidth: '180px' }} />
                            <Column field="categoria" header="Categoría" sortable style={{ width: '140px' }} />
                            <Column field="cantidad_salida" header="Cant. Salida" sortable style={{ width: '120px' }} body={(r: EstadisticaProducto) => `${r.cantidad_salida} ${r.unidad}`} />
                            <Column field="costo_total_salida" header="Costo Total Salida" sortable style={{ width: '160px' }} body={(r: EstadisticaProducto) => formatCurrency(r.costo_total_salida)} />
                            <Column field="stock_actual" header="Stock Actual" sortable style={{ width: '120px' }} />
                            <Column field="recomendacion" header="Recomendación" sortable body={recomendacionBodyTemplate} style={{ width: '160px' }} />
                        </DataTable>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EstadisticosInventarioPage;
