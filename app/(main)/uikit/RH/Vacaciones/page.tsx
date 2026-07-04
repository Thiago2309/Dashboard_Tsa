// app/(main)/pages/crud/Vacaciones/VacacionesCrud.tsx
'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import React, { useEffect, useRef, useState } from 'react';
import { 
    fetchOperadoresConVacaciones,
    createPeriodoVacaciones,
    updatePeriodoVacaciones,
    deletePeriodoVacaciones,
    fetchOperadores,
    OperadorVacaciones,
    PeriodoVacaciones
} from '../../../../../Services/BD/Vacaciones/vacacionesService';

const VacacionesCrud = () => {
    const emptyPeriodo: PeriodoVacaciones = {
        id_operador: null,
        fecha_inicio: '',
        fecha_fin: '',
        dias_otorgados: 12,
        dias_disfrutados: 0,
        dias_pendientes: 12
    };

    const [operadores, setOperadores] = useState<OperadorVacaciones[]>([]);
    const [periodoDialog, setPeriodoDialog] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [periodo, setPeriodo] = useState<PeriodoVacaciones>(emptyPeriodo);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    // Opciones para dropdown
    const [operadoresList, setOperadoresList] = useState<{ id: number; nombre: string; }[]>([]);

    // Cargar datos iniciales
    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [data, operadoresData] = await Promise.all([
                fetchOperadoresConVacaciones(),
                fetchOperadores()
            ]);
            setOperadores(data);
            setOperadoresList(operadoresData);
        } catch (error) {
            console.error('Error cargando datos:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al cargar los datos',
                life: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    const openNew = () => {
        setPeriodo({ ...emptyPeriodo, dias_otorgados: 12, dias_pendientes: 12 });
        setSubmitted(false);
        setPeriodoDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setPeriodoDialog(false);
    };

    const savePeriodo = async () => {
        setSubmitted(true);

        if (!periodo.id_operador || !periodo.fecha_inicio || !periodo.fecha_fin || !periodo.dias_otorgados) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Todos los campos obligatorios deben estar llenos',
                life: 3000
            });
            return;
        }

        try {
            setLoading(true);
            
            // Calcular días pendientes
            const dias_pendientes = periodo.dias_otorgados - (periodo.dias_disfrutados || 0);
            
            const periodoData = {
                ...periodo,
                dias_pendientes: dias_pendientes
            };

            if (periodo.id) {
                await updatePeriodoVacaciones(periodoData);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: 'Periodo actualizado correctamente',
                    life: 3000
                });
            } else {
                await createPeriodoVacaciones(periodoData);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: 'Periodo creado correctamente',
                    life: 3000
                });
            }
            setPeriodoDialog(false);
            cargarDatos();
        } catch (error) {
            console.error('Error guardando periodo:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al guardar el periodo',
                life: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    const deletePeriodoConfirmado = async () => {
        try {
            setLoading(true);
            await deletePeriodoVacaciones(periodo.id!);
            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Periodo eliminado correctamente',
                life: 3000
            });
            setDeleteDialog(false);
            cargarDatos();
        } catch (error) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al eliminar el periodo',
                life: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    // Templates para la tabla principal
    const nombreBodyTemplate = (rowData: OperadorVacaciones) => {
        return `${rowData.nombre}`;
    };

    const diasOtorgadosBodyTemplate = (rowData: OperadorVacaciones) => {
        return (
            <span className="font-bold text-blue-600">
                {rowData.total_dias_otorgados}
            </span>
        );
    };

    const diasDisfrutadosBodyTemplate = (rowData: OperadorVacaciones) => {
        return (
            <span className="font-bold text-orange-600">
                {rowData.total_dias_disfrutados}
            </span>
        );
    };

    const diasPendientesBodyTemplate = (rowData: OperadorVacaciones) => {
        return (
            <span className="font-bold text-green-600">
                {rowData.total_dias_pendientes}
            </span>
        );
    };

    const antiguedadBodyTemplate = (rowData: OperadorVacaciones) => {
        if (!rowData.fecha_contratacion) return '-';
        const fechaContratacion = new Date(rowData.fecha_contratacion);
        const hoy = new Date();
        const años = hoy.getFullYear() - fechaContratacion.getFullYear();
        const meses = hoy.getMonth() - fechaContratacion.getMonth();
        return `${años} años ${meses} meses`;
    };

    const actionBodyTemplate = (rowData: OperadorVacaciones) => {
        return (
            <div className="flex gap-1">
                <Button
                    icon="pi pi-plus"
                    rounded
                    severity="info"
                    size="small"
                    tooltip="Agregar Periodo"
                    onClick={() => {
                        setPeriodo({
                            ...emptyPeriodo,
                            id_operador: rowData.id,
                            dias_otorgados: 12,
                            dias_pendientes: 12
                        });
                        setSubmitted(false);
                        setPeriodoDialog(true);
                    }}
                />
                <Button
                    icon="pi pi-eye"
                    rounded
                    severity="secondary"
                    size="small"
                    tooltip="Ver Periodos"
                    onClick={() => {
                        // Aquí podrías mostrar los periodos del operador
                        toast.current?.show({
                            severity: 'info',
                            summary: 'Info',
                            detail: `Ver periodos de ${rowData.nombre}`,
                            life: 3000
                        });
                    }}
                />
            </div>
        );
    };

    // Template para periodos (expansión)
    const rowExpansionTemplate = (data: OperadorVacaciones) => {
        return (
            <div className="p-3">
                <h5>Periodos de Vacaciones - {data.nombre}</h5>
                <DataTable value={data.periodos} className="p-datatable-sm">
                    <Column field="fecha_inicio" header="Fecha Inicio" body={(rowData) => {
                        const date = new Date(rowData.fecha_inicio);
                        return `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
                    }} />
                    <Column field="fecha_fin" header="Fecha Fin" body={(rowData) => {
                        const date = new Date(rowData.fecha_fin);
                        return `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
                    }} />
                    <Column field="dias_otorgados" header="Días Otorgados" />
                    <Column field="dias_disfrutados" header="Días Disfrutados" />
                    <Column field="dias_pendientes" header="Días Pendientes" />
                    <Column 
                        header="Acciones" 
                        body={(rowData: PeriodoVacaciones) => (
                            <div className="flex gap-1">
                                <Button
                                    icon="pi pi-pencil"
                                    rounded
                                    severity="info"
                                    size="small"
                                    onClick={() => {
                                        setPeriodo(rowData);
                                        setSubmitted(false);
                                        setPeriodoDialog(true);
                                    }}
                                />
                                <Button
                                    icon="pi pi-trash"
                                    rounded
                                    severity="danger"
                                    size="small"
                                    onClick={() => {
                                        setPeriodo(rowData);
                                        setDeleteDialog(true);
                                    }}
                                />
                            </div>
                        )}
                    />
                </DataTable>
            </div>
        );
    };

    const leftToolbarTemplate = () => {
        return (
            <div className="my-2">
                <Button 
                    label="Nuevo Periodo" 
                    icon="pi pi-plus" 
                    severity="info" 
                    className="mr-2" 
                    onClick={openNew} 
                />
                <Button 
                    label="Recargar" 
                    icon="pi pi-refresh" 
                    severity="secondary" 
                    onClick={cargarDatos}
                    loading={loading}
                />
            </div>
        );
    };

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} />

                    <DataTable
                        ref={dt}
                        value={operadores}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        className="datatable-responsive"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} Empleados"
                        emptyMessage="No se encontraron Empleados."
                        responsiveLayout="scroll"
                        loading={loading}
                        rowExpansionTemplate={rowExpansionTemplate}
                    >
                        <Column expander headerStyle={{ width: '3rem' }} />
                        <Column field="nombre" header="Empleado" sortable body={nombreBodyTemplate} />
                        <Column field="antiguedad" header="Antigüedad" sortable body={antiguedadBodyTemplate} />
                        <Column field="total_dias_otorgados" header="Días Otorgados" sortable body={diasOtorgadosBodyTemplate} />
                        <Column field="total_dias_disfrutados" header="Días Disfrutados" sortable body={diasDisfrutadosBodyTemplate} />
                        <Column field="total_dias_pendientes" header="Días Pendientes" sortable body={diasPendientesBodyTemplate} />
                        <Column header="Acciones" body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }} />
                    </DataTable>

                    {/* Dialog para crear/editar periodo */}
                    <Dialog
                        visible={periodoDialog}
                        style={{ width: '500px' }}
                        header={periodo.id ? 'Editar Periodo' : 'Nuevo Periodo'}
                        modal
                        className="p-fluid"
                        footer={
                            <>
                                <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
                                <Button label="Guardar" icon="pi pi-check" text onClick={savePeriodo} loading={loading} />
                            </>
                        }
                        onHide={hideDialog}
                    >
                        <div className="field">
                            <label htmlFor="id_operador">Operador *</label>
                            <Dropdown
                                id="id_operador"
                                value={periodo.id_operador}
                                options={operadoresList.map(op => ({
                                    label: `${op.nombre}`,
                                    value: op.id
                                }))}
                                onChange={(e) => setPeriodo({ ...periodo, id_operador: e.value })}
                                placeholder="Selecciona un operador"
                                required
                                filter
                                showClear
                                disabled={!!periodo.id}
                                className={submitted && !periodo.id_operador ? 'p-invalid' : ''}
                            />
                            {submitted && !periodo.id_operador && <small className="p-error">Operador es requerido</small>}
                        </div>

                        <div className="grid">
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="fecha_inicio">Fecha Inicio *</label>
                                    <Calendar
                                        id="fecha_inicio"
                                        value={periodo.fecha_inicio ? new Date(periodo.fecha_inicio) : null}
                                        onChange={(e) => {
                                            const date = e.value;
                                            if (date) {
                                                const fechaISO = date.toISOString().split('T')[0];
                                                setPeriodo({ ...periodo, fecha_inicio: fechaISO });
                                            } else {
                                                setPeriodo({ ...periodo, fecha_inicio: '' });
                                            }
                                        }}
                                        dateFormat="dd/mm/yy"
                                        showIcon
                                        required
                                        className={submitted && !periodo.fecha_inicio ? 'p-invalid' : ''}
                                    />
                                    {submitted && !periodo.fecha_inicio && <small className="p-error">Fecha inicio es requerida</small>}
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="fecha_fin">Fecha Fin *</label>
                                    <Calendar
                                        id="fecha_fin"
                                        value={periodo.fecha_fin ? new Date(periodo.fecha_fin) : null}
                                        onChange={(e) => {
                                            const date = e.value;
                                            if (date) {
                                                const fechaISO = date.toISOString().split('T')[0];
                                                setPeriodo({ ...periodo, fecha_fin: fechaISO });
                                            } else {
                                                setPeriodo({ ...periodo, fecha_fin: '' });
                                            }
                                        }}
                                        dateFormat="dd/mm/yy"
                                        showIcon
                                        required
                                        className={submitted && !periodo.fecha_fin ? 'p-invalid' : ''}
                                    />
                                    {submitted && !periodo.fecha_fin && <small className="p-error">Fecha fin es requerida</small>}
                                </div>
                            </div>
                        </div>

                        <div className="grid">
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="dias_otorgados">Días Otorgados *</label>
                                    <InputNumber
                                        id="dias_otorgados"
                                        value={periodo.dias_otorgados}
                                        onValueChange={(e) => {
                                            const value = e.value || 0;
                                            const pendientes = value - (periodo.dias_disfrutados || 0);
                                            setPeriodo({ 
                                                ...periodo, 
                                                dias_otorgados: value,
                                                dias_pendientes: pendientes
                                            });
                                        }}
                                        min={0}
                                        max={365}
                                        required
                                        className={submitted && !periodo.dias_otorgados ? 'p-invalid' : ''}
                                    />
                                    {submitted && !periodo.dias_otorgados && <small className="p-error">Días otorgados son requeridos</small>}
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="field">
                                    <label htmlFor="dias_disfrutados">Días Disfrutados</label>
                                    <InputNumber
                                        id="dias_disfrutados"
                                        value={periodo.dias_disfrutados || 0}
                                        onValueChange={(e) => {
                                            const value = e.value || 0;
                                            const pendientes = (periodo.dias_otorgados || 0) - value;
                                            setPeriodo({ 
                                                ...periodo, 
                                                dias_disfrutados: value,
                                                dias_pendientes: pendientes
                                            });
                                        }}
                                        min={0}
                                        max={periodo.dias_otorgados || 0}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="field">
                            <label>Días Pendientes</label>
                            <div className="text-2xl font-bold text-green-600">
                                {periodo.dias_pendientes || 0}
                            </div>
                        </div>
                    </Dialog>

                    {/* Dialog de confirmación para eliminar */}
                    <Dialog
                        visible={deleteDialog}
                        style={{ width: '450px' }}
                        header="Confirmar Eliminación"
                        modal
                        footer={
                            <>
                                <Button label="No" icon="pi pi-times" text onClick={() => setDeleteDialog(false)} />
                                <Button label="Sí" icon="pi pi-check" text onClick={deletePeriodoConfirmado} loading={loading} />
                            </>
                        }
                        onHide={() => setDeleteDialog(false)}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: 'var(--orange-500)' }} />
                            <span>
                                ¿Estás seguro de eliminar este periodo de vacaciones?
                            </span>
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default VacacionesCrud;