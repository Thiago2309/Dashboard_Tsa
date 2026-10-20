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
import { TabView, TabPanel } from 'primereact/tabview';
import { Tag } from 'primereact/tag';
import React, { useEffect, useRef, useState } from 'react';
import { 
    fetchOperadoresConVacaciones,
    createPeriodoVacaciones,
    updatePeriodoVacaciones,
    deletePeriodoVacaciones,
    fetchOperadores,
    fetchSolicitudesVacaciones,
    deleteSolicitudVacaciones,
    SolicitudVacaciones,
    parseFechaLocal,
    formatFechaLocal,
    OperadorVacaciones,
    PeriodoVacaciones
} from '../../../../../Services/BD/Vacaciones/vacacionesService';
import SolicitudVacacionesDialog from './SolicitudVacacionesDialog';
import SolicitudDetalleDialog from './SolicitudDetalleDialog';

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

    // Solicitudes de vacaciones
    const [tabActiva, setTabActiva] = useState(0);
    const [solicitudes, setSolicitudes] = useState<SolicitudVacaciones[]>([]);
    const [solicitudDialog, setSolicitudDialog] = useState(false);
    const [idOperadorSolicitud, setIdOperadorSolicitud] = useState<number | null>(null);
    const [solicitudDetalle, setSolicitudDetalle] = useState<SolicitudVacaciones | null>(null);
    const [solicitudEliminar, setSolicitudEliminar] = useState<SolicitudVacaciones | null>(null);

    // Cargar datos iniciales
    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [data, operadoresData, solicitudesData] = await Promise.all([
                fetchOperadoresConVacaciones(),
                fetchOperadores(),
                fetchSolicitudesVacaciones()
            ]);
            setOperadores(data);
            setOperadoresList(operadoresData);
            setSolicitudes(solicitudesData);
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

    const abrirNuevaSolicitud = (idOperador: number | null) => {
        setIdOperadorSolicitud(idOperador);
        setSolicitudDialog(true);
    };

    const diasPendientesOtras = (sol: SolicitudVacaciones) =>
        solicitudes
            .filter(s => s.id_operador === sol.id_operador && s.estatus === 'pendiente' && s.id !== sol.id)
            .reduce((sum, s) => sum + s.dias_solicitados, 0);

    const eliminarSolicitudConfirmado = async () => {
        if (!solicitudEliminar) return;
        try {
            setLoading(true);
            await deleteSolicitudVacaciones(solicitudEliminar);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Solicitud eliminada', life: 3000 });
            setSolicitudEliminar(null);
            cargarDatos();
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar la solicitud', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    const estatusSolicitudTemplate = (rowData: SolicitudVacaciones) => {
        const config = {
            pendiente: { label: 'Pendiente', severity: 'warning' as const },
            autorizada: { label: 'Autorizada', severity: 'success' as const },
            rechazada: { label: 'Rechazada', severity: 'danger' as const }
        }[rowData.estatus];
        return <Tag value={config.label} severity={config.severity} />;
    };

    // Días que le quedan: foto guardada al autorizar, o saldo actual si sigue pendiente
    const restantesSolicitudTemplate = (rowData: SolicitudVacaciones) => {
        if (rowData.estatus === 'autorizada') return <span className="font-bold text-green-600">{rowData.dias_restantes}</span>;
        if (rowData.estatus === 'rechazada') return '-';
        const op = operadores.find(o => o.id === rowData.id_operador);
        if (!op) return '-';
        const quedarian = op.dias_disponibles - diasPendientesOtras(rowData) - rowData.dias_solicitados;
        return <span className={`font-bold ${quedarian < 0 ? 'text-red-600' : 'text-500'}`}>{quedarian}</span>;
    };

    const tomadosSolicitudTemplate = (rowData: SolicitudVacaciones) => {
        if (rowData.estatus === 'autorizada') return rowData.dias_tomados_antes;
        return operadores.find(o => o.id === rowData.id_operador)?.dias_disfrutados_periodo ?? '-';
    };

    const firmasSolicitudTemplate = (rowData: SolicitudVacaciones) => (
        <span className="flex gap-2">
            <i className={`pi ${rowData.firma_empleado ? 'pi-check-circle text-green-600' : 'pi-circle text-400'}`} title="Firma del empleado" />
            <i className={`pi ${rowData.firma_jefe ? 'pi-check-circle text-green-600' : 'pi-circle text-400'}`} title="Firma del jefe" />
        </span>
    );

    const accionesSolicitudTemplate = (rowData: SolicitudVacaciones) => (
        <div className="flex gap-1">
            <Button
                icon={rowData.estatus === 'pendiente' ? 'pi pi-pencil' : 'pi pi-eye'}
                rounded
                severity={rowData.estatus === 'pendiente' ? 'success' : 'secondary'}
                size="small"
                tooltip={rowData.estatus === 'pendiente' ? 'Firmar / Autorizar' : 'Ver / Imprimir'}
                onClick={() => setSolicitudDetalle(rowData)}
            />
            <Button icon="pi pi-trash" rounded severity="danger" size="small" tooltip="Eliminar" onClick={() => setSolicitudEliminar(rowData)} />
        </div>
    );

    // Templates para la tabla principal
    const nombreBodyTemplate = (rowData: OperadorVacaciones) => {
        return `${rowData.nombre}`;
    };

    const formatFecha = (fecha: Date | null) =>
        fecha ? `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}` : '-';

    const antiguedadBodyTemplate = (rowData: OperadorVacaciones) => {
        if (!rowData.fecha_contratacion) return '-';
        const { anios_cumplidos: a, meses_cumplidos: m } = rowData;
        return `${a} ${a === 1 ? 'año' : 'años'} ${m} ${m === 1 ? 'mes' : 'meses'}`;
    };

    const diasLeyBodyTemplate = (rowData: OperadorVacaciones) => {
        if (!rowData.fecha_contratacion) return '-';
        if (rowData.anios_cumplidos < 1) {
            return <span className="text-500">Aún no cumple 1 año</span>;
        }
        return <span className="font-bold text-blue-600">{rowData.dias_ley}</span>;
    };

    const disfrutadosPeriodoBodyTemplate = (rowData: OperadorVacaciones) => {
        return <span className="font-bold text-orange-600">{rowData.dias_disfrutados_periodo}</span>;
    };

    const disponiblesBodyTemplate = (rowData: OperadorVacaciones) => {
        return <span className="font-bold text-green-600">{rowData.dias_disponibles}</span>;
    };

    const proximoAniversarioBodyTemplate = (rowData: OperadorVacaciones) => {
        if (!rowData.fecha_proximo_aniversario) return '-';
        return (
            <span>
                {formatFecha(rowData.fecha_proximo_aniversario)}
                <small className="block text-500">{rowData.dias_proximo_periodo} días</small>
            </span>
        );
    };

    const actionBodyTemplate = (rowData: OperadorVacaciones) => {
        return (
            <div className="flex gap-1">
                <Button
                    icon="pi pi-file-edit"
                    rounded
                    severity="success"
                    size="small"
                    tooltip="Solicitar Vacaciones"
                    onClick={() => abrirNuevaSolicitud(rowData.id)}
                />
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
                            dias_otorgados: rowData.dias_disponibles || 12,
                            dias_pendientes: rowData.dias_disponibles || 12
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
                    <Column field="fecha_inicio" header="Fecha Inicio" body={(rowData) => formatFecha(parseFechaLocal(rowData.fecha_inicio))} />
                    <Column field="fecha_fin" header="Fecha Fin" body={(rowData) => formatFecha(parseFechaLocal(rowData.fecha_fin))} />
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
                    label="Nueva Solicitud"
                    icon="pi pi-file-edit"
                    severity="success"
                    className="mr-2"
                    onClick={() => abrirNuevaSolicitud(null)}
                />
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

                    <TabView activeIndex={tabActiva} onTabChange={e => setTabActiva(e.index)}>
                    <TabPanel header="Saldos por Empleado" leftIcon="pi pi-users mr-2">
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
                        <Column field="anios_cumplidos" header="Antigüedad" sortable body={antiguedadBodyTemplate} />
                        <Column field="dias_ley" header="Días por Ley" sortable body={diasLeyBodyTemplate} />
                        <Column field="dias_disfrutados_periodo" header="Disfrutados (periodo)" sortable body={disfrutadosPeriodoBodyTemplate} />
                        <Column field="dias_disponibles" header="Disponibles" sortable body={disponiblesBodyTemplate} />
                        <Column field="fecha_proximo_aniversario" header="Próximo Aniversario" sortable body={proximoAniversarioBodyTemplate} />
                        <Column header="Acciones" body={actionBodyTemplate} headerStyle={{ minWidth: '12rem' }} />
                    </DataTable>
                    </TabPanel>

                    <TabPanel
                        header={`Solicitudes${solicitudes.some(s => s.estatus === 'pendiente') ? ` (${solicitudes.filter(s => s.estatus === 'pendiente').length} pendientes)` : ''}`}
                        leftIcon="pi pi-file-edit mr-2"
                    >
                        <DataTable
                            value={solicitudes}
                            dataKey="id"
                            paginator
                            rows={10}
                            rowsPerPageOptions={[5, 10, 25]}
                            className="datatable-responsive"
                            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} Solicitudes"
                            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                            emptyMessage="No hay solicitudes de vacaciones."
                            responsiveLayout="scroll"
                            loading={loading}
                        >
                            <Column field="id" header="Folio" sortable />
                            <Column field="operador_nombre" header="Empleado" sortable filter filterPlaceholder="Buscar empleado" />
                            <Column
                                field="fecha_inicio"
                                header="Periodo"
                                sortable
                                body={(r: SolicitudVacaciones) => `${formatFecha(parseFechaLocal(r.fecha_inicio))} - ${formatFecha(parseFechaLocal(r.fecha_fin))}`}
                            />
                            <Column field="dias_solicitados" header="Días que toma" sortable body={(r: SolicitudVacaciones) => <span className="font-bold text-orange-600">{r.dias_solicitados}</span>} />
                            <Column header="Tomados antes" body={tomadosSolicitudTemplate} />
                            <Column header="Le quedan" body={restantesSolicitudTemplate} />
                            <Column field="estatus" header="Estatus" sortable body={estatusSolicitudTemplate} />
                            <Column header="Firmas" body={firmasSolicitudTemplate} />
                            <Column field="autorizado_por" header="Autoriza" sortable body={(r: SolicitudVacaciones) => r.autorizado_por || <span className="text-400">Sin autorizar</span>} />
                            <Column header="Acciones" body={accionesSolicitudTemplate} headerStyle={{ minWidth: '8rem' }} />
                        </DataTable>
                    </TabPanel>
                    </TabView>

                    <SolicitudVacacionesDialog
                        visible={solicitudDialog}
                        onHide={() => setSolicitudDialog(false)}
                        onGuardada={() => {
                            setSolicitudDialog(false);
                            setTabActiva(1);
                            cargarDatos();
                        }}
                        operadores={operadores}
                        solicitudes={solicitudes}
                        idOperadorInicial={idOperadorSolicitud}
                        toast={toast}
                    />

                    <SolicitudDetalleDialog
                        solicitud={solicitudDetalle}
                        operador={operadores.find(o => o.id === solicitudDetalle?.id_operador) || null}
                        diasPendientesOtras={solicitudDetalle ? diasPendientesOtras(solicitudDetalle) : 0}
                        onHide={() => setSolicitudDetalle(null)}
                        onActualizada={() => {
                            setSolicitudDetalle(null);
                            cargarDatos();
                        }}
                        toast={toast}
                    />

                    <Dialog
                        visible={!!solicitudEliminar}
                        style={{ width: '450px' }}
                        header="Confirmar Eliminación"
                        modal
                        footer={
                            <>
                                <Button label="No" icon="pi pi-times" text onClick={() => setSolicitudEliminar(null)} />
                                <Button label="Sí" icon="pi pi-check" text onClick={eliminarSolicitudConfirmado} loading={loading} />
                            </>
                        }
                        onHide={() => setSolicitudEliminar(null)}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: 'var(--orange-500)' }} />
                            <span>
                                ¿Eliminar la solicitud #{solicitudEliminar?.id} de {solicitudEliminar?.operador_nombre}?
                                {solicitudEliminar?.estatus === 'autorizada' && ' Los días autorizados se regresarán a su saldo.'}
                            </span>
                        </div>
                    </Dialog>

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
                                        value={parseFechaLocal(periodo.fecha_inicio)}
                                        onChange={(e) => {
                                            const date = e.value;
                                            if (date) {
                                                const fechaISO = formatFechaLocal(date);
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
                                        value={parseFechaLocal(periodo.fecha_fin)}
                                        onChange={(e) => {
                                            const date = e.value;
                                            if (date) {
                                                const fechaISO = formatFechaLocal(date);
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