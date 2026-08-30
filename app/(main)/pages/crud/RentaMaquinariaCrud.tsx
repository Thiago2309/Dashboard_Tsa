'use client';

import React, { useEffect, useRef, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { Checkbox } from 'primereact/checkbox';
import { Tag } from 'primereact/tag';
import { DataTableFilterMeta } from 'primereact/datatable';
import * as XLSX from 'xlsx';
import {
    fetchRentaMaquinaria,
    createRentaMaquinaria,
    updateRentaMaquinaria,
    deleteRentaMaquinaria,
    RentaMaquinaria
} from '../../../../Services/BD/inventario/maquinaria/rentaMaquinariaService';
import { fetchMaquinarias, Maquinaria } from '../../../../Services/BD/inventario/maquinaria/maquinariaService';
import { fetchClientesNotes } from '../../../../Services/BD/clientesService';
import { fetchOperadores, Operador } from '../../../../Services/BD/operadoresService';
import { fetchInvitados, Invitado } from '../../../../Services/BD/invitadosService';

const parseFechaISO = (fecha: string | null): Date | null => {
    if (!fecha) return null;
    const [year, month, day] = fecha.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
};

const formatearFechaISO = (fecha: Date | null): string => {
    if (!fecha) return '';
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
};

const formatearMoneda = (valor: number | null | undefined): string =>
    valor != null ? valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : '-';

const RentaMaquinariaCrud = () => {
    const emptyRenta: RentaMaquinaria = {
        estimacion: '',
        fecha: '',
        folio: '',
        id_cliente: null,
        id_invitado: null,
        obra: '',
        id_maquina: null,
        maquina_manual: '',
        id_operador: null,
        operador_manual: '',
        hrs: null,
        precio: null,
        total: null,
        precio_invitado: null,
        total_invitado: null,
        observaciones: ''
    };

    const [rentas, setRentas] = useState<RentaMaquinaria[]>([]);
    const [maquinarias, setMaquinarias] = useState<Maquinaria[]>([]);
    const [clientes, setClientes] = useState<{ id: number; empresa: string }[]>([]);
    const [invitados, setInvitados] = useState<Invitado[]>([]);
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [loading, setLoading] = useState(false);

    const [rentaDialog, setRentaDialog] = useState(false);
    const [deleteRentaDialog, setDeleteRentaDialog] = useState(false);
    const [deleteRentasDialog, setDeleteRentasDialog] = useState(false);
    const [renta, setRenta] = useState<RentaMaquinaria>(emptyRenta);
    const [esInvitado, setEsInvitado] = useState(false);
    const [selectedRentas, setSelectedRentas] = useState<RentaMaquinaria[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    const cargarRentas = async () => {
        setLoading(true);
        try {
            const data = await fetchRentaMaquinaria();
            setRentas(data);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarRentas();
        fetchMaquinarias().then(setMaquinarias);
        fetchClientesNotes().then(setClientes);
        fetchInvitados().then(setInvitados);
        fetchOperadores().then(setOperadores);
    }, []);

    const openNew = () => {
        setRenta(emptyRenta);
        setEsInvitado(false);
        setSubmitted(false);
        setRentaDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setRentaDialog(false);
    };

    const hideDeleteRentaDialog = () => setDeleteRentaDialog(false);
    const hideDeleteRentasDialog = () => setDeleteRentasDialog(false);

    const saveRenta = async () => {
        setSubmitted(true);

        const maquinaValida = esInvitado ? !!renta.maquina_manual?.trim() : !!renta.id_maquina;
        const operadorValido = esInvitado ? !!renta.operador_manual?.trim() : !!renta.id_operador;

        if (!renta.fecha || !maquinaValida || !operadorValido || (esInvitado && !renta.id_invitado)) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: esInvitado ? 'Fecha, Invitado, Máquina y Operador son requeridos' : 'Fecha, Máquina y Operador son requeridos',
                life: 3000
            });
            return;
        }

        try {
            const total = (renta.hrs || 0) * (renta.precio || 0);
            const totalInvitado = esInvitado ? (renta.hrs || 0) * (renta.precio_invitado || 0) : null;
            const rentaLimpia = {
                estimacion: renta.estimacion || null,
                fecha: renta.fecha,
                folio: renta.folio || null,
                id_cliente: renta.id_cliente,
                id_invitado: esInvitado ? renta.id_invitado : null,
                obra: renta.obra || null,
                id_maquina: esInvitado ? null : renta.id_maquina,
                maquina_manual: esInvitado ? (renta.maquina_manual || null) : null,
                id_operador: esInvitado ? null : renta.id_operador,
                operador_manual: esInvitado ? (renta.operador_manual || null) : null,
                hrs: renta.hrs,
                precio: renta.precio,
                total,
                precio_invitado: esInvitado ? renta.precio_invitado : null,
                total_invitado: totalInvitado,
                observaciones: renta.observaciones || null
            };

            if (renta.id) {
                await updateRentaMaquinaria(renta.id, rentaLimpia);
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Renta actualizada', life: 3000 });
            } else {
                await createRentaMaquinaria(rentaLimpia);
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Renta creada', life: 3000 });
            }

            setRentaDialog(false);
            setRenta(emptyRenta);
            cargarRentas();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const editRenta = (rentaFila: RentaMaquinaria) => {
        setRenta({ ...rentaFila });
        setEsInvitado(!!rentaFila.id_invitado);
        setRentaDialog(true);
    };

    const confirmDeleteRenta = (rentaFila: RentaMaquinaria) => {
        setRenta(rentaFila);
        setDeleteRentaDialog(true);
    };

    const deleteRentaConfirmada = async () => {
        try {
            await deleteRentaMaquinaria(renta.id!);
            setRentas(rentas.filter(r => r.id !== renta.id));
            setDeleteRentaDialog(false);
            setRenta(emptyRenta);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Renta eliminada', life: 3000 });
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const confirmDeleteSelected = () => {
        if (selectedRentas.length === 0) {
            toast.current?.show({ severity: 'warn', summary: 'Advertencia', detail: 'Seleccione al menos una renta', life: 3000 });
            return;
        }
        setDeleteRentasDialog(true);
    };

    const deleteSelectedRentas = async () => {
        try {
            await Promise.all(selectedRentas.map(r => deleteRentaMaquinaria(r.id!)));
            setRentas(rentas.filter(r => !selectedRentas.includes(r)));
            setDeleteRentasDialog(false);
            setSelectedRentas([]);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Rentas eliminadas', life: 3000 });
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        }
    };

    const exportarExcel = () => {
        const filas = rentas.map(r => ({
            ID: r.id,
            Estimación: r.estimacion || '',
            Fecha: r.fecha,
            Folio: r.folio || '',
            Cliente: r.cliente_nombre || '',
            Invitado: r.invitado_nombre || '',
            Obra: r.obra || '',
            Máquina: r.maquina_nombre || '',
            Operador: r.operador_nombre || '',
            Hrs: r.hrs ?? '',
            'Precio Cliente': r.precio ?? '',
            'Total Cliente': r.total ?? '',
            'Precio Invitado': r.precio_invitado ?? '',
            'Total Invitado': r.total_invitado ?? '',
            Observaciones: r.observaciones || ''
        }));
        const ws = XLSX.utils.json_to_sheet(filas);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Renta Maquinaria');
        XLSX.writeFile(wb, `Renta_Maquinaria_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const textBodyTemplate = (value: string | null | undefined) => <span>{value && value.toString().trim() !== '' ? value : '-'}</span>;

    const fechaBodyTemplate = (rowData: RentaMaquinaria) => <span>{rowData.fecha || '-'}</span>;

    const hrsBodyTemplate = (rowData: RentaMaquinaria) => <span>{rowData.hrs != null ? rowData.hrs.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '-'}</span>;

    const precioBodyTemplate = (rowData: RentaMaquinaria) => <span>{formatearMoneda(rowData.precio)}</span>;

    const totalBodyTemplate = (rowData: RentaMaquinaria) => <span>{formatearMoneda(rowData.total)}</span>;

    const totalInvitadoBodyTemplate = (rowData: RentaMaquinaria) => <span>{formatearMoneda(rowData.total_invitado)}</span>;

    const invitadoBodyTemplate = (rowData: RentaMaquinaria) =>
        rowData.invitado_nombre ? (
            <div className="flex align-items-center gap-2">
                <span>{rowData.invitado_nombre}</span>
                <Tag value="Invitado" severity="warning" />
            </div>
        ) : (
            <span>-</span>
        );

    const actionBodyTemplate = (rowData: RentaMaquinaria) => (
        <div className="flex gap-2">
            <Button icon="pi pi-pencil" rounded severity="info" onClick={() => editRenta(rowData)} tooltip="Editar" />
            <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteRenta(rowData)} tooltip="Eliminar" />
        </div>
    );

    const leftToolbarTemplate = () => (
        <div className="my-2 flex gap-2">
            <Button label="Nueva Renta" icon="pi pi-plus" severity="info" onClick={openNew} />
            <Button label="Eliminar" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} disabled={!selectedRentas || selectedRentas.length === 0} />
        </div>
    );

    const rightToolbarTemplate = () => <Button label="Exportar a Excel" icon="pi pi-file-excel" severity="help" onClick={exportarExcel} />;

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Renta de Maquinaria</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })} placeholder="Buscar..." />
            </span>
        </div>
    );

    const totalCalculado = (renta.hrs || 0) * (renta.precio || 0);
    const totalInvitadoCalculado = (renta.hrs || 0) * (renta.precio_invitado || 0);

    const rentaDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveRenta} />
        </>
    );

    const deleteRentaDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteRentaDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteRentaConfirmada} />
        </>
    );

    const deleteRentasDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteRentasDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteSelectedRentas} />
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
                        value={rentas}
                        selection={selectedRentas}
                        onSelectionChange={(e) => setSelectedRentas(e.value || [])}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        loading={loading}
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No se encontraron rentas de maquinaria"
                        header={header}
                        responsiveLayout="scroll"
                        sortField="fecha"
                        sortOrder={-1}
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} exportable={false} />
                        <Column field="id" header="ID" sortable style={{ width: '70px' }} />
                        <Column field="estimacion" header="Estimación" body={(r) => textBodyTemplate(r.estimacion)} sortable style={{ width: '120px' }} />
                        <Column field="fecha" header="Fecha" body={fechaBodyTemplate} sortable style={{ width: '110px' }} />
                        <Column field="folio" header="Folio" body={(r) => textBodyTemplate(r.folio)} sortable style={{ width: '110px' }} />
                        <Column field="cliente_nombre" header="Cliente" body={(r) => textBodyTemplate(r.cliente_nombre)} sortable style={{ minWidth: '150px' }} />
                        <Column field="invitado_nombre" header="Invitado" body={invitadoBodyTemplate} sortable style={{ minWidth: '150px' }} />
                        <Column field="obra" header="Obra" body={(r) => textBodyTemplate(r.obra)} sortable style={{ minWidth: '150px' }} />
                        <Column field="maquina_nombre" header="Máquina" body={(r) => textBodyTemplate(r.maquina_nombre)} sortable style={{ minWidth: '150px' }} />
                        <Column field="operador_nombre" header="Operador" body={(r) => textBodyTemplate(r.operador_nombre)} sortable style={{ minWidth: '150px' }} />
                        <Column field="hrs" header="Hrs" body={hrsBodyTemplate} sortable style={{ width: '100px' }} />
                        <Column field="precio" header="Precio Cliente" body={precioBodyTemplate} sortable style={{ width: '140px' }} />
                        <Column field="total" header="Total Cliente" body={totalBodyTemplate} sortable style={{ width: '140px' }} />
                        <Column field="precio_invitado" header="Precio Invitado" body={(r) => <span>{formatearMoneda(r.precio_invitado)}</span>} sortable style={{ width: '140px' }} />
                        <Column field="total_invitado" header="Total Invitado" body={totalInvitadoBodyTemplate} sortable style={{ width: '140px' }} />
                        <Column field="observaciones" header="Observaciones" body={(r) => textBodyTemplate(r.observaciones)} style={{ minWidth: '180px' }} />
                        <Column header="Acciones" body={actionBodyTemplate} style={{ width: '120px' }} exportable={false} />
                    </DataTable>

                    <Dialog visible={rentaDialog} style={{ width: '650px' }} header={renta.id ? 'Editar Renta de Maquinaria' : 'Nueva Renta de Maquinaria'} modal className="p-fluid" footer={rentaDialogFooter} onHide={hideDialog}>
                        <div className="grid">
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="fecha">Fecha <span style={{ color: 'red' }}>*</span></label>
                                    <Calendar
                                        id="fecha"
                                        value={parseFechaISO(renta.fecha)}
                                        onChange={(e) => setRenta({ ...renta, fecha: formatearFechaISO(e.value as Date) })}
                                        dateFormat="yy-mm-dd"
                                        showIcon
                                        className={submitted && !renta.fecha ? 'p-invalid' : ''}
                                    />
                                    {submitted && !renta.fecha && <small className="p-error">Requerido</small>}
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="estimacion">Estimación</label>
                                    <InputText id="estimacion" value={renta.estimacion || ''} onChange={(e) => setRenta({ ...renta, estimacion: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="grid">
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="folio">Folio</label>
                                    <InputText id="folio" value={renta.folio || ''} onChange={(e) => setRenta({ ...renta, folio: e.target.value })} />
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="obra">Obra</label>
                                    <InputText id="obra" value={renta.obra || ''} onChange={(e) => setRenta({ ...renta, obra: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <div className="field-checkbox mb-3">
                            <Checkbox
                                inputId="esInvitado"
                                checked={esInvitado}
                                onChange={(e) => {
                                    const nuevoEsInvitado = !!e.checked;
                                    setEsInvitado(nuevoEsInvitado);
                                    // El Cliente se conserva siempre (es a quien se le cobra). Solo se limpian
                                    // los campos propios del modo invitado/catálogo al cambiar de modo.
                                    setRenta({
                                        ...renta,
                                        id_invitado: nuevoEsInvitado ? renta.id_invitado : null,
                                        id_maquina: nuevoEsInvitado ? null : renta.id_maquina,
                                        maquina_manual: nuevoEsInvitado ? renta.maquina_manual : '',
                                        id_operador: nuevoEsInvitado ? null : renta.id_operador,
                                        operador_manual: nuevoEsInvitado ? renta.operador_manual : '',
                                        precio_invitado: nuevoEsInvitado ? renta.precio_invitado : null
                                    });
                                }}
                            />
                            <label htmlFor="esInvitado" className="ml-2">Se usó equipo de un invitado (hay que pagarle aparte)</label>
                        </div>

                        <div className="field">
                            <label htmlFor="id_cliente">Cliente <small className="text-500">(a quien se le cobra)</small></label>
                            <Dropdown
                                id="id_cliente"
                                value={renta.id_cliente}
                                options={clientes.map(c => ({ label: c.empresa, value: c.id }))}
                                onChange={(e) => setRenta({ ...renta, id_cliente: e.value })}
                                placeholder="Selecciona un cliente"
                                showClear
                                filter
                                className="w-full"
                            />
                        </div>

                        {esInvitado && (
                            <div className="field">
                                <label htmlFor="id_invitado">Invitado <small className="text-500">(a quien se le paga)</small> <span style={{ color: 'red' }}>*</span></label>
                                <Dropdown
                                    id="id_invitado"
                                    value={renta.id_invitado}
                                    options={invitados.map(i => ({ label: i.empresa, value: i.id }))}
                                    onChange={(e) => setRenta({ ...renta, id_invitado: e.value })}
                                    placeholder="Selecciona un invitado"
                                    filter
                                    className={`w-full ${submitted && !renta.id_invitado ? 'p-invalid' : ''}`}
                                />
                                {submitted && !renta.id_invitado && <small className="p-error">Requerido</small>}
                            </div>
                        )}

                        <div className="grid">
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="id_maquina">Máquina <span style={{ color: 'red' }}>*</span></label>
                                    {esInvitado ? (
                                        <>
                                            <InputText
                                                id="maquina_manual"
                                                value={renta.maquina_manual || ''}
                                                onChange={(e) => setRenta({ ...renta, maquina_manual: e.target.value })}
                                                placeholder="Escribe el nombre/tipo de máquina del invitado"
                                                className={`w-full ${submitted && !renta.maquina_manual?.trim() ? 'p-invalid' : ''}`}
                                            />
                                            <small className="text-500">Se escribe a mano: no se guarda en el catálogo de maquinaria propio.</small>
                                            {submitted && !renta.maquina_manual?.trim() && <small className="p-error block">Requerido</small>}
                                        </>
                                    ) : (
                                        <>
                                            <Dropdown
                                                id="id_maquina"
                                                value={renta.id_maquina}
                                                options={maquinarias.map(m => ({ label: `${m.eco} - ${m.equipo}`, value: m.id }))}
                                                onChange={(e) => {
                                                    const maquinaSeleccionada = maquinarias.find(m => m.id === e.value);
                                                    setRenta({
                                                        ...renta,
                                                        id_maquina: e.value,
                                                        precio: maquinaSeleccionada?.precio_hrs ?? renta.precio
                                                    });
                                                }}
                                                placeholder="Selecciona una máquina"
                                                filter
                                                className={`w-full ${submitted && !renta.id_maquina ? 'p-invalid' : ''}`}
                                            />
                                            {submitted && !renta.id_maquina && <small className="p-error">Requerido</small>}
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="id_operador">Operador <span style={{ color: 'red' }}>*</span></label>
                                    {esInvitado ? (
                                        <>
                                            <InputText
                                                id="operador_manual"
                                                value={renta.operador_manual || ''}
                                                onChange={(e) => setRenta({ ...renta, operador_manual: e.target.value })}
                                                placeholder="Escribe el nombre del operador del invitado"
                                                className={`w-full ${submitted && !renta.operador_manual?.trim() ? 'p-invalid' : ''}`}
                                            />
                                            <small className="text-500">Se escribe a mano: no se guarda en el catálogo de operadores propio.</small>
                                            {submitted && !renta.operador_manual?.trim() && <small className="p-error block">Requerido</small>}
                                        </>
                                    ) : (
                                        <>
                                            <Dropdown
                                                id="id_operador"
                                                value={renta.id_operador}
                                                options={operadores.map(o => ({ label: o.nombre, value: o.id }))}
                                                onChange={(e) => setRenta({ ...renta, id_operador: e.value })}
                                                placeholder="Selecciona un operador"
                                                filter
                                                className={`w-full ${submitted && !renta.id_operador ? 'p-invalid' : ''}`}
                                            />
                                            {submitted && !renta.id_operador && <small className="p-error">Requerido</small>}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid">
                            <div className={esInvitado ? 'col-12' : 'col-4'}>
                                <div className="field">
                                    <label htmlFor="hrs">Hrs</label>
                                    <InputNumber id="hrs" value={renta.hrs} onValueChange={(e) => setRenta({ ...renta, hrs: e.value ?? null })} min={0} minFractionDigits={0} maxFractionDigits={2} className={esInvitado ? '' : 'w-full'} style={esInvitado ? { width: '150px' } : undefined} />
                                </div>
                            </div>
                        </div>

                        {esInvitado ? (
                            <div className="grid">
                                <div className="col-6">
                                    <div className="p-2 border-round surface-100">
                                        <div className="font-medium mb-2">Al cliente (Cuentas por Cobrar)</div>
                                        <div className="field">
                                            <label htmlFor="precio">Precio Cliente</label>
                                            <InputNumber id="precio" value={renta.precio} onValueChange={(e) => setRenta({ ...renta, precio: e.value ?? null })} mode="currency" currency="MXN" locale="es-MX" min={0} className="w-full" />
                                        </div>
                                        <div className="field mb-0">
                                            <label htmlFor="total">Total Cliente</label>
                                            <InputNumber id="total" value={totalCalculado} mode="currency" currency="MXN" locale="es-MX" className="w-full" disabled />
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="p-2 border-round surface-100">
                                        <div className="font-medium mb-2">Al invitado (Cuentas por Pagar)</div>
                                        <div className="field">
                                            <label htmlFor="precio_invitado">Precio Invitado</label>
                                            <InputNumber id="precio_invitado" value={renta.precio_invitado} onValueChange={(e) => setRenta({ ...renta, precio_invitado: e.value ?? null })} mode="currency" currency="MXN" locale="es-MX" min={0} className="w-full" />
                                        </div>
                                        <div className="field mb-0">
                                            <label htmlFor="total_invitado">Total Invitado</label>
                                            <InputNumber id="total_invitado" value={totalInvitadoCalculado} mode="currency" currency="MXN" locale="es-MX" className="w-full" disabled />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid">
                                <div className="col-6">
                                    <div className="field">
                                        <label htmlFor="precio">Precio</label>
                                        <InputNumber id="precio" value={renta.precio} onValueChange={(e) => setRenta({ ...renta, precio: e.value ?? null })} mode="currency" currency="MXN" locale="es-MX" min={0} className="w-full" />
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="field">
                                        <label htmlFor="total">Total</label>
                                        <InputNumber id="total" value={totalCalculado} mode="currency" currency="MXN" locale="es-MX" className="w-full" disabled />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="field">
                            <label htmlFor="observaciones">Observaciones</label>
                            <InputTextarea id="observaciones" value={renta.observaciones || ''} onChange={(e) => setRenta({ ...renta, observaciones: e.target.value })} rows={3} />
                        </div>
                    </Dialog>

                    <Dialog visible={deleteRentaDialog} style={{ width: '450px' }} header="Confirmar Eliminación" modal footer={deleteRentaDialogFooter} onHide={hideDeleteRentaDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            <span>¿Está seguro de eliminar esta renta de maquinaria?</span>
                        </div>
                    </Dialog>

                    <Dialog visible={deleteRentasDialog} style={{ width: '450px' }} header="Confirmar Eliminación Múltiple" modal footer={deleteRentasDialogFooter} onHide={hideDeleteRentasDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: '#f44336' }} />
                            <span>¿Eliminar {selectedRentas.length} renta(s)?</span>
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default RentaMaquinariaCrud;
