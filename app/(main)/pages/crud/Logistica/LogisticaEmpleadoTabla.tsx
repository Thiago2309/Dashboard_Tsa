// app/(main)/pages/crud/Logistica/LogisticaEmpleadoTabla.tsx
'use client';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Toast } from 'primereact/toast';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
    LogisticaViaje,
    fetchViajesAsignadosPorOperador, // ← Nueva función
} from '../../../../../Services/BD/logistica/logisticaService';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { supabase } from '../../../../../Services/superbase.service';

const LogisticaEmpleadoTabla = () => {
    const [viajes, setViajes] = useState<LogisticaViaje[]>([]);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState<number | null>(null);
    const toast = useRef<Toast>(null);

    // Opciones de estado (el empleado solo puede cambiar a En Curso o Completado)
    const estadoOptions = [
        // { label: 'Pendiente', value: 'pendiente' },
        { label: 'Asignado', value: 'asignado' },
        { label: 'En Curso', value: 'en_curso' },
        { label: 'Completado', value: 'completado' },
        // { label: 'Cancelado', value: 'cancelado' }
    ];

    const getEstadoChipClass = (estado: string) => {
        switch (estado) {
            case 'pendiente': return 'bg-orange-100 text-orange-800';
            case 'asignado': return 'bg-blue-100 text-blue-800';
            case 'en_curso': return 'bg-cyan-100 text-cyan-800';
            case 'completado': return 'bg-green-100 text-green-800';
            case 'cancelado': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getEstadoLabel = (estado?: string) => {
        return estadoOptions.find((option) => option.value === estado)?.label || estado || 'Sin estado';
    };

    const filtrarViajesPorFechaAsignacion = (lista: LogisticaViaje[]) => {
        const hoy = new Date();
        const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

        return lista.filter((viaje) => {
            if (!viaje.fecha_asignacion) return false;

            const fechaAsignacion = new Date(viaje.fecha_asignacion);
            const fechaAsignacionStr = `${fechaAsignacion.getFullYear()}-${String(fechaAsignacion.getMonth() + 1).padStart(2, '0')}-${String(fechaAsignacion.getDate()).padStart(2, '0')}`;

            return fechaAsignacionStr === hoyStr;
        });
    };

    const cargarDatos = useCallback(async () => {
        setLoading(true);
        try {
            const viajesData = await fetchViajesAsignadosPorOperador();
            setViajes(filtrarViajesPorFechaAsignacion(viajesData));
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
    }, []);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    // Función para cambiar el estado
    const cambiarEstado = async (rowData: LogisticaViaje, nuevoEstado: string) => {
        if (rowData.estado === nuevoEstado) return;

        try {
            setUpdating(rowData.id!);
            
            const { error } = await supabase
                .from('logistica')
                .update({ estado: nuevoEstado })
                .eq('id', rowData.id);

            if (error) {
                console.error('Error actualizando estado:', error);
                toast.current?.show({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Error al actualizar el estado',
                    life: 3000
                });
                return;
            }

            // Actualizar localmente sin quitarlo de la vista
            setViajes((prevViajes) =>
                prevViajes.map((v) =>
                    v.id === rowData.id ? { ...v, estado: nuevoEstado as any } : v
                )
            );

            const estadoLabel = estadoOptions.find(e => e.value === nuevoEstado)?.label || nuevoEstado;
            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: `Estado actualizado a: ${estadoLabel}`,
                life: 3000
            });

            if (nuevoEstado === 'completado') {
                cargarDatos(); // Recargar para mostrar el siguiente viaje pendiente
            }

        } catch (error) {
            console.error('Error:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al actualizar el estado',
                life: 3000
            });
        } finally {
            setUpdating(null);
        }
    };

    // Template de estado con Dropdown
    const estadoEditableBodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <Dropdown
                value={rowData.estado}
                options={estadoOptions}
                onChange={(e) => cambiarEstado(rowData, e.value)}
                placeholder="Seleccionar estado"
                disabled={updating === rowData.id || rowData.estado === 'completado'}
                className="w-full"
                panelClassName="p-2"
                itemTemplate={(option) => {
                    const color = getEstadoChipClass(option.value);
                    return (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color}`}>
                            {option.label}
                        </span>
                    );
                }}
                valueTemplate={(option) => {
                    if (!option) return <span>Seleccionar</span>;
                    const color = getEstadoChipClass(option.value);
                    return (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color}`}>
                            {option.label}
                        </span>
                    );
                }}
            />
        );
    };

    // Templates para la tabla (igual que antes)
    const folioBodyTemplate = (rowData: LogisticaViaje) => {
        return <span className="font-bold">{rowData.folio}</span>;
    };

    const clienteBodyTemplate = (rowData: LogisticaViaje) => {
        return rowData.cliente_nombre || '-';
    };

    const operadorBodyTemplate = (rowData: LogisticaViaje) => {
        return rowData.operador_nombre || '-';
    };

    const origenBodyTemplate = (rowData: LogisticaViaje) => {
        return rowData.origen || '-';
    };

    const destinoBodyTemplate = (rowData: LogisticaViaje) => {
        return rowData.destino || '-';
    };

    const materialBodyTemplate = (rowData: LogisticaViaje) => {
        return rowData.material_nombre || '-';
    };

    const m3BodyTemplate = (rowData: LogisticaViaje) => {
        return rowData.m3_nombre || '-';
    };

    const fechaAsignacionBodyTemplate = (rowData: LogisticaViaje) => {
        if (!rowData.fecha_asignacion) return '-';
        const date = new Date(rowData.fecha_asignacion);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        return `${day}-${month}-${year}`;
    };

    const horarioBodyTemplate = (rowData: LogisticaViaje) => {
        const horarioMap = {
            'D': 'Día',
            'N': 'Noche'
        };
        return horarioMap[rowData.horario as keyof typeof horarioMap] || rowData.horario || '-';
    };

    const rentaBodyTemplate = (rowData: LogisticaViaje) => {
        return rowData.en_renta ? (
            <div className="flex align-items-center">
                <i className="pi pi-check-circle text-green-500 mr-2" />
                <span>{rowData.horas_renta?.toFixed(2) || '0.00'} hrs</span>
            </div>
        ) : (
            <div className="flex align-items-center">
                <i className="pi pi-times-circle text-red-500 mr-2" />
                <span>No</span>
            </div>
        );
    };

    const numeroViajeBodyTemplate = (rowData: LogisticaViaje) => {
        return rowData.numero_viaje || '-';
    };

    const folioBcoBodyTemplate = (rowData: LogisticaViaje) => {
        return rowData.folio_bco || '-';
    };

    return (
        <div className="card">
            <Toast ref={toast} />

            <div className="flex flex-column md:flex-row justify-content-between md:align-items-center gap-2 mb-3">
                <div className="flex flex-column sm:flex-row align-items-start sm:align-items-center gap-2">
                    <h3 className="m-0">Mis Viajes Asignados</h3>
                    <Button 
                        icon="pi pi-refresh" 
                        severity="secondary" 
                        rounded 
                        label="Recargar" 
                        onClick={cargarDatos} 
                        loading={loading}
                        tooltip="Recargar datos"
                        tooltipOptions={{ position: 'top' }}
                        className="w-full sm:w-auto"
                    />
                </div>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 border-round align-self-start md:align-self-center">
                    Pendientes: {viajes.length}
                </span>
            </div>

            <div className="block md:hidden">
                {loading ? (
                    <div className="text-center py-4 text-500">Cargando viajes...</div>
                ) : viajes.length === 0 ? (
                    <div className="text-center py-4 text-500">No tienes viajes asignados para hoy</div>
                ) : (
                    <div className="surface-card border-1 border-round p-3 shadow-1">
                        <div className="flex justify-content-between align-items-start gap-2 mb-2">
                            <div>
                                <div className="font-bold text-lg">{viajes[0].folio || '-'}</div>
                                <div className="text-sm text-500">
                                    {fechaAsignacionBodyTemplate(viajes[0])}
                                </div>
                            </div>
                            <span className={`px-3 py-1 border-round text-sm font-medium ${getEstadoChipClass(viajes[0].estado || '')}`}>
                                {getEstadoLabel(viajes[0].estado)}
                            </span>
                        </div>

                        <div className="grid">
                            <div className="col-12">
                                <div className="text-500 text-sm">Cliente</div>
                                <div className="font-medium">{clienteBodyTemplate(viajes[0])}</div>
                            </div>
                            <div className="col-12 sm:col-6">
                                <div className="text-500 text-sm">Origen</div>
                                <div className="font-medium">{origenBodyTemplate(viajes[0])}</div>
                            </div>
                            <div className="col-12 sm:col-6">
                                <div className="text-500 text-sm">Destino</div>
                                <div className="font-medium">{destinoBodyTemplate(viajes[0])}</div>
                            </div>
                            <div className="col-12 sm:col-6">
                                <div className="text-500 text-sm">Material</div>
                                <div className="font-medium">{materialBodyTemplate(viajes[0])}</div>
                            </div>
                            <div className="col-12 sm:col-6">
                                <div className="text-500 text-sm">Horario</div>
                                <div className="font-medium">{horarioBodyTemplate(viajes[0])}</div>
                            </div>
                        </div>

                        <div className="mt-3">
                            <label className="block text-500 text-sm mb-2">Cambiar estado</label>
                            <Dropdown
                                value={viajes[0].estado}
                                options={estadoOptions}
                                onChange={(e) => cambiarEstado(viajes[0], e.value)}
                                placeholder="Seleccionar estado"
                                disabled={updating === viajes[0].id || viajes[0].estado === 'completado'}
                                className="w-full"
                                panelClassName="p-2"
                                itemTemplate={(option) => {
                                    const color = getEstadoChipClass(option.value);
                                    return (
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color}`}>
                                            {option.label}
                                        </span>
                                    );
                                }}
                                valueTemplate={(option) => {
                                    if (!option) return <span>Seleccionar</span>;
                                    const color = getEstadoChipClass(option.value);
                                    return (
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${color}`}>
                                            {option.label}
                                        </span>
                                    );
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="hidden md:block">
                <DataTable
                    value={viajes.slice(0, 1)}
                    dataKey="id"
                    className="datatable-responsive"
                    emptyMessage="No tienes viajes asignados para hoy"
                    responsiveLayout="scroll"
                    loading={loading}
                    globalFilterFields={['folio', 'cliente_nombre', 'operador_nombre', 'origen', 'destino']}
                >
                    <Column field="folio" header="Folio" sortable body={folioBodyTemplate} />
                    <Column field="fecha_asignacion" header="Fecha Asignación" sortable body={fechaAsignacionBodyTemplate} />
                    <Column field="cliente_nombre" header="Cliente" sortable body={clienteBodyTemplate} />
                    <Column field="operador_nombre" header="Operador" sortable body={operadorBodyTemplate} />
                    <Column field="origen" header="Origen" sortable body={origenBodyTemplate} />
                    <Column field="destino" header="Destino" sortable body={destinoBodyTemplate} />
                    <Column field="material_nombre" header="Material" sortable body={materialBodyTemplate} />
                    <Column field="m3_nombre" header="M3" sortable body={m3BodyTemplate} />
                    <Column field="horario" header="Horario" sortable body={horarioBodyTemplate} />
                    <Column 
                        field="estado" 
                        header="Estado" 
                        body={estadoEditableBodyTemplate} 
                        headerStyle={{ minWidth: '150px' }}
                    />
                </DataTable>
            </div>
        </div>
    );
};

export default LogisticaEmpleadoTabla;