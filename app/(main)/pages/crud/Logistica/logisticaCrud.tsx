'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Checkbox } from 'primereact/checkbox';
import { InputNumber } from 'primereact/inputnumber';
import React, { useEffect, useRef, useState } from 'react';
import { 
    fetchViajesLogistica, 
    createViajeLogistica, 
    updateViajeLogistica, 
    deleteViajeLogistica,
    fetchClientes,
    fetchOperadores,
    fetchMateriales,
    fetchM3,
    fetchPreciosOrigenDestino,
    fetchInvitados,
    fetchEstadisticasLogistica,
    checkFolioExists,
    LogisticaViaje
} from '../../../../../Services/BD/logistica/logisticaService';

const LogisticaCrud = () => {
    const emptyViaje: LogisticaViaje = {
        folio: '',
        id_cliente: null,
        id_operador: null,
        id_precio_origen_destino: null,
        id_material: null,
        id_m3: null,
        id_invitado: null,
        estado: 'pendiente',
        observaciones: null,
        fecha_asignacion: null,
        horario: 'D',
        numero_viaje: null,
        en_renta: false,
        horas_renta: null
    };

    const [viajes, setViajes] = useState<LogisticaViaje[]>([]);
    const [viajeDialog, setViajeDialog] = useState(false);
    const [deleteViajeDialog, setDeleteViajeDialog] = useState(false);
    const [selectedViajes, setSelectedViajes] = useState<LogisticaViaje[]>([]);
    const [viaje, setViaje] = useState<LogisticaViaje>(emptyViaje);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [folioError, setFolioError] = useState(false);
    const [estadisticas, setEstadisticas] = useState({
        total: 0,
        pendientes: 0,
        asignados: 0,
        enCurso: 0,
        completados: 0,
        cancelados: 0
    });

    // Opciones de dropdown
    const [clientes, setClientes] = useState<{ id: number; empresa: string }[]>([]);
    const [operadores, setOperadores] = useState<{ id: number; nombre: string;}[]>([]);
    const [materiales, setMateriales] = useState<{ id: number; nombre: string }[]>([]);
    const [m3Options, setM3Options] = useState<{ id: number; nombre: string; metros_cubicos: number }[]>([]);
    const [preciosOrigenDestino, setPreciosOrigenDestino] = useState<{ id: number; label: string; origen: string; destino: string }[]>([]);
    const [invitados, setInvitados] = useState<{ id: number; empresa: string }[]>([]);

    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    // Estados para los viajes
    const estadoOptions = [
        { label: 'Pendiente', value: 'pendiente' },
        { label: 'Asignado', value: 'asignado' },
        // { label: 'En Curso', value: 'en_curso' },
        // { label: 'Completado', value: 'completado' },
        { label: 'Cancelado', value: 'cancelado' }
    ];

    const horarioOptions = [
        { label: 'Día', value: 'D' },
        { label: 'Noche', value: 'N' }
    ];

    // Cargar datos iniciales
    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const [viajesData, clientesData, operadoresData, materialesData, m3Data, preciosData, invitadosData, statsData] = await Promise.all([
                fetchViajesLogistica(),
                fetchClientes(),
                fetchOperadores(),
                fetchMateriales(),
                fetchM3(),
                fetchPreciosOrigenDestino(),
                fetchInvitados(),
                fetchEstadisticasLogistica()
            ]);

            setViajes(viajesData);
            setClientes(clientesData);
            setOperadores(operadoresData);
            setMateriales(materialesData);
            setM3Options(m3Data);
            setPreciosOrigenDestino(preciosData);
            setInvitados(invitadosData);
            setEstadisticas(statsData);
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
        setViaje({ ...emptyViaje });
        setSubmitted(false);
        setFolioError(false);
        setViajeDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setFolioError(false);
        setViajeDialog(false);
    };

    const saveViaje = async () => {
        setSubmitted(true);

        // Validaciones
        if (!viaje.folio || viaje.folio.trim() === '') {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'El folio es obligatorio',
                life: 3000
            });
            return;
        }

        if (!viaje.id_cliente || !viaje.id_operador || !viaje.id_precio_origen_destino || 
            !viaje.id_material || !viaje.id_m3) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Todos los campos obligatorios deben estar llenos',
                life: 3000
            });
            return;
        }

        // Validar que si está en renta, tenga horas
        if (viaje.en_renta && (!viaje.horas_renta || viaje.horas_renta <= 0)) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Las horas de renta son requeridas cuando está en renta',
                life: 3000
            });
            return;
        }

        try {
            setLoading(true);
            
            // SOLO validar el folio si es un viaje NUEVO (sin id)
            // Si es actualización, no validar porque el folio ya existe y es el mismo
            if (!viaje.id && viaje.folio) {
                const folioExists = await checkFolioExists(viaje.folio);
                if (folioExists) {
                    setFolioError(true);
                    toast.current?.show({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'El folio ya existe. Por favor ingresa uno diferente.',
                        life: 3000
                    });
                    setLoading(false);
                    return;
                }
            }

            if (viaje.id) {
                // Es una ACTUALIZACIÓN - NO validar folio
                const updated = await updateViajeLogistica(viaje);
                setViajes(viajes.map(v => v.id === updated.id ? updated : v));
                toast.current?.show({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: 'Viaje actualizado correctamente',
                    life: 3000
                });
            } else {
                // Es un NUEVO viaje - SI validar folio
                const newViaje = await createViajeLogistica(viaje);
                setViajes([newViaje, ...viajes]);
                toast.current?.show({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: `Viaje creado correctamente con folio: ${newViaje.folio}`,
                    life: 3000
                });
            }
            setViajeDialog(false);
            cargarDatos(); // Recargar estadísticas
        } catch (error) {
            console.error('Error guardando viaje:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al guardar el viaje',
                life: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    const deleteViajeConfirmado = async () => {
        try {
            setLoading(true);
            await deleteViajeLogistica(viaje.id!);
            setViajes(viajes.filter(v => v.id !== viaje.id));
            setDeleteViajeDialog(false);
            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Viaje eliminado correctamente',
                life: 3000
            });
            cargarDatos();
        } catch (error) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al eliminar el viaje',
                life: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    // Templates para la tabla
    const folioBodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <>
                <span className="p-column-title">Folio</span>
                <span className="font-bold">{rowData.folio}</span>
            </>
        );
    };

    const clienteBodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <>
                <span className="p-column-title">Cliente</span>
                {rowData.cliente_nombre || '-'}
            </>
        );
    };

    const operadorBodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <>
                <span className="p-column-title">Operador</span>
                <div>
                    <div className="font-medium">{rowData.operador_nombre || '-'}</div>
                </div>
            </>
        );
    };

    const origenBodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <>
                <span className="p-column-title">Origen</span>
                {rowData.origen || '-'}
            </>
        );
    };

    const destinoBodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <>
                <span className="p-column-title">Destino</span>
                {rowData.destino || '-'}
            </>
        );
    };

    const materialBodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <>
                <span className="p-column-title">Material</span>
                {rowData.material_nombre || '-'}
            </>
        );
    };

    const m3BodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <>
                <span className="p-column-title">M3</span>
                {rowData.m3_nombre || '-'}
            </>
        );
    };

    const estadoBodyTemplate = (rowData: LogisticaViaje) => {
        const getEstadoColor = (estado: string) => {
            switch (estado) {
                case 'pendiente': return 'bg-orange-100 text-orange-800';
                case 'asignado': return 'bg-blue-100 text-blue-800';
                case 'en_curso': return 'bg-cyan-100 text-cyan-800';
                case 'completado': return 'bg-green-100 text-green-800';
                case 'cancelado': return 'bg-red-100 text-red-800';
                default: return 'bg-gray-100 text-gray-800';
            }
        };

        const estadoLabel = estadoOptions.find(e => e.value === rowData.estado)?.label || rowData.estado;
        
        return (
            <>
                <span className="p-column-title">Estado</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getEstadoColor(rowData.estado)}`}>
                    {estadoLabel}
                </span>
            </>
        );
    };

    const fechaAsignacionBodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <>
                <span className="p-column-title">Fecha Asignación</span>
                {rowData.fecha_asignacion ? (
                    (() => {
                        const date = new Date(rowData.fecha_asignacion);
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const year = String(date.getFullYear());
                        return `${day}-${month}-${year}`;
                    })()
                ) : '-'}
            </>
        );
    };

    const horarioBodyTemplate = (rowData: LogisticaViaje) => {
        const horarioMap = {
            'D': 'Día',
            'N': 'Noche'
        };
        return (
            <>
                <span className="p-column-title">Horario</span>
                {horarioMap[rowData.horario as keyof typeof horarioMap] || rowData.horario || '-'}
            </>
        );
    };

    const rentaBodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <>
                <span className="p-column-title">Renta</span>
                {rowData.en_renta ? (
                    <div className="flex align-items-center">
                        <i className="pi pi-check-circle text-green-500 mr-2" />
                        <span>{rowData.horas_renta?.toFixed(2) || '0.00'} hrs</span>
                    </div>
                ) : (
                    <div className="flex align-items-center">
                        <i className="pi pi-times-circle text-red-500 mr-2" />
                        <span>No</span>
                    </div>
                )}
            </>
        );
    };

    const numeroViajeBodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <>
                <span className="p-column-title">Número de Viaje</span>
                {rowData.numero_viaje || '-'}
            </>
        );
    };

    const actionBodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <div className="flex gap-1">
                <Button 
                    icon="pi pi-pencil" 
                    rounded 
                    severity="info" 
                    onClick={() => {
                        setViaje(rowData);
                        setViajeDialog(true);
                    }}
                />
                <Button 
                    icon="pi pi-trash" 
                    rounded 
                    severity="danger" 
                    onClick={() => {
                        setViaje(rowData);
                        setDeleteViajeDialog(true);
                    }}
                />
            </div>
        );
    };

    const leftToolbarTemplate = () => {
        return (
            <div className="my-2">
                <Button 
                    label="Nuevo Viaje" 
                    icon="pi pi-plus" 
                    severity="info" 
                    className="mr-2" 
                    onClick={openNew} 
                />
                <Button 
                    label="Recargar" 
                    icon="pi pi-refresh" 
                    severity="secondary" 
                    className="mr-2" 
                    onClick={cargarDatos}
                    loading={loading}
                />
            </div>
        );
    };

    const rightToolbarTemplate = () => {
        return (
            <Button 
                label="Exportar" 
                icon="pi pi-upload" 
                severity="help" 
                onClick={() => dt.current?.exportCSV()} 
            />
        );
    };

    return (
        <div className="grid">
            {/* Cards de estadísticas */}
            <div className="col-12 md:col-6 lg:col-2">
                <div className="card p-3 bg-blue-50">
                    <div className="flex justify-content-between">
                        <div>
                            <span className="block text-500 font-medium">Total</span>
                            <div className="text-900 font-medium text-2xl">{estadisticas.total}</div>
                        </div>
                        <div className="flex align-items-center justify-content-center bg-blue-100 border-round" style={{ width: '3rem', height: '3rem' }}>
                            <i className="pi pi-truck text-blue-500 text-xl" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="col-12 md:col-6 lg:col-2">
                <div className="card p-3 bg-orange-50">
                    <div className="flex justify-content-between">
                        <div>
                            <span className="block text-500 font-medium">Pendientes</span>
                            <div className="text-900 font-medium text-2xl">{estadisticas.pendientes}</div>
                        </div>
                        <div className="flex align-items-center justify-content-center bg-orange-100 border-round" style={{ width: '3rem', height: '3rem' }}>
                            <i className="pi pi-clock text-orange-500 text-xl" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="col-12 md:col-6 lg:col-2">
                <div className="card p-3 bg-blue-100">
                    <div className="flex justify-content-between">
                        <div>
                            <span className="block text-500 font-medium">Asignados</span>
                            <div className="text-900 font-medium text-2xl">{estadisticas.asignados}</div>
                        </div>
                        <div className="flex align-items-center justify-content-center bg-blue-200 border-round" style={{ width: '3rem', height: '3rem' }}>
                            <i className="pi pi-users text-blue-700 text-xl" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="col-12 md:col-6 lg:col-2">
                <div className="card p-3 bg-cyan-50">
                    <div className="flex justify-content-between">
                        <div>
                            <span className="block text-500 font-medium">En Curso</span>
                            <div className="text-900 font-medium text-2xl">{estadisticas.enCurso}</div>
                        </div>
                        <div className="flex align-items-center justify-content-center bg-cyan-100 border-round" style={{ width: '3rem', height: '3rem' }}>
                            <i className="pi pi-spinner text-cyan-500 text-xl" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="col-12 md:col-6 lg:col-2">
                <div className="card p-3 bg-green-50">
                    <div className="flex justify-content-between">
                        <div>
                            <span className="block text-500 font-medium">Completados</span>
                            <div className="text-900 font-medium text-2xl">{estadisticas.completados}</div>
                        </div>
                        <div className="flex align-items-center justify-content-center bg-green-100 border-round" style={{ width: '3rem', height: '3rem' }}>
                            <i className="pi pi-check-circle text-green-500 text-xl" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="col-12 md:col-6 lg:col-2">
                <div className="card p-3 bg-red-50">
                    <div className="flex justify-content-between">
                        <div>
                            <span className="block text-500 font-medium">Cancelados</span>
                            <div className="text-900 font-medium text-2xl">{estadisticas.cancelados}</div>
                        </div>
                        <div className="flex align-items-center justify-content-center bg-red-100 border-round" style={{ width: '3rem', height: '3rem' }}>
                            <i className="pi pi-times-circle text-red-500 text-xl" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabla de viajes */}
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} right={rightToolbarTemplate} />

                    <DataTable
                        ref={dt}
                        value={viajes}
                        selection={selectedViajes}
                        onSelectionChange={(e) => setSelectedViajes(e.value)}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        className="datatable-responsive"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} viajes"
                        emptyMessage="No se encontraron viajes"
                        responsiveLayout="scroll"
                        loading={loading}
                        globalFilterFields={['folio', 'cliente_nombre', 'operador_nombre', 'origen', 'destino']}
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '4rem' }} />
                        <Column field="folio" header="Folio" sortable body={folioBodyTemplate} />
                        <Column field="numero_viaje" header="Número de Viaje" sortable body={numeroViajeBodyTemplate} />
                        <Column field="fecha_asignacion" header="Fecha Asignación" sortable body={fechaAsignacionBodyTemplate} />
                        <Column field="cliente_nombre" header="Cliente" sortable body={clienteBodyTemplate} />
                        <Column field="operador_nombre" header="Operador" sortable body={operadorBodyTemplate} />
                        <Column field="origen" header="Origen" sortable body={origenBodyTemplate} />
                        <Column field="destino" header="Destino" sortable body={destinoBodyTemplate} />
                        <Column field="material_nombre" header="Material" sortable body={materialBodyTemplate} />
                        <Column field="m3_nombre" header="M3" sortable body={m3BodyTemplate} />
                        <Column field="horario" header="Horario" sortable body={horarioBodyTemplate} />
                        <Column field="en_renta" header="Renta" sortable body={rentaBodyTemplate} />
                        <Column field="estado" header="Estado" sortable body={estadoBodyTemplate} />
                        <Column header="Acciones" body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }} />
                    </DataTable>
                </div>
            </div>

            {/* Dialog para crear/editar viaje */}
            <Dialog 
                visible={viajeDialog} 
                style={{ width: '650px' }} 
                header={viaje.id ? 'Editar Viaje' : 'Nuevo Viaje'} 
                modal 
                className="p-fluid" 
                footer={
                    <>
                        <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
                        <Button label="Guardar" icon="pi pi-check" text onClick={saveViaje} loading={loading} />
                    </>
                } 
                onHide={hideDialog}
            >
                <div className="grid">
                    <div className="col-12">
                        <div className="field">
                            <label htmlFor="folio">Folio</label><span style={{ color: 'red' }}> *</span>
                            <InputText
                                id="folio"
                                value={viaje.folio || ''}
                                onChange={(e) => {
                                    setViaje({ ...viaje, folio: e.target.value });
                                    setFolioError(false);
                                }}
                                placeholder="Ingresa el folio"
                                required
                                className={submitted && !viaje.folio ? 'p-invalid' : (folioError ? 'p-invalid' : '')}
                            />
                            {submitted && !viaje.folio && <small className="p-error">El folio es obligatorio</small>}
                            {folioError && <small className="p-error">Este folio ya existe. Por favor ingresa otro.</small>}
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="fecha_asignacion">Fecha Asignación</label><span style={{ color: 'red' }}> *</span>
                            <Calendar
                                id="fecha_asignacion"
                                value={viaje.fecha_asignacion ? new Date(viaje.fecha_asignacion) : null}
                                onChange={(e) => {
                                    const date = e.value;
                                    if (date) {
                                        // Formato ISO para la base de datos
                                        const fechaISO = date.toISOString();
                                        setViaje({ ...viaje, fecha_asignacion: fechaISO });
                                    } else {
                                        setViaje({ ...viaje, fecha_asignacion: null });
                                    }
                                }}
                                dateFormat="dd/mm/yy"
                                showIcon
                                hourFormat="24"
                                placeholder="Selecciona fecha y hora"
                            />
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="cliente">Cliente</label><span style={{ color: 'red' }}> *</span>
                            <Dropdown
                                id="cliente"
                                value={viaje.id_cliente}
                                options={clientes.map(c => ({ label: c.empresa, value: c.id }))}
                                onChange={(e) => setViaje({ ...viaje, id_cliente: e.value })}
                                placeholder="Selecciona un cliente"
                                required
                                filter
                                showClear
                                className={submitted && !viaje.id_cliente ? 'p-invalid' : ''}
                            />
                            {submitted && !viaje.id_cliente && <small className="p-error">Cliente es requerido</small>}
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="operador">Operador</label><span style={{ color: 'red' }}> *</span>
                            <Dropdown
                                id="operador"
                                value={viaje.id_operador}
                                options={operadores.map(op => ({ 
                                    label: op.nombre, 
                                    value: op.id 
                                }))}
                                onChange={(e) => setViaje({ ...viaje, id_operador: e.value })}
                                placeholder="Selecciona un operador"
                                required
                                filter
                                showClear
                                className={submitted && !viaje.id_operador ? 'p-invalid' : ''}
                            />
                            {submitted && !viaje.id_operador && <small className="p-error">Operador es requerido</small>}
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="ruta">Origen - Destino</label><span style={{ color: 'red' }}> *</span>
                            <Dropdown
                                id="ruta"
                                value={viaje.id_precio_origen_destino}
                                options={preciosOrigenDestino.map(p => ({ label: p.label, value: p.id }))}
                                onChange={(e) => setViaje({ ...viaje, id_precio_origen_destino: e.value })}
                                placeholder="Selecciona una ruta"
                                required
                                filter
                                showClear
                                className={submitted && !viaje.id_precio_origen_destino ? 'p-invalid' : ''}
                            />
                            {submitted && !viaje.id_precio_origen_destino && <small className="p-error">Ruta es requerida</small>}
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="material">Material</label><span style={{ color: 'red' }}> *</span>
                            <Dropdown
                                id="material"
                                value={viaje.id_material}
                                options={materiales.map(m => ({ label: m.nombre, value: m.id }))}
                                onChange={(e) => setViaje({ ...viaje, id_material: e.value })}
                                placeholder="Selecciona un material"
                                required
                                filter
                                showClear
                                className={submitted && !viaje.id_material ? 'p-invalid' : ''}
                            />
                            {submitted && !viaje.id_material && <small className="p-error">Material es requerido</small>}
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="m3">M3</label><span style={{ color: 'red' }}> *</span>
                            <Dropdown
                                id="m3"
                                value={viaje.id_m3}
                                options={m3Options.map(m => ({ 
                                    label: `${m.nombre} (${m.metros_cubicos} m³)`, 
                                    value: m.id 
                                }))}
                                onChange={(e) => setViaje({ ...viaje, id_m3: e.value })}
                                placeholder="Selecciona M3"
                                required
                                filter
                                showClear
                                className={submitted && !viaje.id_m3 ? 'p-invalid' : ''}
                            />
                            {submitted && !viaje.id_m3 && <small className="p-error">M3 es requerido</small>}
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="invitado">Invitado</label>
                            <Dropdown
                                id="invitado"
                                value={viaje.id_invitado}
                                options={invitados.map(i => ({ label: i.empresa, value: i.id }))}
                                onChange={(e) => setViaje({ ...viaje, id_invitado: e.value })}
                                placeholder="Selecciona un invitado (opcional)"
                                filter
                                showClear
                            />
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="estado">Estado</label><span style={{ color: 'red' }}> *</span>
                            <Dropdown
                                id="estado"
                                value={viaje.estado}
                                options={estadoOptions}
                                onChange={(e) => setViaje({ ...viaje, estado: e.value })}
                                placeholder="Selecciona un estado"
                            />
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="horario">Horario</label><span style={{ color: 'red' }}> *</span>
                            <Dropdown
                                id="horario"
                                value={viaje.horario || 'D'}
                                options={horarioOptions}
                                onChange={(e) => setViaje({ ...viaje, horario: e.value })}
                                placeholder="Selecciona horario"
                            />
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="numero_viaje">Número de Viaje</label>
                            <InputText
                                id="numero_viaje"
                                value={viaje.numero_viaje || ''}
                                onChange={(e) => setViaje({ ...viaje, numero_viaje: e.target.value })}
                                placeholder="Número de viaje"
                            />
                        </div>
                    </div>

                    <div className="col-12">
                        <div className="field">
                            <label htmlFor="en_renta" className="block mb-2">
                                <Checkbox
                                    id="en_renta"
                                    checked={viaje.en_renta}
                                    onChange={(e) => setViaje({ 
                                        ...viaje, 
                                        en_renta: e.checked ?? false,
                                        horas_renta: e.checked ? (viaje.horas_renta || 0) : null
                                    })}
                                />
                                <span className="ml-2">¿El camión está en renta?</span>
                            </label>
                        </div>

                        {viaje.en_renta && (
                            <div className="field">
                                <label htmlFor="horas_renta">Horas de Renta *</label>
                                <InputNumber
                                    id="horas_renta"
                                    value={viaje.horas_renta ?? 0}
                                    onValueChange={(e) => setViaje({ ...viaje, horas_renta: e.value ?? 0 })}
                                    mode="decimal"
                                    min={0}
                                    minFractionDigits={2}
                                    maxFractionDigits={2}
                                    placeholder="0.00"
                                    required={viaje.en_renta}
                                    className={submitted && viaje.en_renta && !viaje.horas_renta ? 'p-invalid' : ''}
                                />
                                {submitted && viaje.en_renta && !viaje.horas_renta && (
                                    <small className="p-error">Las horas de renta son requeridas</small>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="col-12">
                        <div className="field">
                            <label htmlFor="observaciones">Observaciones</label>
                            <InputTextarea
                                id="observaciones"
                                value={viaje.observaciones || ''}
                                onChange={(e) => setViaje({ ...viaje, observaciones: e.target.value })}
                                placeholder="Observaciones adicionales"
                                rows={3}
                            />
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* Dialog de confirmación para eliminar */}
            <Dialog 
                visible={deleteViajeDialog} 
                style={{ width: '450px' }} 
                header="Confirmar Eliminación" 
                modal 
                footer={
                    <>
                        <Button label="No" icon="pi pi-times" text onClick={() => setDeleteViajeDialog(false)} />
                        <Button label="Sí" icon="pi pi-check" text onClick={deleteViajeConfirmado} loading={loading} />
                    </>
                } 
                onHide={() => setDeleteViajeDialog(false)}
            >
                <div className="flex align-items-center justify-content-center">
                    <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: 'var(--orange-500)' }} />
                    <span>
                        ¿Estás seguro de eliminar el viaje <b>{viaje?.folio}</b>?
                    </span>
                </div>
            </Dialog>
        </div>
    );
};

export default LogisticaCrud;