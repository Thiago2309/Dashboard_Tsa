// app/(main)/pages/crud/Logistica/logisticaCrud.tsx
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
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
    const [viajesDiaActual, setViajesDiaActual] = useState<LogisticaViaje[]>([]);
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

    // Estados para los filtros
    const [filtros, setFiltros] = useState({
        fechaInicio: null as Date | null,
        fechaFin: null as Date | null,
        idOperador: null as number | null,
        idCliente: null as number | null,
        estado: null as string | null,
        idMaterial: null as number | null,
        idM3: null as number | null,
        horario: null as string | null,
        folio: ''
    });
    const [filtroDialog, setFiltroDialog] = useState(false);
    const [filtrosAplicados, setFiltrosAplicados] = useState(false);

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
        { label: 'Completado', value: 'completado' },
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

            // Filtrar viajes del día actual
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const manana = new Date(hoy);
            manana.setDate(manana.getDate() + 1);

            const viajesHoy = viajesData.filter(viaje => {
                if (!viaje.fecha_asignacion) return false;
                const fechaViaje = new Date(viaje.fecha_asignacion);
                return fechaViaje >= hoy && fechaViaje < manana;
            });

            console.log('Viajes del día actual:', viajesHoy);

            // Calcular estadísticas solo con viajes del día actual
            const total = viajesHoy.length;
            const pendientes = viajesHoy.filter(v => v.estado === 'pendiente').length;
            const asignados = viajesHoy.filter(v => v.estado === 'asignado').length;
            const enCurso = viajesHoy.filter(v => v.estado === 'en_curso').length;
            const completados = viajesHoy.filter(v => v.estado === 'completado').length;
            const cancelados = viajesHoy.filter(v => v.estado === 'cancelado').length;

            setViajes(viajesData);
            setViajesDiaActual(viajesHoy);
            setClientes(clientesData);
            setOperadores(operadoresData);
            setMateriales(materialesData);
            setM3Options(m3Data);
            setPreciosOrigenDestino(preciosData);
            setInvitados(invitadosData);
            setEstadisticas({
                total,
                pendientes,
                asignados,
                enCurso,
                completados,
                cancelados
            });
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

    // Filtrar por rango de fechas y otros filtros
    const viajesFiltrados = useMemo(() => {
        // Si hay filtros aplicados, usar todos los viajes; si no, solo los del día actual
        let resultado = filtrosAplicados ? viajes : viajesDiaActual;
        
        // Filtro por folio
        if (filtros.folio) {
            resultado = resultado.filter(v => 
                v.folio?.toLowerCase().includes(filtros.folio.toLowerCase())
            );
        }

        // Filtro por cliente
        if (filtros.idCliente) {
            resultado = resultado.filter(v => v.id_cliente === filtros.idCliente);
        }

        // Filtro por operador
        if (filtros.idOperador) {
            resultado = resultado.filter(v => v.id_operador === filtros.idOperador);
        }

        // Filtro por estado
        if (filtros.estado) {
            resultado = resultado.filter(v => v.estado === filtros.estado);
        }

        // Filtro por material
        if (filtros.idMaterial) {
            resultado = resultado.filter(v => v.id_material === filtros.idMaterial);
        }

        // Filtro por M3
        if (filtros.idM3) {
            resultado = resultado.filter(v => v.id_m3 === filtros.idM3);
        }

        // Filtro por horario
        if (filtros.horario) {
            resultado = resultado.filter(v => v.horario === filtros.horario);
        }

        // Filtro por rango de fechas (solo si hay filtros aplicados)
        if (filtrosAplicados) {
            if (filtros.fechaInicio && filtros.fechaFin) {
                const inicio = new Date(filtros.fechaInicio);
                inicio.setHours(0, 0, 0, 0);
                const fin = new Date(filtros.fechaFin);
                fin.setHours(23, 59, 59, 999);
                
                resultado = resultado.filter(v => {
                    if (!v.fecha_asignacion) return false;
                    const fecha = new Date(v.fecha_asignacion);
                    return fecha >= inicio && fecha <= fin;
                });
            } else if (filtros.fechaInicio) {
                const inicio = new Date(filtros.fechaInicio);
                inicio.setHours(0, 0, 0, 0);
                resultado = resultado.filter(v => {
                    if (!v.fecha_asignacion) return false;
                    const fecha = new Date(v.fecha_asignacion);
                    return fecha >= inicio;
                });
            } else if (filtros.fechaFin) {
                const fin = new Date(filtros.fechaFin);
                fin.setHours(23, 59, 59, 999);
                resultado = resultado.filter(v => {
                    if (!v.fecha_asignacion) return false;
                    const fecha = new Date(v.fecha_asignacion);
                    return fecha <= fin;
                });
            }
        }
        
        return resultado;
    }, [viajes, viajesDiaActual, filtros, filtrosAplicados]);

    // Función para obtener el filtro global (para DataTable)
    const obtenerFiltroGlobal = useCallback(() => {
        const filtrosActivos = [];
        
        if (filtros.folio) filtrosActivos.push(`folio:${filtros.folio}`);
        if (filtros.idCliente) {
            const cliente = clientes.find(c => c.id === filtros.idCliente);
            if (cliente) filtrosActivos.push(`cliente:${cliente.empresa}`);
        }
        if (filtros.idOperador) {
            const operador = operadores.find(o => o.id === filtros.idOperador);
            if (operador) filtrosActivos.push(`operador:${operador.nombre}`);
        }
        if (filtros.idMaterial) {
            const material = materiales.find(m => m.id === filtros.idMaterial);
            if (material) filtrosActivos.push(`material:${material.nombre}`);
        }
        if (filtros.idM3) {
            const m3 = m3Options.find(m => m.id === filtros.idM3);
            if (m3) filtrosActivos.push(`m3:${m3.nombre}`);
        }
        if (filtros.estado) {
            const estadoLabel = estadoOptions.find(e => e.value === filtros.estado)?.label || filtros.estado;
            filtrosActivos.push(`estado:${estadoLabel}`);
        }
        if (filtros.horario) {
            const horarioMap = { 'D': 'Día', 'N': 'Noche' };
            filtrosActivos.push(`horario:${horarioMap[filtros.horario as keyof typeof horarioMap] || filtros.horario}`);
        }
        if (filtros.fechaInicio || filtros.fechaFin) {
            let fechaTexto = '';
            if (filtros.fechaInicio) {
                const fecha = new Date(filtros.fechaInicio);
                const dia = String(fecha.getDate()).padStart(2, '0');
                const mes = String(fecha.getMonth() + 1).padStart(2, '0');
                const anio = fecha.getFullYear();
                fechaTexto += `desde: ${dia}/${mes}/${anio}`;
            }
            if (filtros.fechaFin) {
                const fecha = new Date(filtros.fechaFin);
                const dia = String(fecha.getDate()).padStart(2, '0');
                const mes = String(fecha.getMonth() + 1).padStart(2, '0');
                const anio = fecha.getFullYear();
                fechaTexto += filtros.fechaInicio ? ` hasta: ${dia}/${mes}/${anio}` : `hasta: ${dia}/${mes}/${anio}`;
            }
            filtrosActivos.push(fechaTexto);
        }
        
        return filtrosActivos.join(' ');
    }, [filtros, clientes, operadores, materiales, m3Options]);

    // Función para aplicar filtros
    const aplicarFiltros = useCallback(() => {
        setFiltrosAplicados(true);
        setFiltroDialog(false);
        toast.current?.show({
            severity: 'info',
            summary: 'Filtros aplicados',
            detail: 'Los filtros se han aplicado correctamente',
            life: 2000
        });
    }, []);

    // Función para limpiar filtros
    const limpiarFiltros = useCallback(() => {
        setFiltros({
            fechaInicio: null,
            fechaFin: null,
            idOperador: null,
            idCliente: null,
            estado: null,
            idMaterial: null,
            idM3: null,
            horario: null,
            folio: ''
        });
        setFiltrosAplicados(false);
        toast.current?.show({
            severity: 'info',
            summary: 'Filtros limpiados',
            detail: 'Todos los filtros han sido eliminados',
            life: 2000
        });
    }, []);

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
                const updated = await updateViajeLogistica(viaje);
                setViajes(viajes.map(v => v.id === updated.id ? updated : v));
                toast.current?.show({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: 'Viaje actualizado correctamente',
                    life: 3000
                });
            } else {
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
            cargarDatos();
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
                <span className="font-bold">{rowData.folio || '-'}</span>
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
            <div className="flex flex-wrap align-items-center gap-2 my-2">
                <Button 
                    label="Nuevo Viaje" 
                    icon="pi pi-plus" 
                    severity="info" 
                    onClick={openNew} 
                />
                <Button 
                    label="Recargar" 
                    icon="pi pi-refresh" 
                    severity="secondary" 
                    onClick={cargarDatos}
                    loading={loading}
                />
                <Button 
                    label="Filtros" 
                    icon="pi pi-filter" 
                    severity={filtrosAplicados ? "success" : "secondary"}
                    onClick={() => setFiltroDialog(true)}
                    badge={filtrosAplicados ? "✓" : undefined}
                    className="p-button-outlined"
                />
                {filtrosAplicados && (
                    <Button 
                        label="Limpiar" 
                        icon="pi pi-times" 
                        severity="danger" 
                        onClick={limpiarFiltros}
                        className="p-button-outlined p-button-sm"
                    />
                )}
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

                    {filtrosAplicados && (
                        <div className="mb-3 p-2 bg-blue-50 border-round">
                            <span className="text-sm text-blue-700">
                                <i className="pi pi-info-circle mr-1" />
                                Filtros activos: {obtenerFiltroGlobal() || 'Ninguno'}
                            </span>
                        </div>
                    )}

                    <DataTable
                        ref={dt}
                        value={viajesFiltrados}
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
                        globalFilterFields={['folio', 'cliente_nombre', 'operador_nombre', 'origen', 'destino', 'material_nombre', 'm3_nombre', 'estado']}
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
                            <label htmlFor="folio">Folio</label>
                            <InputText
                                id="folio"
                                value={viaje.folio || ''}
                                onChange={(e) => {
                                    setViaje({ ...viaje, folio: e.target.value });
                                    setFolioError(false);
                                }}
                                placeholder="Ingresa el folio"
                            />
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
                                placeholder="Número de viaje (opcional)"
                            />
                        </div>
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

            {/* Dialog de filtros */}
            <Dialog 
                visible={filtroDialog} 
                style={{ width: '650px', maxWidth: '90vw' }} 
                header="Filtros Avanzados" 
                modal 
                className="p-fluid" 
                footer={
                    <>
                        <Button label="Limpiar" icon="pi pi-times" severity="danger" text onClick={limpiarFiltros} />
                        <Button label="Cancelar" icon="pi pi-times" text onClick={() => setFiltroDialog(false)} />
                        <Button label="Mostrar viajes" icon="pi pi-check" onClick={aplicarFiltros} />
                    </>
                } 
                onHide={() => setFiltroDialog(false)}
            >
                <div className="grid">
                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="filtroFolio">Folio</label>
                            <InputText
                                id="filtroFolio"
                                value={filtros.folio}
                                onChange={(e) => setFiltros({ ...filtros, folio: e.target.value })}
                                placeholder="Buscar por folio"
                            />
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="filtroCliente">Cliente</label>
                            <Dropdown
                                id="filtroCliente"
                                value={filtros.idCliente}
                                options={clientes.map(c => ({ label: c.empresa, value: c.id }))}
                                onChange={(e) => setFiltros({ ...filtros, idCliente: e.value })}
                                placeholder="Selecciona un cliente"
                                filter
                                showClear
                            />
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="filtroOperador">Operador</label>
                            <Dropdown
                                id="filtroOperador"
                                value={filtros.idOperador}
                                options={operadores.map(op => ({ label: op.nombre, value: op.id }))}
                                onChange={(e) => setFiltros({ ...filtros, idOperador: e.value })}
                                placeholder="Selecciona un operador"
                                filter
                                showClear
                            />
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="filtroEstado">Estado</label>
                            <Dropdown
                                id="filtroEstado"
                                value={filtros.estado}
                                options={estadoOptions}
                                onChange={(e) => setFiltros({ ...filtros, estado: e.value })}
                                placeholder="Selecciona un estado"
                                showClear
                            />
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="filtroMaterial">Material</label>
                            <Dropdown
                                id="filtroMaterial"
                                value={filtros.idMaterial}
                                options={materiales.map(m => ({ label: m.nombre, value: m.id }))}
                                onChange={(e) => setFiltros({ ...filtros, idMaterial: e.value })}
                                placeholder="Selecciona un material"
                                filter
                                showClear
                            />
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="filtroM3">M3</label>
                            <Dropdown
                                id="filtroM3"
                                value={filtros.idM3}
                                options={m3Options.map(m => ({ 
                                    label: `${m.nombre} (${m.metros_cubicos} m³)`, 
                                    value: m.id 
                                }))}
                                onChange={(e) => setFiltros({ ...filtros, idM3: e.value })}
                                placeholder="Selecciona M3"
                                filter
                                showClear
                            />
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="filtroHorario">Horario</label>
                            <Dropdown
                                id="filtroHorario"
                                value={filtros.horario}
                                options={horarioOptions}
                                onChange={(e) => setFiltros({ ...filtros, horario: e.value })}
                                placeholder="Selecciona horario"
                                showClear
                            />
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="filtroFechaInicio">Fecha Inicio</label>
                            <Calendar
                                id="filtroFechaInicio"
                                value={filtros.fechaInicio}
                                onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.value || null })}
                                dateFormat="dd/mm/yy"
                                showIcon
                                placeholder="Fecha inicio"
                            />
                        </div>
                    </div>

                    <div className="col-12 md:col-6">
                        <div className="field">
                            <label htmlFor="filtroFechaFin">Fecha Fin</label>
                            <Calendar
                                id="filtroFechaFin"
                                value={filtros.fechaFin}
                                onChange={(e) => setFiltros({ ...filtros, fechaFin: e.value || null })}
                                dateFormat="dd/mm/yy"
                                showIcon
                                placeholder="Fecha fin"
                            />
                        </div>
                    </div>
                </div>

                {/* Modificar el mensaje de filtros activos */}
                {filtrosAplicados && (
                    <div className="mb-3 p-2 bg-blue-50 border-round">
                        <span className="text-sm text-blue-700">
                            <i className="pi pi-info-circle mr-1" />
                            Filtros activos (aplicados a todos los viajes): {obtenerFiltroGlobal() || 'Ninguno'}
                        </span>
                    </div>
                )}

                {/* Indicador de viajes del día (solo cuando no hay filtros) */}
                {!filtrosAplicados && viajesDiaActual.length > 0 && (
                    <div className="mb-3 p-2 bg-green-50 border-round">
                        <span className="text-sm text-green-700">
                            <i className="pi pi-calendar mr-1" />
                            Mostrando solo viajes del día actual ({viajesDiaActual.length} viajes)
                        </span>
                    </div>
                )}
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