'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { exportarMatrizApuExcelDetallado, fetchMatrizApu } from '../../../../../Services/BD/apu/matrizApuService';
import { TarjetaApu } from '../../../../../Services/BD/apu/tarjetasApuService';
import { TarjetaApuDetalleModal } from './TarjetaApuDetalleModal';

const formatMoney = (v = 0) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const formatPct = (v = 0) => `${v.toFixed(1)} %`;

const MatrizApuReport = () => {
    const [tarjetas, setTarjetas] = useState<TarjetaApu[]>([]);
    const [loading, setLoading] = useState(false);
    const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
    const [exportando, setExportando] = useState(false);
    const [idTarjetaDetalle, setIdTarjetaDetalle] = useState<number | null>(null);
    const [detalleVisible, setDetalleVisible] = useState(false);
    const toast = useRef<Toast>(null);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });

    const cargar = async () => {
        setLoading(true);
        try {
            setTarjetas(await fetchMatrizApu());
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar la Matriz de Precios Unitarios', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    const categoriasDisponibles = useMemo(() => {
        const nombres = Array.from(new Set(tarjetas.map((t) => t.categoria_nombre).filter((c): c is string => !!c)));
        return nombres.map((n) => ({ label: n, value: n }));
    }, [tarjetas]);

    const tarjetasFiltradas = useMemo(() => (categoriaFiltro ? tarjetas.filter((t) => t.categoria_nombre === categoriaFiltro) : tarjetas), [tarjetas, categoriaFiltro]);

    const verDetalle = (row: TarjetaApu) => {
        setIdTarjetaDetalle(row.id!);
        setDetalleVisible(true);
    };

    const exportar = async () => {
        setExportando(true);
        try {
            await exportarMatrizApuExcelDetallado(tarjetasFiltradas);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al exportar la Matriz a Excel', life: 3000 });
        } finally {
            setExportando(false);
        }
    };

    const detalleBodyTemplate = (row: TarjetaApu) => <Button icon="pi pi-eye" label="Detalle" text onClick={() => verDetalle(row)} />;

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center gap-3">
            <div>
                <h5 className="m-0">Matriz de Precios Unitarios</h5>
                <p className="m-0 text-500">Comparativo de todos los conceptos con tarjeta calculada.</p>
            </div>
            <div className="flex gap-2 align-items-center">
                <Dropdown value={categoriaFiltro} options={categoriasDisponibles} onChange={(e) => setCategoriaFiltro(e.value)} placeholder="Todas las categorías" showClear style={{ minWidth: '200px' }} />
                <span className="p-input-icon-left">
                    <i className="pi pi-search" />
                    <InputText type="search" onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })} placeholder="Buscar..." />
                </span>
                <Button label="Exportar a Excel" icon="pi pi-file-excel" severity="success" onClick={exportar} loading={exportando} disabled={tarjetasFiltradas.length === 0} />
            </div>
        </div>
    );

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />

                    <DataTable
                        value={tarjetasFiltradas}
                        loading={loading}
                        dataKey="id"
                        paginator
                        rows={15}
                        rowsPerPageOptions={[15, 30, 50]}
                        className="datatable-responsive"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No hay tarjetas capturadas todavía."
                        header={header}
                        responsiveLayout="scroll"
                        sortField="concepto_clave"
                        sortOrder={1}
                    >
                        <Column field="concepto_clave" header="Clave" sortable style={{ width: '110px' }}></Column>
                        <Column field="concepto_descripcion" header="Concepto" sortable></Column>
                        <Column field="concepto_unidad" header="Unidad" sortable style={{ width: '90px' }}></Column>
                        <Column field="categoria_nombre" header="Categoría" sortable style={{ width: '150px' }}></Column>
                        <Column field="costo_materiales" header="Materiales" sortable body={(r: TarjetaApu) => formatMoney(r.costo_materiales)} style={{ width: '130px' }}></Column>
                        <Column field="costo_mano_obra" header="Mano de Obra" sortable body={(r: TarjetaApu) => formatMoney(r.costo_mano_obra)} style={{ width: '130px' }}></Column>
                        <Column field="costo_maquinaria" header="Maquinaria" sortable body={(r: TarjetaApu) => formatMoney(r.costo_maquinaria)} style={{ width: '130px' }}></Column>
                        <Column field="pct_material" header="% Material" sortable body={(r: TarjetaApu) => formatPct(r.pct_material)} style={{ width: '110px' }}></Column>
                        <Column field="pct_mano_obra" header="% M.O." sortable body={(r: TarjetaApu) => formatPct(r.pct_mano_obra)} style={{ width: '100px' }}></Column>
                        <Column field="pct_maquinaria" header="% Maq." sortable body={(r: TarjetaApu) => formatPct(r.pct_maquinaria)} style={{ width: '100px' }}></Column>
                        <Column field="precio_unitario" header="Precio Unitario" sortable body={(r: TarjetaApu) => formatMoney(r.precio_unitario)} style={{ width: '150px' }}></Column>
                        <Column body={detalleBodyTemplate} headerStyle={{ minWidth: '9rem' }}></Column>
                    </DataTable>

                    <TarjetaApuDetalleModal visible={detalleVisible} idTarjeta={idTarjetaDetalle} onHide={() => setDetalleVisible(false)} />
                </div>
            </div>
        </div>
    );
};

export default MatrizApuReport;
