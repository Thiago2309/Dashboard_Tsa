'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import React, { useEffect, useRef, useState } from 'react';
import {
    fetchOrigenDestino,
    createOrigenDestino,
    updateOrigenDestino,
    deleteOrigenDestino,
    OrigenDestino,
    toggleStatusOrigenDestino,
    actualizarPrecioOrigenDestinoDesdeFecha,
    contarViajesAfectadosPorCambioPrecio,
    ResultadoCambioPrecio
} from '../../../../Services/BD/origenDestinoService';
import { Calendar } from 'primereact/calendar';
import { fetchHistorialDeRuta, FECHA_BASE_HISTORIAL, PrecioHistorial } from '../../../../Services/BD/precioHistorialService';
import { InputNumber } from 'primereact/inputnumber';
import { Tag } from 'primereact/tag';
import { Checkbox } from 'primereact/checkbox';
import { DataTableFilterMeta } from 'primereact/datatable';

const OrigenDestinoCrud = () => {
    let emptyOrigenDestino: OrigenDestino = {
        nombreorigen: '',
        nombredestino: '',
        precio_unidad: 0,
        precio_materia: 0,
        status: true,
    };

    const [origenDestinoList, setOrigenDestinoList] = useState<OrigenDestino[]>([]);
    const [origenDestinoDialog, setOrigenDestinoDialog] = useState(false);
    const [deleteOrigenDestinoDialog, setDeleteOrigenDestinoDialog] = useState(false);
    const [deleteOrigenDestinosDialog, setDeleteOrigenDestinosDialog] = useState(false);
    const [origenDestino, setOrigenDestino] = useState<OrigenDestino>(emptyOrigenDestino);
    const [selectedOrigenDestinos, setSelectedOrigenDestinos] = useState<OrigenDestino[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });

    // INC-0025 · Cambio de precio a partir de una fecha
    const [precioDialog, setPrecioDialog] = useState(false);
    const [rutaPrecio, setRutaPrecio] = useState<OrigenDestino | null>(null);
    const [nuevoFlete, setNuevoFlete] = useState<number>(0);
    const [nuevoMaterial, setNuevoMaterial] = useState<number>(0);
    const [fechaDesde, setFechaDesde] = useState<Date>(new Date());
    const [vistaPrevia, setVistaPrevia] = useState<ResultadoCambioPrecio | null>(null);
    const [aplicandoPrecio, setAplicandoPrecio] = useState(false);
    const [historialRuta, setHistorialRuta] = useState<PrecioHistorial[]>([]);

    useEffect(() => {
        fetchOrigenDestino().then(setOrigenDestinoList);
    }, []);

    const fechaAIso = (fecha: Date) => `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

    // Vista previa de cuántos viajes se recalcularían cada vez que cambia la ruta o la fecha.
    useEffect(() => {
        if (!precioDialog || !rutaPrecio?.id) return;
        setVistaPrevia(null);
        contarViajesAfectadosPorCambioPrecio(rutaPrecio.id, fechaAIso(fechaDesde))
            .then(setVistaPrevia)
            .catch(() => setVistaPrevia(null));
    }, [precioDialog, rutaPrecio, fechaDesde]);

    const formatoFecha = (iso: string) => (iso === FECHA_BASE_HISTORIAL ? 'Precio inicial' : iso.split('-').reverse().join('/'));

    const abrirCambioPrecio = (ruta: OrigenDestino) => {
        setRutaPrecio(ruta);
        setHistorialRuta([]);
        fetchHistorialDeRuta(ruta.id!)
            .then(setHistorialRuta)
            .catch(() => setHistorialRuta([]));
        setNuevoFlete(ruta.precio_unidad);
        setNuevoMaterial(ruta.precio_materia ?? 0);
        setFechaDesde(new Date());
        setPrecioDialog(true);
    };

    const aplicarCambioPrecio = async () => {
        if (!rutaPrecio?.id || nuevoFlete <= 0 || nuevoMaterial < 0) return;

        setAplicandoPrecio(true);
        try {
            const resultado = await actualizarPrecioOrigenDestinoDesdeFecha(rutaPrecio.id, nuevoFlete, nuevoMaterial, fechaAIso(fechaDesde));
            // El catálogo muestra el precio vigente HOY (si el cambio es a futuro, sigue el actual hasta esa fecha).
            const vigenteHoy = resultado.precioCatalogo;
            if (vigenteHoy) {
                setOrigenDestinoList((prev) => prev.map((o) => (o.id === rutaPrecio.id ? { ...o, precio_unidad: vigenteHoy.precio_unidad, precio_materia: vigenteHoy.precio_materia } : o)));
            }
            toast.current?.show({
                severity: 'success',
                summary: 'Precio actualizado',
                detail: `Se recalcularon ${resultado.viajesActualizados} viaje(s).${resultado.viajesProtegidos ? ` ${resultado.viajesProtegidos} facturado(s)/pagado(s) se dejaron igual.` : ''}`,
                life: 5000
            });
            setPrecioDialog(false);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al actualizar el precio. Revisa e intenta de nuevo.', life: 4000 });
        } finally {
            setAplicandoPrecio(false);
        }
    };

    const openNew = () => {
        setOrigenDestino(emptyOrigenDestino);
        setSubmitted(false);
        setOrigenDestinoDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setOrigenDestinoDialog(false);
    };

    const hideDeleteOrigenDestinoDialog = () => {
        setDeleteOrigenDestinoDialog(false);
    };

    const hideDeleteOrigenDestinosDialog = () => {
        setDeleteOrigenDestinosDialog(false);
    };

    const saveOrigenDestino = async () => {
        setSubmitted(true);
    
        if (origenDestino.nombreorigen.trim() && origenDestino.nombredestino.trim() && origenDestino.precio_unidad > 0 && origenDestino.precio_materia >= 0) {
            try {
                if (origenDestino.id) {
                    const updatedOrigenDestino = await updateOrigenDestino(origenDestino);
                    setOrigenDestinoList(origenDestinoList.map(o => o.id === updatedOrigenDestino.id ? updatedOrigenDestino : o));
                    toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Origen - Destino Actualizado', life: 3000 });
                } else {
                    const newOrigenDestino = await createOrigenDestino(origenDestino);
                    setOrigenDestinoList([...origenDestinoList, newOrigenDestino]);
                    toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Origen - Destino Creado', life: 3000 });
                }
                setOrigenDestinoDialog(false);
                setOrigenDestino(emptyOrigenDestino);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error saving Origen Destino', life: 3000 });
            }
        }
    };

    // Función para alternar status
    const toggleStatus = async (origenDestino: OrigenDestino) => {
        try {
            const nuevoEstado = !origenDestino.status;
            const updated = await toggleStatusOrigenDestino(origenDestino.id!, nuevoEstado);
            setOrigenDestinoList(origenDestinoList.map(o => o.id === updated.id ? updated : o));
            
            toast.current?.show({ 
                severity: 'success', 
                summary: 'Successful', 
                detail: `Origen Destino ${nuevoEstado ? 'activado' : 'desactivado'}`, 
                life: 3000 
            });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error cambiando status', life: 3000 });
        }
    };

    const editOrigenDestino = (origenDestino: OrigenDestino) => {
        setOrigenDestino({ ...origenDestino });
        setOrigenDestinoDialog(true);
    };

    const confirmDeleteOrigenDestino = (origenDestino: OrigenDestino) => {
        setOrigenDestino(origenDestino);
        setDeleteOrigenDestinoDialog(true);
    };

    // Modificada para deshabilitar en lugar de eliminar
    const deleteOrigenDestinoConfirmado = async () => {
        try {
            // En lugar de eliminar, deshabilitamos
            const deshabilitado = await toggleStatusOrigenDestino(origenDestino.id!, false);
            setOrigenDestinoList(origenDestinoList.map(o => o.id === deshabilitado.id ? deshabilitado : o));
            
            setDeleteOrigenDestinoDialog(false);
            setOrigenDestino(emptyOrigenDestino);
            
            toast.current?.show({ 
                severity: 'success', 
                summary: 'Successful', 
                detail: 'Origen Destino deshabilitado', 
                life: 3000 
            });
        } catch (error) {
            toast.current?.show({ 
                severity: 'error', 
                summary: 'Error', 
                detail: 'Error deshabilitando Origen Destino', 
                life: 3000 
            });
        }
    };

    const exportCSV = () => {
        dt.current?.exportCSV();
    };

    const confirmDeleteSelected = () => {
        setDeleteOrigenDestinosDialog(true);
    };

    // Modificada para deshabilitar múltiples en lugar de eliminar
    const deleteSelectedOrigenDestinos = async () => {
        try {
            // Deshabilitar todos los seleccionados
            await Promise.all(
                selectedOrigenDestinos.map(o => 
                    toggleStatusOrigenDestino(o.id!, false)
                )
            );
            
            // Actualizar la lista
            setOrigenDestinoList(prev => 
                prev.map(o => 
                    selectedOrigenDestinos.some(s => s.id === o.id) 
                        ? { ...o, status: false } 
                        : o
                )
            );
            
            setDeleteOrigenDestinosDialog(false);
            setSelectedOrigenDestinos([]);
            
            toast.current?.show({ 
                severity: 'success', 
                summary: 'Successful', 
                detail: 'Origen Destinos deshabilitados', 
                life: 3000 
            });
        } catch (error) {
            toast.current?.show({ 
                severity: 'error', 
                summary: 'Error', 
                detail: 'Error deshabilitando Origen Destinos', 
                life: 3000 
            });
        }
    };

    const leftToolbarTemplate = () => {
        return (
            <React.Fragment>
                <div className="my-2">
                    <Button label="Nuevo" icon="pi pi-plus" severity="info" className="mr-2" onClick={openNew} />
                    <Button label="Deshabilitar" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} disabled={!selectedOrigenDestinos || !selectedOrigenDestinos.length} />
                </div>
            </React.Fragment>
        );
    };

    const rightToolbarTemplate = () => {
        return (
            <React.Fragment>
                <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={exportCSV} />
            </React.Fragment>
        );
    };

    const idBodyTemplate = (rowData: OrigenDestino) => {
        return (
            <>
                <span className="p-column-title">Id</span>
                {rowData.id}
            </>
        );
    };

    const nombreorigenBodyTemplate = (rowData: OrigenDestino) => {
        return (
            <>
                <span className="p-column-title">Origen</span>
                {rowData.nombreorigen}
            </>
        );
    };

    const nombredestinoBodyTemplate = (rowData: OrigenDestino) => {
        return (
            <>
                <span className="p-column-title">Destino</span>
                {rowData.nombredestino}
            </>
        );
    };

    const precio_unidadBodyTemplate = (rowData: OrigenDestino) => {
        return (
            <>
                <span className="p-column-title">Precio Unidad</span>
                $ {rowData.precio_unidad}
            </>
        );
    };

    // Template para columna de status
    const statusBodyTemplate = (rowData: OrigenDestino) => {
        return (
            <>
                <span className="p-column-title">Estado</span>
                <Tag 
                    value={rowData.status ? 'Activo' : 'Inactivo'} 
                    severity={rowData.status ? 'success' : 'danger'} 
                />
            </>
        );
    };

    const precio_materiaBodyTemplate = (rowData: OrigenDestino) => {
        return (
            <>
                <span className="p-column-title">Precio Material</span>
                $ {rowData.precio_materia}
            </>
        );
    };

    const actionBodyTemplate = (rowData: OrigenDestino) => {
        return (
            <>
                <Button 
                    icon="pi pi-pencil" 
                    rounded 
                    severity="info" 
                    className="mr-2" 
                    onClick={() => editOrigenDestino(rowData)} 
                />
                <Button
                    icon="pi pi-dollar"
                    rounded
                    severity="success"
                    className="mr-2"
                    onClick={() => abrirCambioPrecio(rowData)}
                    tooltip="Actualizar precio desde una fecha"
                    tooltipOptions={{ position: 'top' }}
                />
                <Button
                    icon={rowData.status ? "pi pi-eye-slash" : "pi pi-eye"}  
                    rounded 
                    severity="warning" 
                    className="mr-2"
                    onClick={() => toggleStatus(rowData)} 
                    tooltip={rowData.status ? "Desactivar" : "Activar"}
                    tooltipOptions={{ position: 'top' }}
                />
                <Button 
                    icon="pi pi-trash" 
                    rounded 
                    severity="danger" 
                    onClick={() => confirmDeleteOrigenDestino(rowData)} 
                />
            </>
        );
    };

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Origen-Destino</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText
                    type="search"
                    onInput={(e) =>
                        setFilters({
                            ...filters,
                            global: { value: e.currentTarget.value, matchMode: 'contains' }
                        })
                    }
                    placeholder="Buscar..."
                />
            </span>
        </div>
    );

    const origenDestinoDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveOrigenDestino} />
        </>
    );

    const deleteOrigenDestinoDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDeleteOrigenDestinoDialog} />
            <Button label="Deshabilitar" icon="pi pi-check" text onClick={deleteOrigenDestinoConfirmado} />
        </>
    );

    const deleteOrigenDestinosDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDeleteOrigenDestinosDialog} />
            <Button label="Deshabilitar" icon="pi pi-check" text onClick={deleteSelectedOrigenDestinos} />
        </>
    );

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} right={rightToolbarTemplate}></Toolbar>

                    <DataTable
                        ref={dt}
                        value={origenDestinoList}
                        selection={selectedOrigenDestinos}
                        onSelectionChange={(e) => setSelectedOrigenDestinos(e.value)}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        className="datatable-responsive"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
                        filters={filters} // PARA EL DE BUSQUEDA
                        filterDisplay="menu"
                        emptyMessage="No se encontraron registros."
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '4rem' }}></Column>
                        <Column field="id" header="Id" sortable body={idBodyTemplate}></Column>
                        <Column field="nombreorigen" header="Origen" sortable body={nombreorigenBodyTemplate}></Column>
                        <Column field="nombredestino" header="Destino" sortable body={nombredestinoBodyTemplate}></Column>
                        <Column field="precio_unidad" header="Precio Flete" sortable body={precio_unidadBodyTemplate}></Column>
                        <Column field="precio_materia" header="Precio Material" sortable body={precio_materiaBodyTemplate}></Column>
                        <Column field="status" header="Estado" sortable body={statusBodyTemplate}></Column>
                        <Column body={actionBodyTemplate} headerStyle={{ minWidth: '15rem' }}></Column>
                    </DataTable>

                    <Dialog 
                        visible={origenDestinoDialog} 
                        style={{ width: '450px' }} 
                        header="Detalles de Origen-Destino" 
                        modal 
                        className="p-fluid" 
                        footer={origenDestinoDialogFooter} 
                        onHide={hideDialog}
                    >
                        <div className="field">
                            <label htmlFor="nombreorigen">Origen</label>
                            <InputText
                                id="nombreorigen"
                                value={origenDestino.nombreorigen}
                                onChange={(e) => setOrigenDestino({ ...origenDestino, nombreorigen: e.target.value })}
                                required
                                className={submitted && !origenDestino.nombreorigen ? 'p-invalid' : ''}
                            />
                            {submitted && !origenDestino.nombreorigen && <small className="p-invalid">Origen es requerido.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="nombredestino">Destino</label>
                            <InputText
                                id="nombredestino"
                                value={origenDestino.nombredestino}
                                onChange={(e) => setOrigenDestino({ ...origenDestino, nombredestino: e.target.value })}
                                required
                                className={submitted && !origenDestino.nombredestino ? 'p-invalid' : ''}
                            />
                            {submitted && !origenDestino.nombredestino && <small className="p-invalid">Destino es requerido.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="precio_unidad">Precio Flete</label>
                            <InputNumber 
                                id="precio_unidad"
                                value={origenDestino.precio_unidad}
                                onValueChange={(e) => setOrigenDestino({ ...origenDestino, precio_unidad: e.value || 0 })}
                                mode="decimal"
                                minFractionDigits={2}
                                maxFractionDigits={2}
                                min={0}
                            />
                            {submitted && origenDestino.precio_unidad <= 0 && <small className="p-invalid">Precio flete debe ser mayor a 0.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="precio_materia">Precio Material</label>
                            <InputNumber 
                                id="precio_materia"
                                value={origenDestino.precio_materia}
                                onValueChange={(e) => setOrigenDestino({ ...origenDestino, precio_materia: e.value || 0 })}
                                mode="decimal"
                                minFractionDigits={2}
                                maxFractionDigits={2}
                                min={0}
                            />
                            {submitted && origenDestino.precio_materia < 0 && <small className="p-invalid">Precio material no puede ser negativo.</small>}
                        </div>
                        {origenDestino.id && (
                            <small className="block mb-3 text-500">
                                Cambiar el precio aquí aplica desde hoy y solo a los viajes que se capturen nuevos (queda en el historial). Para recalcular los viajes desde una fecha usa el botón <i className="pi pi-dollar" /> Actualizar precio.
                            </small>
                        )}
                        {origenDestino.id && (
                            <div className="field-checkbox">
                                <Checkbox
                                    inputId="status"
                                    checked={origenDestino.status ?? true}
                                    onChange={(e) => setOrigenDestino({ ...origenDestino, status: e.checked ?? true })}
                                />
                                <label htmlFor="status" className="ml-2">Activo</label>
                            </div>
                        )}
                    </Dialog>

                    <Dialog
                        visible={precioDialog}
                        style={{ width: '480px' }}
                        header="Actualizar precio desde una fecha"
                        modal
                        className="p-fluid"
                        onHide={() => setPrecioDialog(false)}
                        footer={
                            <>
                                <Button label="Cancelar" icon="pi pi-times" text onClick={() => setPrecioDialog(false)} />
                                <Button label="Actualizar precio" icon="pi pi-check" onClick={aplicarCambioPrecio} loading={aplicandoPrecio} disabled={nuevoFlete <= 0 || nuevoMaterial < 0} />
                            </>
                        }
                    >
                        {rutaPrecio && (
                            <>
                                <p className="mb-3">
                                    <b>
                                        {rutaPrecio.nombreorigen} - {rutaPrecio.nombredestino}
                                    </b>
                                    <br />
                                    <small className="text-500">
                                        Precio actual: flete $ {rutaPrecio.precio_unidad} · material $ {rutaPrecio.precio_materia ?? 0}
                                    </small>
                                </p>
                                <div className="field">
                                    <label htmlFor="nuevo_flete">Nuevo Precio Flete</label>
                                    <InputNumber id="nuevo_flete" value={nuevoFlete} onValueChange={(e) => setNuevoFlete(e.value || 0)} mode="decimal" minFractionDigits={2} maxFractionDigits={2} min={0} className={nuevoFlete <= 0 ? 'p-invalid' : ''} />
                                </div>
                                <div className="field">
                                    <label htmlFor="nuevo_material">Nuevo Precio Material</label>
                                    <InputNumber id="nuevo_material" value={nuevoMaterial} onValueChange={(e) => setNuevoMaterial(e.value || 0)} mode="decimal" minFractionDigits={2} maxFractionDigits={2} min={0} />
                                </div>
                                <div className="field">
                                    <label htmlFor="fecha_desde">Aplicar a viajes desde</label>
                                    <Calendar id="fecha_desde" value={fechaDesde} onChange={(e) => e.value && setFechaDesde(e.value as Date)} dateFormat="dd/mm/yy" showIcon />
                                </div>
                                <div className="surface-100 border-round p-3 text-sm">
                                    {vistaPrevia ? (
                                        <>
                                            Se recalcularán <b>{vistaPrevia.viajesActualizados}</b> viaje(s) de esta ruta con fecha igual o posterior
                                            {vistaPrevia.fechaHasta ? (
                                                <>
                                                    {' '}
                                                    y anterior al <b>{formatoFecha(vistaPrevia.fechaHasta)}</b> (ahí empieza otro precio ya registrado, que no se toca)
                                                </>
                                            ) : null}
                                            .
                                            {vistaPrevia.viajesProtegidos > 0 && (
                                                <>
                                                    {' '}
                                                    <b>{vistaPrevia.viajesProtegidos}</b> facturado(s)/pagado(s) se dejan igual.
                                                </>
                                            )}
                                            <br />
                                            Los viajes anteriores a la fecha no se modifican. Ningún viaje se borra ni se mueve.
                                        </>
                                    ) : (
                                        <span>
                                            <i className="pi pi-spinner pi-spin mr-2" />
                                            Contando viajes...
                                        </span>
                                    )}
                                </div>

                                {historialRuta.length > 0 && (
                                    <div className="mt-3">
                                        <label className="block text-sm font-bold mb-2">Historial de precios de la ruta</label>
                                        <DataTable value={historialRuta} size="small" scrollable scrollHeight="180px">
                                            <Column header="Vigente desde" body={(h: PrecioHistorial) => formatoFecha(h.vigente_desde)}></Column>
                                            <Column header="Flete" body={(h: PrecioHistorial) => `$ ${h.precio_unidad}`}></Column>
                                            <Column header="Material" body={(h: PrecioHistorial) => `$ ${h.precio_materia}`}></Column>
                                        </DataTable>
                                    </div>
                                )}
                            </>
                        )}
                    </Dialog>

                    <Dialog
                        visible={deleteOrigenDestinoDialog}  
                        style={{ width: '450px' }} 
                        header="Confirmar" 
                        modal 
                        footer={deleteOrigenDestinoDialogFooter} 
                        onHide={hideDeleteOrigenDestinoDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {origenDestino && (
                                <span>
                                    ¿Estás seguro de deshabilitar <b>{origenDestino.nombreorigen} - {origenDestino.nombredestino}</b>?
                                    <br />
                                    <small>No aparecerá en los filtros pero permanecerá en la base de datos.</small>
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <Dialog 
                        visible={deleteOrigenDestinosDialog} 
                        style={{ width: '450px' }} 
                        header="Confirmar" 
                        modal 
                        footer={deleteOrigenDestinosDialogFooter} 
                        onHide={hideDeleteOrigenDestinosDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {origenDestino && (
                                <span>
                                    ¿Estás seguro de deshabilitar los {selectedOrigenDestinos.length} registros seleccionados?
                                    <br />
                                    <small>No aparecerán en los filtros pero permanecerán en la base de datos.</small>
                                </span>
                            )}
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default OrigenDestinoCrud;