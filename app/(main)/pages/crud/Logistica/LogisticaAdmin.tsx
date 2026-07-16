// app/(main)/pages/crud/Logistica/LogisticaTabla.tsx
'use client';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Toast } from 'primereact/toast';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
    fetchViajesLogistica, 
    LogisticaViaje,
    fetchPreciosOrigenDestino,
    fetchMateriales,
    fetchM3,
    updateViajeLogistica
} from '../../../../../Services/BD/logistica/logisticaService';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { supabase } from '../../../../../Services/superbase.service';
import { createViaje } from '../../../../../Services/BD/viajeService';

const LogisticaAdmin = () => {
    const [viajes, setViajes] = useState<LogisticaViaje[]>([]);
    const [viajesDiaActual, setViajesDiaActual] = useState<LogisticaViaje[]>([]);
    const [estadisticas, setEstadisticas] = useState({
        total: 0,
        pendientes: 0,
        asignados: 0,
        enCurso: 0,
        completados: 0,
        cancelados: 0
    });
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);

    // Estados para el diálogo de edición
    const [editDialog, setEditDialog] = useState(false);
    const [editViaje, setEditViaje] = useState<LogisticaViaje | null>(null);
    const [folioBco, setFolioBco] = useState('');
    const [folio, setFolio] = useState('');
    const [numeroViaje, setNumeroViaje] = useState('');
    const [cantidadViajes, setCantidadViajes] = useState<number | null>(null);
    const [submittedEdit, setSubmittedEdit] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);

    // Cargar datos
    const cargarDatos = useCallback(async () => {
        setLoading(true);
        try {
            const viajesData = await fetchViajesLogistica();
            setViajes(viajesData);

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
    }, []);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    const cerrarDialog = useCallback(() => {
        setEditDialog(false);
        setEditViaje(null);
        setFolioBco('');
        setFolio('');
        setNumeroViaje('');
        setCantidadViajes(null);
        setSubmittedEdit(false);
    }, []);

    const handleEditar = useCallback((rowData: LogisticaViaje) => {
        setEditViaje(rowData);
        setFolioBco(rowData.folio_bco || '');
        setFolio(rowData.folio || '');
        setNumeroViaje(rowData.numero_viaje || '');
        setCantidadViajes(rowData.cantidad_viajes || null);
        setSubmittedEdit(false);
        setEditDialog(true);
    }, []);

    const guardarEdicion = useCallback(async () => {
        setSubmittedEdit(true);

        try {
            setLoadingEdit(true);
            
            const datosActualizar = {
                id: editViaje?.id,
                folio: folio.trim(),
                folio_bco: folioBco || null,
                numero_viaje: numeroViaje || null,
                cantidad_viajes: cantidadViajes || null,
                id_cliente: editViaje?.id_cliente,
                id_operador: editViaje?.id_operador,
                id_precio_origen_destino: editViaje?.id_precio_origen_destino,
                id_material: editViaje?.id_material,
                id_m3: editViaje?.id_m3,
                id_invitado: editViaje?.id_invitado,
                estado: editViaje?.estado,
                observaciones: editViaje?.observaciones,
                fecha_asignacion: editViaje?.fecha_asignacion,
                horario: editViaje?.horario,
                en_renta: editViaje?.en_renta,
                horas_renta: editViaje?.horas_renta
            };

            await updateViajeLogistica(datosActualizar as LogisticaViaje);

            setViajes(prevViajes => 
                prevViajes.map(v => 
                    v.id === editViaje?.id ? { 
                        ...v, 
                        folio: folio.trim(),
                        folio_bco: folioBco,
                        numero_viaje: numeroViaje,
                        cantidad_viajes: cantidadViajes
                    } : v
                )
            );

            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Datos actualizados correctamente',
                life: 3000
            });

            cerrarDialog();
            
        } catch (error) {
            console.error('Error:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al actualizar los datos',
                life: 3000
            });
        } finally {
            setLoadingEdit(false);
        }
    }, [editViaje, folio, folioBco, numeroViaje, cantidadViajes, cerrarDialog]);

    const handleAprobar = useCallback(async (rowData: LogisticaViaje) => {
        try {
            const [preciosData, materialesData, m3Data] = await Promise.all([
                fetchPreciosOrigenDestino(),
                fetchMateriales(),
                fetchM3()
            ]);

            const precio = preciosData.find(p => p.id === rowData.id_precio_origen_destino);
            const material = materialesData.find(m => m.id === rowData.id_material);
            const m3Item = m3Data.find(m => m.id === rowData.id_m3);

            if (!precio || !material || !m3Item) {
                toast.current?.show({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se encontraron los datos necesarios para crear el viaje',
                    life: 3000
                });
                return;
            }

            let caphrsviajes;
            let total_materia = null;

            if (rowData.en_renta && rowData.horas_renta) {
                caphrsviajes = precio.precio_unidad * m3Item.metros_cubicos * rowData.horas_renta;
            } else if (rowData.cantidad_viajes && rowData.cantidad_viajes > 0) {
                caphrsviajes = precio.precio_unidad * m3Item.metros_cubicos * rowData.cantidad_viajes;
            } else {
                caphrsviajes = precio.precio_unidad * m3Item.metros_cubicos;
            }

            if (precio.precio_materia && precio.precio_materia > 0) {
                total_materia = precio.precio_materia * m3Item.metros_cubicos;
            }

            const fechaViaje = rowData.fecha_asignacion 
                ? new Date(rowData.fecha_asignacion).toISOString().split('T')[0] 
                : new Date().toISOString().split('T')[0];
            
            const numeroViajeNum = rowData.numero_viaje != null && rowData.numero_viaje !== ''
                ? Number(rowData.numero_viaje)
                : null;

            const idInvitado = rowData.id_invitado ? String(rowData.id_invitado) : null;

            const nuevoViaje = {
                id_cliente: rowData.id_cliente,
                fecha: fechaViaje,
                folio_bco: rowData.folio_bco || '',
                folio: rowData.folio,
                id_precio_origen_destino: rowData.id_precio_origen_destino,
                id_material: rowData.id_material,
                id_m3: rowData.id_m3,
                caphrsviajes: caphrsviajes,
                total_materia: total_materia,
                id_operador: rowData.id_operador,
                id_invitado: idInvitado,
                en_renta: rowData.en_renta || false,
                horas_renta: rowData.horas_renta || null,
                horario: rowData.horario || 'D',
                numero_viaje: numeroViajeNum,
                cantidad_viajes: rowData.cantidad_viajes || null
            };

            const result = await createViaje(nuevoViaje);

            if (result) {
                toast.current?.show({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: `Viaje aprobado y creado correctamente con folio: ${rowData.folio}`,
                    life: 3000
                });

                const { error: deleteError } = await supabase
                    .from('logistica')
                    .delete()
                    .eq('id', rowData.id);

                if (deleteError) {
                    console.error('Error eliminando registro:', deleteError);
                }

                cargarDatos();
            }
        } catch (error) {
            console.error('Error al aprobar viaje:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al aprobar el viaje',
                life: 3000
            });
        }
    }, [cargarDatos]);

    const handleRechazar = useCallback(async (rowData: LogisticaViaje) => {
        try {
            const { error: deleteError } = await supabase
                .from('logistica')
                .delete()
                .eq('id', rowData.id);

            if (deleteError) {
                console.error('Error eliminando registro:', deleteError);
                toast.current?.show({
                    severity: 'error',
                    summary: 'Error',
                    detail: `Error al rechazar el viaje: ${rowData.folio}`,
                    life: 3000
                });
                return;
            }

            toast.current?.show({
                severity: 'info',
                summary: 'Rechazado',
                detail: `Viaje rechazado correctamente con folio: ${rowData.folio}`,
                life: 3000
            });

            cargarDatos();
        } catch (error) {
            console.error('Error al rechazar viaje:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al rechazar el viaje',
                life: 3000
            });
        }
    }, [cargarDatos]);

    // Ordenar viajes por prioridad de estado (solo los del día actual)
    const viajesOrdenados = useMemo(() => {
        // Primero filtrar solo los viajes del día actual
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);

        const viajesHoy = viajes.filter(viaje => {
            if (!viaje.fecha_asignacion) return false;
            const fechaViaje = new Date(viaje.fecha_asignacion);
            return fechaViaje >= hoy && fechaViaje < manana;
        });

        // Luego ordenar los viajes filtrados
        const priority: Record<string, number> = {
            asignado: 1,
            en_curso: 2,
            completado: 3,
            pendiente: 4,
            cancelado: 5
        };
        
        return [...viajesHoy].sort((a, b) => {
            const pa = priority[a.estado] ?? 99;
            const pb = priority[b.estado] ?? 99;
            if (pa !== pb) return pa - pb;
            const fa = a.fecha_asignacion ? new Date(a.fecha_asignacion).getTime() : 0;
            const fb = b.fecha_asignacion ? new Date(b.fecha_asignacion).getTime() : 0;
            return fb - fa;
        });
    }, [viajes]);

    // Templates para la tabla
    const folioBodyTemplate = useCallback((rowData: LogisticaViaje) => {
        return <span className="font-bold">{rowData.folio || '-'}</span>;
    }, []);

    const folioBcoBodyTemplate = useCallback((rowData: LogisticaViaje) => {
        return rowData.folio_bco || '-';
    }, []);

    const cantidadViajesBodyTemplate = useCallback((rowData: LogisticaViaje) => {
        return rowData.cantidad_viajes || '-';
    }, []);

    const fechaAsignacionBodyTemplate = useCallback((rowData: LogisticaViaje) => {
        if (!rowData.fecha_asignacion) return '-';
        const date = new Date(rowData.fecha_asignacion);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        return `${day}-${month}-${year}`;
    }, []);

    const numeroViajeBodyTemplate = useCallback((rowData: LogisticaViaje) => {
        return rowData.numero_viaje || '-';
    }, []);

    const clienteBodyTemplate = useCallback((rowData: LogisticaViaje) => {
        return rowData.cliente_nombre || '-';
    }, []);

    const operadorBodyTemplate = useCallback((rowData: LogisticaViaje) => {
        return rowData.operador_nombre || '-';
    }, []);

    const origenBodyTemplate = useCallback((rowData: LogisticaViaje) => {
        return rowData.origen || '-';
    }, []);

    const destinoBodyTemplate = useCallback((rowData: LogisticaViaje) => {
        return rowData.destino || '-';
    }, []);

    const materialBodyTemplate = useCallback((rowData: LogisticaViaje) => {
        return rowData.material_nombre || '-';
    }, []);

    const m3BodyTemplate = useCallback((rowData: LogisticaViaje) => {
        return rowData.m3_nombre || '-';
    }, []);

    const horarioBodyTemplate = useCallback((rowData: LogisticaViaje) => {
        const horarioMap = {
            'D': 'Día',
            'N': 'Noche'
        };
        return horarioMap[rowData.horario as keyof typeof horarioMap] || rowData.horario || '-';
    }, []);

    const rentaBodyTemplate = useCallback((rowData: LogisticaViaje) => {
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
    }, []);

    const estadoBodyTemplate = useCallback((rowData: LogisticaViaje) => {
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

        const estadoOptions = [
            { label: 'Pendiente', value: 'pendiente' },
            { label: 'Asignado', value: 'asignado' },
            { label: 'En Curso', value: 'en_curso' },
            { label: 'Completado', value: 'completado' },
            { label: 'Cancelado', value: 'cancelado' }
        ];

        const estadoLabel = estadoOptions.find(e => e.value === rowData.estado)?.label || rowData.estado;
        
        return (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getEstadoColor(rowData.estado)}`}>
                {estadoLabel}
            </span>
        );
    }, []);

    // Estadísticas en cards
    const StatCard = ({ title, value, icon, color, bgColor }: any) => (
        <div className={`col-6 sm:col-4 md:col-3 lg:col-2`}>
            <div className={`card p-2 sm:p-3 ${bgColor}`}>
                <div className="flex justify-content-between align-items-center">
                    <div className="flex-1 min-w-0">
                        <span className="block text-500 font-medium text-xs sm:text-sm truncate">{title}</span>
                        <div className="text-900 font-medium text-xl sm:text-2xl">{value}</div>
                    </div>
                    <div className={`flex align-items-center justify-content-center ${color} border-round`} style={{ width: '2.5rem', height: '2.5rem', minWidth: '2.5rem' }}>
                        <i className={`${icon} text-xl`} />
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="card">
            <Toast ref={toast} />

            <div className="flex justify-content-between align-items-center mb-3">
                <h2 className="text-xl sm:text-2xl m-0">Gestión de Viajes</h2>
                <Button 
                    icon="pi pi-refresh" 
                    severity="secondary" 
                    rounded 
                    label="Recargar" 
                    onClick={cargarDatos} 
                    loading={loading}
                    tooltip="Recargar datos"
                    tooltipOptions={{ position: 'top' }}
                    className="p-button-sm"
                />
            </div>

            {/* Cards de estadísticas - Siempre visibles */}
            <div className="grid mb-3">
                <StatCard 
                    title="Total" 
                    value={estadisticas.total} 
                    icon="pi pi-truck" 
                    color="bg-blue-100" 
                    bgColor="bg-blue-50" 
                />
                <StatCard 
                    title="Asignados" 
                    value={estadisticas.asignados} 
                    icon="pi pi-users" 
                    color="bg-blue-200" 
                    bgColor="bg-blue-100" 
                />
                <StatCard 
                    title="En Curso" 
                    value={estadisticas.enCurso} 
                    icon="pi pi-spinner" 
                    color="bg-cyan-100" 
                    bgColor="bg-cyan-50" 
                />
                <StatCard 
                    title="Completados" 
                    value={estadisticas.completados} 
                    icon="pi pi-check-circle" 
                    color="bg-green-100" 
                    bgColor="bg-green-50" 
                />
                <StatCard 
                    title="Pendientes" 
                    value={estadisticas.pendientes} 
                    icon="pi pi-clock" 
                    color="bg-orange-100" 
                    bgColor="bg-orange-50" 
                />
                <StatCard 
                    title="Cancelados" 
                    value={estadisticas.cancelados} 
                    icon="pi pi-times-circle" 
                    color="bg-red-100" 
                    bgColor="bg-red-50" 
                />
            </div>

            {/* Vista Móvil - Solo tarjetas de estadísticas (ocultar tabla en móvil) */}
            <div className="block md:hidden">
                <div className="text-center text-500 p-3">
                    <i className="pi pi-table text-2xl mr-2" />
                    <span>Visualiza los detalles en computadora</span>
                </div>
            </div>

            {/* Vista Desktop - Tabla completa */}
            <div className="hidden md:block">
                <DataTable
                    value={viajesOrdenados}
                    dataKey="id"
                    paginator
                    rows={10}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    className="datatable-responsive"
                    paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                    currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} viajes"
                    emptyMessage="No hay viajes registrados"
                    responsiveLayout="scroll"
                    loading={loading}
                    globalFilterFields={['folio', 'cliente_nombre', 'operador_nombre', 'origen', 'destino']}
                >
                    <Column field="folio" header="Folio" sortable body={folioBodyTemplate} />
                    {/* <Column field="folio_bco" header="Folio Bco" sortable body={folioBcoBodyTemplate} /> */}
                    {/* <Column field="cantidad_viajes" header="Cant. Viajes" sortable body={cantidadViajesBodyTemplate} /> */}
                    <Column field="fecha_asignacion" header="Fecha Asignación" sortable body={fechaAsignacionBodyTemplate} />
                    {/* <Column field="numero_viaje" header="Número de Viaje" sortable body={numeroViajeBodyTemplate} /> */}
                    <Column field="cliente_nombre" header="Cliente" sortable body={clienteBodyTemplate} />
                    <Column field="operador_nombre" header="Operador" sortable body={operadorBodyTemplate} />
                    <Column field="origen" header="Origen" sortable body={origenBodyTemplate} />
                    <Column field="destino" header="Destino" sortable body={destinoBodyTemplate} />
                    <Column field="material_nombre" header="Material" sortable body={materialBodyTemplate} />
                    <Column field="m3_nombre" header="M3" sortable body={m3BodyTemplate} />
                    <Column field="horario" header="Horario" sortable body={horarioBodyTemplate} />
                    {/* <Column field="en_renta" header="Renta" sortable body={rentaBodyTemplate} /> */}
                    <Column field="estado" header="Estado" sortable body={estadoBodyTemplate} />
                </DataTable>
            </div>

            {/* Dialog para editar */}
            <Dialog
                visible={editDialog}
                header="Editar Viaje Logístico"
                modal
                className="p-fluid"
                style={{ width: '90%', maxWidth: '500px' }}
                footer={
                    <>
                        <Button 
                            label="Cancelar" 
                            icon="pi pi-times" 
                            text 
                            onClick={cerrarDialog}
                        />
                        <Button 
                            label="Guardar" 
                            icon="pi pi-check" 
                            text 
                            onClick={guardarEdicion}
                            loading={loadingEdit}
                        />
                    </>
                }
                onHide={cerrarDialog}
            >
                <div className="field">
                    <label htmlFor="folio">Folio</label>
                    <InputText
                        id="folio"
                        value={folio}
                        onChange={(e) => setFolio(e.target.value)}
                        placeholder="Ingresa el folio"
                    />
                </div>

                <div className="field">
                    <label htmlFor="folio_bco">Folio Bancario</label>
                    <InputText
                        id="folio_bco"
                        value={folioBco}
                        onChange={(e) => setFolioBco(e.target.value)}
                        placeholder="Ingresa el folio bancario"
                    />
                </div>

                <div className="field">
                    <label htmlFor="numero_viaje">Número de Viaje</label>
                    <InputText
                        id="numero_viaje"
                        value={numeroViaje}
                        onChange={(e) => setNumeroViaje(e.target.value)}
                        placeholder="Ingresa el número de viaje"
                    />
                </div>

                <div className="field">
                    <label htmlFor="cantidad_viajes">Cantidad de Viajes</label>
                    <InputNumber
                        id="cantidad_viajes"
                        value={cantidadViajes}
                        onValueChange={(e) => setCantidadViajes(e.value ?? null)}
                        placeholder="Ingresa la cantidad de viajes"
                        min={0}
                        useGrouping={false}
                        className="w-full"
                        mode="decimal"
                    />
                </div>
                
                {editViaje && (
                    <div className="field">
                        <label>Información del Viaje</label>
                        <div className="text-sm text-500 p-2 bg-gray-50 border-round">
                            <div><strong>Cliente:</strong> {editViaje.cliente_nombre}</div>
                            <div><strong>Operador:</strong> {editViaje.operador_nombre}</div>
                            <div><strong>Origen - Destino:</strong> {editViaje.origen} - {editViaje.destino}</div>
                            <div><strong>Material:</strong> {editViaje.material_nombre}</div>
                            <div><strong>M3:</strong> {editViaje.m3_nombre}</div>
                            <div><strong>Estado:</strong> {editViaje.estado}</div>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default LogisticaAdmin;