// app/(main)/pages/crud/Logistica/LogisticaTabla.tsx
'use client';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Toast } from 'primereact/toast';
import React, { useEffect, useRef, useState } from 'react';
import { 
    fetchViajesLogistica, 
    LogisticaViaje,
    fetchPreciosOrigenDestino,
    fetchMateriales,
    fetchM3,
    fetchOperadores,
    fetchInvitados,
    fetchClientes
} from '../../../../../Services/BD/logistica/logisticaService';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { supabase } from '../../../../../Services/superbase.service';
import { createViaje } from '../../../../../Services/BD/viajeService';

const LogisticaTabla = () => {
    const [viajes, setViajes] = useState<LogisticaViaje[]>([]);
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);

    // Estados para el diálogo de edición
    const [editDialog, setEditDialog] = useState(false);
    const [editViaje, setEditViaje] = useState<LogisticaViaje | null>(null);
    const [folioBco, setFolioBco] = useState('');
    const [submittedEdit, setSubmittedEdit] = useState(false);
    const [loadingEdit, setLoadingEdit] = useState(false);

    // Cargar datos
    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        try {
            const viajesData = await fetchViajesLogistica();
            const viajesCompletados = viajesData.filter(v => v.estado === 'completado');
            setViajes(viajesCompletados);
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

    // Función para Editar
    const handleEditar = (rowData: LogisticaViaje) => {
        setEditViaje(rowData);
        setFolioBco(rowData.folio_bco || '');
        setSubmittedEdit(false);
        setEditDialog(true);
    };

    // Función para guardar la edición
    const guardarEdicion = async () => {
        setSubmittedEdit(true);
        
        // if (!folioBco || folioBco.trim() === '') {
        //     toast.current?.show({
        //         severity: 'error',
        //         summary: 'Error',
        //         detail: 'El campo Folio Bco es obligatorio',
        //         life: 3000
        //     });
        //     return;
        // }

        try {
            setLoadingEdit(true);
            
            const { error } = await supabase
                .from('logistica')
                .update({ folio_bco: folioBco })
                .eq('id', editViaje?.id);

            if (error) {
                console.error('Error actualizando folio_bco:', error);
                toast.current?.show({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Error al actualizar el folio bancario',
                    life: 3000
                });
                return;
            }

            setViajes(viajes.map(v => 
                v.id === editViaje?.id ? { ...v, folio_bco: folioBco } : v
            ));

            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Folio bancario actualizado correctamente',
                life: 3000
            });

            setEditDialog(false);
            setEditViaje(null);
            setFolioBco('');
            
        } catch (error) {
            console.error('Error:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al actualizar el folio bancario',
                life: 3000
            });
        } finally {
            setLoadingEdit(false);
        }
    };

    // Función para Aprobar - Crear el viaje en la tabla viajes
    const handleAprobar = async (rowData: LogisticaViaje) => {
        try {
            // 1. Obtener los datos necesarios para calcular caphrsviajes
            const [preciosData, materialesData, m3Data] = await Promise.all([
                fetchPreciosOrigenDestino(),
                fetchMateriales(),
                fetchM3()
            ]);

            // 2. Buscar el precio, material y m3 correspondientes
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

            // 3. Calcular caphrsviajes
            let caphrsviajes;
            if (rowData.en_renta && rowData.horas_renta) {
                caphrsviajes = precio.precio_unidad * m3Item.metros_cubicos * rowData.horas_renta;
            } else {
                caphrsviajes = precio.precio_unidad * m3Item.metros_cubicos;
            }

            // 4. Preparar el objeto para crear el viaje con los tipos correctos
            const fechaViaje = rowData.fecha_asignacion 
                ? new Date(rowData.fecha_asignacion).toISOString().split('T')[0] 
                : new Date().toISOString().split('T')[0];
            
            // Convertir numero_viaje a número o null
            const numeroViaje = rowData.numero_viaje != null && rowData.numero_viaje !== ''
                ? Number(rowData.numero_viaje)
                : null;

            // Asegurar que id_invitado sea string | null (no number)
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
                id_operador: rowData.id_operador,
                id_invitado: idInvitado, // ← Convertir a string | null
                en_renta: rowData.en_renta || false,
                horas_renta: rowData.horas_renta || null,
                horario: rowData.horario || 'D',
                numero_viaje: numeroViaje
            };

            // 5. Crear el viaje en la tabla viajes
            const result = await createViaje(nuevoViaje);

            if (result) {
                toast.current?.show({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: `Viaje aprobado y creado correctamente con folio: ${rowData.folio}`,
                    life: 3000
                });

                // 6. ELIMINAR el registro de la tabla logistica
                const { error: deleteError } = await supabase
                    .from('logistica')
                    .delete()
                    .eq('id', rowData.id);

                if (deleteError) {
                    console.error('Error actualizando estado en logistica:', deleteError);
                }

                // 7. Recargar la tabla para reflejar los cambios
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
    };

    // Función para Rechazar - Eliminar de la tabla logistica
    const handleRechazar = async (rowData: LogisticaViaje) => {
        console.log('Rechazar viaje:', rowData);
        
        try {
            // 1. ELIMINAR el registro de la tabla logistica
            const { error: deleteError } = await supabase
                .from('logistica')
                .delete()
                .eq('id', rowData.id);

            if (deleteError) {
                console.error('Error eliminando registro de logistica:', deleteError);
                toast.current?.show({
                    severity: 'error',
                    summary: 'Error',
                    detail: `Error al rechazar el viaje: ${rowData.folio}`,
                    life: 3000
                });
                return;
            }

            // 2. Mostrar mensaje de éxito
            toast.current?.show({
                severity: 'info',
                summary: 'Rechazado',
                detail: `Viaje rechazado correctamente con folio: ${rowData.folio}`,
                life: 3000
            });

            // 3. Recargar la tabla para reflejar los cambios
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
    };

    // Template de acciones con botones
    const accionesBodyTemplate = (rowData: LogisticaViaje) => {
        return (
            <div className="flex gap-2">
                <Button 
                    icon="pi pi-pencil" 
                    rounded 
                    size="small"
                    tooltip="Editar Folio Bco"
                    severity="info" 
                    onClick={() => handleEditar(rowData)}
                    tooltipOptions={{ position: 'top' }}
                />
                <Button
                    icon="pi pi-check"
                    severity="success"
                    rounded
                    size="small"
                    onClick={() => handleAprobar(rowData)}
                    tooltip="Aprobar"
                    tooltipOptions={{ position: 'top' }}
                />
                <Button
                    icon="pi pi-times"
                    severity="danger"
                    rounded
                    size="small"
                    onClick={() => handleRechazar(rowData)}
                    tooltip="Rechazar"
                    tooltipOptions={{ position: 'top' }}
                />
            </div>
        );
    };

    // Templates para la tabla
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

            <div className="flex justify-content-between align-items-center mb-3">
                <div className="flex align-items-center gap-2">
                    <Button 
                        icon="pi pi-refresh" 
                        severity="secondary" 
                        rounded 
                        label="Recargar" 
                        onClick={cargarDatos} 
                        loading={loading}
                        tooltip="Recargar datos"
                        tooltipOptions={{ position: 'top' }}
                    />
                </div>
            </div>
            
            <DataTable
                value={viajes}
                dataKey="id"
                paginator
                rows={10}
                rowsPerPageOptions={[5, 10, 25]}
                className="datatable-responsive"
                paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} viajes completados"
                emptyMessage="No hay viajes completados"
                responsiveLayout="scroll"
                loading={loading}
                globalFilterFields={['folio', 'cliente_nombre', 'operador_nombre', 'origen', 'destino']}
            >
                <Column field="folio" header="Folio" sortable body={folioBodyTemplate} />
                <Column field="folio_bco" header="Folio Bco" sortable body={folioBcoBodyTemplate} />
                <Column field="fecha_asignacion" header="Fecha Asignación" sortable body={fechaAsignacionBodyTemplate} />
                <Column field="numero_viaje" header="Número de Viaje" sortable body={numeroViajeBodyTemplate} />
                <Column field="cliente_nombre" header="Cliente" sortable body={clienteBodyTemplate} />
                <Column field="operador_nombre" header="Operador" sortable body={operadorBodyTemplate} />
                <Column field="origen" header="Origen" sortable body={origenBodyTemplate} />
                <Column field="destino" header="Destino" sortable body={destinoBodyTemplate} />
                <Column field="material_nombre" header="Material" sortable body={materialBodyTemplate} />
                <Column field="m3_nombre" header="M3" sortable body={m3BodyTemplate} />
                <Column field="horario" header="Horario" sortable body={horarioBodyTemplate} />
                <Column field="en_renta" header="Renta" sortable body={rentaBodyTemplate} />
                <Column field="estado" header="Estado" sortable body={estadoBodyTemplate} />
                <Column header="Acciones" body={accionesBodyTemplate} headerStyle={{ minWidth: '120px' }} style={{ textAlign: 'center' }} />
            </DataTable>

            {/* Dialog para editar Folio Bco */}
            <Dialog
                visible={editDialog}
                header="Editar Folio Bancario"
                modal
                className="p-fluid"
                style={{ width: '450px' }}
                footer={
                    <>
                        <Button 
                            label="Cancelar" 
                            icon="pi pi-times" 
                            text 
                            onClick={() => {
                                setEditDialog(false);
                                setEditViaje(null);
                                setFolioBco('');
                                setSubmittedEdit(false);
                            }} 
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
                onHide={() => {
                    setEditDialog(false);
                    setEditViaje(null);
                    setFolioBco('');
                    setSubmittedEdit(false);
                }}
            >
                <div className="field">
                    <label htmlFor="folio_bco">Folio Bancario </label>
                    <InputText
                        id="folio_bco"
                        value={folioBco}
                        onChange={(e) => setFolioBco(e.target.value)}
                        placeholder="Ingresa el folio bancario"
                        required
                        className={submittedEdit && !folioBco ? 'p-invalid' : ''}
                    />
                    {/* {submittedEdit && !folioBco && (
                        <small className="p-error">El folio bancario es obligatorio</small>
                    )} */}
                </div>
                
                {editViaje && (
                    <div className="field">
                        <label>Información del Viaje</label>
                        <div className="text-sm text-500">
                            <div><strong>Folio:</strong> {editViaje.folio}</div>
                            <div><strong>Cliente:</strong> {editViaje.cliente_nombre}</div>
                            <div><strong>Operador:</strong> {editViaje.operador_nombre}</div>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default LogisticaTabla;