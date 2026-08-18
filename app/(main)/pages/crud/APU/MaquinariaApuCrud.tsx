'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    calcularCostoHorarioMaquinaria,
    createMaquinariaApu,
    deleteMaquinariaApu,
    fetchMaquinariaApu,
    MaquinariaApu,
    updateMaquinariaApu
} from '../../../../../Services/BD/apu/maquinariaApuService';

const MaquinariaApuCrud = () => {
    const emptyMaquinaria: MaquinariaApu = {
        clave: '',
        descripcion: '',
        marca_modelo: '',
        valor_adquisicion: 0,
        valor_rescate_pct: 10,
        vida_util_anios: 5,
        horas_uso_anual: 2000,
        tasa_interes_pct: 12,
        tasa_seguros_pct: 4,
        factor_mantenimiento_pct: 60,
        consumo_combustible_litros_hora: 0,
        precio_combustible_litro: 0,
        consumo_lubricantes_pct: 15,
        costo_llantas_hora: 0,
        otros_consumibles_hora: 0,
        status: true
    };

    const [lista, setLista] = useState<MaquinariaApu[]>([]);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
    const [maquinaria, setMaquinaria] = useState<MaquinariaApu>(emptyMaquinaria);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });

    const cargar = async () => {
        setLoading(true);
        try {
            setLista(await fetchMaquinariaApu());
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar Maquinaria', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    const costoCalculado = useMemo(() => calcularCostoHorarioMaquinaria(maquinaria), [maquinaria]);

    const openNew = () => {
        setMaquinaria(emptyMaquinaria);
        setSubmitted(false);
        setDialogVisible(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setDialogVisible(false);
    };

    const editMaquinaria = (row: MaquinariaApu) => {
        setMaquinaria({ ...row });
        setDialogVisible(true);
    };

    const confirmDelete = (row: MaquinariaApu) => {
        setMaquinaria(row);
        setDeleteDialogVisible(true);
    };

    const save = async () => {
        setSubmitted(true);

        if (maquinaria.clave.trim() && maquinaria.descripcion.trim() && maquinaria.valor_adquisicion > 0) {
            setGuardando(true);
            try {
                if (maquinaria.id) {
                    const actualizado = await updateMaquinariaApu(maquinaria);
                    setLista((prev) => prev.map((m) => (m.id === actualizado.id ? actualizado : m)));
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Maquinaria actualizada', life: 3000 });
                } else {
                    const creado = await createMaquinariaApu(maquinaria);
                    setLista((prev) => [...prev, creado]);
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Maquinaria creada', life: 3000 });
                }
                setDialogVisible(false);
                setMaquinaria(emptyMaquinaria);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar la Maquinaria', life: 3000 });
            } finally {
                setGuardando(false);
            }
        }
    };

    const deleteConfirmado = async () => {
        try {
            await deleteMaquinariaApu(maquinaria.id!, maquinaria.id_insumo);
            setLista((prev) => prev.filter((m) => m.id !== maquinaria.id));
            setDeleteDialogVisible(false);
            setMaquinaria(emptyMaquinaria);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Maquinaria eliminada', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar la Maquinaria', life: 3000 });
        }
    };

    const formatMoney = (v: number) => `$ ${v.toFixed(2)}`;

    const costoHoraBodyTemplate = (row: MaquinariaApu) => <Tag value={formatMoney(row.costo_hora_total || 0) + ' / hr'} severity="success" />;

    const statusBodyTemplate = (row: MaquinariaApu) => <Tag value={row.status ? 'Activo' : 'Inactivo'} severity={row.status ? 'success' : 'danger'} />;

    const actionBodyTemplate = (row: MaquinariaApu) => (
        <>
            <Button icon="pi pi-pencil" rounded severity="info" className="mr-2" onClick={() => editMaquinaria(row)} />
            <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDelete(row)} />
        </>
    );

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Costo Horario de Maquinaria e Implementos</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })} placeholder="Buscar..." />
            </span>
        </div>
    );

    const dialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={save} loading={guardando} />
        </>
    );

    const deleteDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={() => setDeleteDialogVisible(false)} />
            <Button label="Eliminar" icon="pi pi-check" text onClick={deleteConfirmado} />
        </>
    );

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={() => <Button label="Nueva Maquinaria" icon="pi pi-plus" severity="info" onClick={openNew} />} right={() => <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={() => dt.current?.exportCSV()} />}></Toolbar>

                    <DataTable
                        ref={dt}
                        value={lista}
                        loading={loading}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[10, 25, 50]}
                        className="datatable-responsive"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No se encontró maquinaria registrada."
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column field="clave" header="Clave" sortable style={{ width: '120px' }}></Column>
                        <Column field="descripcion" header="Descripción" sortable></Column>
                        <Column field="marca_modelo" header="Marca / Modelo" sortable></Column>
                        <Column field="costo_fijo_hora" header="Costo Fijo/hr" sortable body={(r: MaquinariaApu) => formatMoney(r.costo_fijo_hora || 0)} style={{ width: '140px' }}></Column>
                        <Column field="costo_operacion_hora" header="Costo Operación/hr" sortable body={(r: MaquinariaApu) => formatMoney(r.costo_operacion_hora || 0)} style={{ width: '160px' }}></Column>
                        <Column field="costo_hora_total" header="Costo Total/hr" sortable body={costoHoraBodyTemplate} style={{ width: '160px' }}></Column>
                        <Column field="status" header="Estado" sortable body={statusBodyTemplate} style={{ width: '110px' }}></Column>
                        <Column body={actionBodyTemplate} headerStyle={{ minWidth: '9rem' }}></Column>
                    </DataTable>

                    <Dialog visible={dialogVisible} style={{ width: '780px' }} header="Análisis de Costo Horario" modal className="p-fluid" footer={dialogFooter} onHide={hideDialog}>
                        <div className="grid">
                            <div className="col-12 md:col-4">
                                <div className="field">
                                    <label htmlFor="clave">Clave</label>
                                    <InputText id="clave" value={maquinaria.clave} onChange={(e) => setMaquinaria({ ...maquinaria, clave: e.target.value })} className={submitted && !maquinaria.clave ? 'p-invalid' : ''} />
                                </div>
                            </div>
                            <div className="col-12 md:col-8">
                                <div className="field">
                                    <label htmlFor="descripcion">Descripción (máquina o implemento)</label>
                                    <InputText id="descripcion" value={maquinaria.descripcion} onChange={(e) => setMaquinaria({ ...maquinaria, descripcion: e.target.value })} className={submitted && !maquinaria.descripcion ? 'p-invalid' : ''} />
                                </div>
                            </div>
                            <div className="col-12">
                                <div className="field">
                                    <label htmlFor="marca_modelo">Marca / Modelo</label>
                                    <InputText id="marca_modelo" value={maquinaria.marca_modelo} onChange={(e) => setMaquinaria({ ...maquinaria, marca_modelo: e.target.value })} />
                                </div>
                            </div>

                            <div className="col-12">
                                <h6 className="mb-2">Costos Fijos</h6>
                            </div>
                            <div className="col-6 md:col-3">
                                <div className="field">
                                    <label>Valor de Adquisición</label>
                                    <InputNumber value={maquinaria.valor_adquisicion} onValueChange={(e) => setMaquinaria({ ...maquinaria, valor_adquisicion: e.value || 0 })} mode="decimal" minFractionDigits={2} min={0} className={submitted && maquinaria.valor_adquisicion <= 0 ? 'p-invalid' : ''} />
                                </div>
                            </div>
                            <div className="col-6 md:col-3">
                                <div className="field">
                                    <label>Valor de Rescate (%)</label>
                                    <InputNumber value={maquinaria.valor_rescate_pct} onValueChange={(e) => setMaquinaria({ ...maquinaria, valor_rescate_pct: e.value || 0 })} suffix=" %" min={0} max={100} />
                                </div>
                            </div>
                            <div className="col-6 md:col-3">
                                <div className="field">
                                    <label>Vida Útil (años)</label>
                                    <InputNumber value={maquinaria.vida_util_anios} onValueChange={(e) => setMaquinaria({ ...maquinaria, vida_util_anios: e.value || 0 })} min={0} />
                                </div>
                            </div>
                            <div className="col-6 md:col-3">
                                <div className="field">
                                    <label>Horas de Uso Anual</label>
                                    <InputNumber value={maquinaria.horas_uso_anual} onValueChange={(e) => setMaquinaria({ ...maquinaria, horas_uso_anual: e.value || 0 })} min={0} />
                                </div>
                            </div>
                            <div className="col-6 md:col-4">
                                <div className="field">
                                    <label>Tasa de Interés Anual (%)</label>
                                    <InputNumber value={maquinaria.tasa_interes_pct} onValueChange={(e) => setMaquinaria({ ...maquinaria, tasa_interes_pct: e.value || 0 })} suffix=" %" min={0} />
                                </div>
                            </div>
                            <div className="col-6 md:col-4">
                                <div className="field">
                                    <label>Tasa de Seguros Anual (%)</label>
                                    <InputNumber value={maquinaria.tasa_seguros_pct} onValueChange={(e) => setMaquinaria({ ...maquinaria, tasa_seguros_pct: e.value || 0 })} suffix=" %" min={0} />
                                </div>
                            </div>
                            <div className="col-6 md:col-4">
                                <div className="field">
                                    <label>Mantenimiento (% de depreciación)</label>
                                    <InputNumber value={maquinaria.factor_mantenimiento_pct} onValueChange={(e) => setMaquinaria({ ...maquinaria, factor_mantenimiento_pct: e.value || 0 })} suffix=" %" min={0} />
                                </div>
                            </div>

                            <div className="col-12">
                                <h6 className="mb-2">Costos de Operación</h6>
                            </div>
                            <div className="col-6 md:col-3">
                                <div className="field">
                                    <label>Consumo Combustible (lt/hr)</label>
                                    <InputNumber value={maquinaria.consumo_combustible_litros_hora} onValueChange={(e) => setMaquinaria({ ...maquinaria, consumo_combustible_litros_hora: e.value || 0 })} min={0} />
                                </div>
                            </div>
                            <div className="col-6 md:col-3">
                                <div className="field">
                                    <label>Precio Combustible ($/lt)</label>
                                    <InputNumber value={maquinaria.precio_combustible_litro} onValueChange={(e) => setMaquinaria({ ...maquinaria, precio_combustible_litro: e.value || 0 })} mode="decimal" minFractionDigits={2} min={0} />
                                </div>
                            </div>
                            <div className="col-6 md:col-3">
                                <div className="field">
                                    <label>Lubricantes (% del combustible)</label>
                                    <InputNumber value={maquinaria.consumo_lubricantes_pct} onValueChange={(e) => setMaquinaria({ ...maquinaria, consumo_lubricantes_pct: e.value || 0 })} suffix=" %" min={0} />
                                </div>
                            </div>
                            <div className="col-6 md:col-3">
                                <div className="field">
                                    <label>Llantas ($/hr)</label>
                                    <InputNumber value={maquinaria.costo_llantas_hora} onValueChange={(e) => setMaquinaria({ ...maquinaria, costo_llantas_hora: e.value || 0 })} mode="decimal" minFractionDigits={2} min={0} />
                                </div>
                            </div>
                            <div className="col-6 md:col-3">
                                <div className="field">
                                    <label>Otros Consumibles ($/hr)</label>
                                    <InputNumber value={maquinaria.otros_consumibles_hora} onValueChange={(e) => setMaquinaria({ ...maquinaria, otros_consumibles_hora: e.value || 0 })} mode="decimal" minFractionDigits={2} min={0} />
                                </div>
                            </div>

                            <div className="col-12">
                                <div className="surface-100 border-round p-3 mt-2">
                                    <div className="grid">
                                        <div className="col-4 text-center">
                                            <span className="block text-500 text-sm">Costo Fijo / hr</span>
                                            <span className="text-xl font-bold">{formatMoney(costoCalculado.costo_fijo_hora)}</span>
                                        </div>
                                        <div className="col-4 text-center">
                                            <span className="block text-500 text-sm">Costo Operación / hr</span>
                                            <span className="text-xl font-bold">{formatMoney(costoCalculado.costo_operacion_hora)}</span>
                                        </div>
                                        <div className="col-4 text-center">
                                            <span className="block text-500 text-sm">Costo Total / hr</span>
                                            <span className="text-xl font-bold text-primary">{formatMoney(costoCalculado.costo_hora_total)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Dialog>

                    <Dialog visible={deleteDialogVisible} style={{ width: '450px' }} header="Confirmar" modal footer={deleteDialogFooter} onHide={() => setDeleteDialogVisible(false)}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {maquinaria && (
                                <span>
                                    ¿Estás seguro de eliminar <b>{maquinaria.descripcion}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default MaquinariaApuCrud;
