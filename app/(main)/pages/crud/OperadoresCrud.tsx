'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { ToggleButton } from 'primereact/togglebutton';
import { Checkbox } from 'primereact/checkbox';
import { Password } from 'primereact/password';
import { DataTableFilterMeta } from 'primereact/datatable';
import React, { useEffect, useRef, useState, useCallback } from 'react'; // ← Agregar useCallback
import {
  fetchOperadores,
  createOperador,
  updateOperador,
  deleteOperador,
  toggleEstatusOperador,
  fetchRoles,
  Operador
} from '../../../../Services/BD/operadoresService';
import {
  fetchDepartamentosActivos,
  createDepartamento,
  fetchCeo,
  definirCeo,
  EmpleadoResumen
} from '../../../../Services/BD/departamentoService';
import {
  fetchPuestosActivos,
  createPuesto
} from '../../../../Services/BD/puestoService';
import { ModalDocumentosOperador } from './ModalDocumentosOperador';

const OperadoresCrud = () => {
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [operadorDialog, setOperadorDialog] = useState(false);
    const [deleteOperadorDialog, setDeleteOperadorDialog] = useState(false);
    const [deleteOperadoresDialog, setDeleteOperadoresDialog] = useState(false);
    const [operador, setOperador] = useState<Operador>({ 
      nombre: '', 
      puesto: 'Operador Góndola', 
      salario_base: 0, 
      estatus: true,
      descripcion: '',
      telefono: '',
      direccion: '',
      fecha_contratacion: '',
      acceso_sistema: false,
      email: '',
      pass: '',
      rol_id: null,
      camion_full: false,
      departamento_id: null,
      jefe_inmediato_id: null,
      es_ceo: false,
      puesto_id: null,
      es_externo: false
    });
    const [selectedOperadores, setSelectedOperadores] = useState<Operador[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const [loading, setLoading] = useState(false);
    const [roles, setRoles] = useState<{ id: number; nombre: string; descripcion: string }[]>([]);
    const [departamentos, setDepartamentos] = useState<{ id: number; nombre: string }[]>([]);
    const [puestos, setPuestos] = useState<{ id: number; nombre: string }[]>([]);
    const [ceoActual, setCeoActual] = useState<EmpleadoResumen | null>(null);
    const [nuevoDepartamentoDialog, setNuevoDepartamentoDialog] = useState(false);
    const [nuevoDepartamentoNombre, setNuevoDepartamentoNombre] = useState('');
    const [nuevoPuestoDialog, setNuevoPuestoDialog] = useState(false);
    const [nuevoPuestoNombre, setNuevoPuestoNombre] = useState('');
    const [guardandoCatalogo, setGuardandoCatalogo] = useState(false);
    const [documentosDialog, setDocumentosDialog] = useState(false);
    const [operadorDocumentos, setOperadorDocumentos] = useState<Operador | null>(null);
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    const getStatusBadgeClass = (estatus: boolean) => {
        return estatus ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    };

    const getAccessBadgeClass = (acceso: boolean) => {
        return acceso ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
    };

    // Usar useCallback para evitar recreación
    const cargarDatos = useCallback(async () => {
        try {
            const [operadoresData, rolesData, departamentosData, puestosData, ceoData] = await Promise.all([
                fetchOperadores(),
                fetchRoles(),
                fetchDepartamentosActivos(),
                fetchPuestosActivos(),
                fetchCeo()
            ]);
            setOperadores(operadoresData);
            setRoles(rolesData);
            setDepartamentos(departamentosData);
            setPuestos(puestosData);
            setCeoActual(ceoData);
        } catch (error) {
            console.error('Error cargando datos:', error);
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al cargar los datos',
                life: 3000
            });
        }
    }, []);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    const openNew = useCallback(() => {
        setOperador({ 
            nombre: '', 
            puesto: '', 
            salario_base: 0, 
            estatus: true,
            descripcion: '',
            telefono: '',
            direccion: '',
            fecha_contratacion: '',
            acceso_sistema: false,
            email: '',
            pass: '',
            rol_id: null,
            camion_full: false,
            departamento_id: null,
            jefe_inmediato_id: null,
            es_ceo: false,
            puesto_id: null,
            es_externo: false
        });
        setSubmitted(false);
        setOperadorDialog(true);
    }, []);

    const hideDialog = useCallback(() => {
        setSubmitted(false);
        setOperadorDialog(false);
    }, []);

    const hideDeleteOperadorDialog = useCallback(() => {
        setDeleteOperadorDialog(false);
    }, []);

    const hideDeleteOperadoresDialog = useCallback(() => {
        setDeleteOperadoresDialog(false);
    }, []);

    const saveOperador = useCallback(async () => {
        setSubmitted(true);

        // Validaciones básicas
        if (!operador.nombre.trim()) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'El nombre es requerido',
                life: 3000
            });
            return;
        }

        if (!operador.puesto_id) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'El puesto es requerido',
                life: 3000
            });
            return;
        }

        if (!operador.departamento_id) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'El departamento es requerido',
                life: 3000
            });
            return;
        }

        if (!operador.es_ceo && !operador.jefe_inmediato_id) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Debes seleccionar quién es su gerente (o marcarlo como CEO)',
                life: 3000
            });
            return;
        }

        // Validaciones para acceso al sistema
        if (operador.acceso_sistema) {
            if (!operador.id) {
                if (!operador.email || !operador.email.includes('@')) {
                    toast.current?.show({ 
                        severity: 'error', 
                        summary: 'Error', 
                        detail: 'Email válido es requerido para acceso al sistema', 
                        life: 3000 
                    });
                    return;
                }
                if (!operador.pass || operador.pass.length < 6) {
                    toast.current?.show({ 
                        severity: 'error', 
                        summary: 'Error', 
                        detail: 'La contraseña debe tener al menos 6 caracteres', 
                        life: 3000 
                    });
                    return;
                }
                if (!operador.rol_id) {
                    toast.current?.show({ 
                        severity: 'error', 
                        summary: 'Error', 
                        detail: 'Debes seleccionar un rol para el acceso al sistema', 
                        life: 3000 
                    });
                    return;
                }
            } else {
                if (operador.pass && operador.pass.length < 6) {
                    toast.current?.show({ 
                        severity: 'error', 
                        summary: 'Error', 
                        detail: 'La contraseña debe tener al menos 6 caracteres', 
                        life: 3000 
                    });
                    return;
                }
                if (operador.email && !operador.email.includes('@')) {
                    toast.current?.show({ 
                        severity: 'error', 
                        summary: 'Error', 
                        detail: 'Email válido es requerido', 
                        life: 3000 
                    });
                    return;
                }
            }
        }

        try {
            setLoading(true);

            const eraCeo = ceoActual?.id === operador.id;

            // Asegurar que camion_full sea booleano y que el texto de puesto quede sincronizado con el catálogo
            const operadorToSave = {
                ...operador,
                camion_full: operador.camion_full ?? false,
                es_externo: operador.es_externo ?? false,
                puesto: puestos.find(p => p.id === operador.puesto_id)?.nombre || operador.puesto,
                jefe_inmediato_id: operador.es_ceo ? null : operador.jefe_inmediato_id
            };

            let idGuardado: number | undefined;

            if (operador.id) {
                const updatedOperador = await updateOperador(operadorToSave);
                setOperadores(prev => prev.map(o => o.id === updatedOperador.id ? updatedOperador : o));
                idGuardado = updatedOperador.id;
                toast.current?.show({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: 'Empleado actualizado correctamente',
                    life: 3000
                });
            } else {
                // Crear nuevo operador
                const newOperador = await createOperador(operadorToSave);
                setOperadores([...operadores, newOperador]);
                idGuardado = newOperador.id;

                if (operador.acceso_sistema) {
                    const rolNombre = roles.find(r => r.id === operador.rol_id)?.nombre || '';
                    toast.current?.show({
                        severity: 'success',
                        summary: 'Éxito',
                        detail: `Empleado creado con acceso al sistema. Email: ${operador.email} - Rol: ${rolNombre}`,
                        life: 5000
                    });
                } else {
                    toast.current?.show({
                        severity: 'success',
                        summary: 'Éxito',
                        detail: 'Empleado creado correctamente (sin acceso al sistema)',
                        life: 3000
                    });
                }
            }

            // Sincronizar la designación de CEO
            if (operador.es_ceo && idGuardado) {
                await definirCeo(idGuardado);
            } else if (eraCeo && !operador.es_ceo) {
                await definirCeo(null);
            }

            setOperadorDialog(false);
            // Recargar lista
            const [operadoresActualizados, ceoActualizado] = await Promise.all([fetchOperadores(), fetchCeo()]);
            setOperadores(operadoresActualizados);
            setCeoActual(ceoActualizado);
        } catch (error: any) {
            console.error('Error:', error);
            toast.current?.show({ 
                severity: 'error', 
                summary: 'Error', 
                detail: error.message || 'Error al guardar el empleado', 
                life: 3000 
            });
        } finally {
            setLoading(false);
        }
    }, [operador, roles, puestos, ceoActual, operadores]);

    const editOperador = useCallback((operadorSeleccionado: Operador) => {
        setOperador({
            ...operadorSeleccionado,
            camion_full: operadorSeleccionado.camion_full ?? false,
            es_externo: operadorSeleccionado.es_externo ?? false
        });
        setOperadorDialog(true);
    }, []);

    const abrirNuevoDepartamento = useCallback(() => {
        setNuevoDepartamentoNombre('');
        setNuevoDepartamentoDialog(true);
    }, []);

    const guardarNuevoDepartamento = useCallback(async () => {
        if (!nuevoDepartamentoNombre.trim()) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'El nombre del departamento es requerido', life: 3000 });
            return;
        }
        try {
            setGuardandoCatalogo(true);
            const nuevo = await createDepartamento({ nombre: nuevoDepartamentoNombre.trim(), estatus: true });
            const departamentosActualizados = await fetchDepartamentosActivos();
            setDepartamentos(departamentosActualizados);
            setOperador(prev => ({ ...prev, departamento_id: nuevo.id! }));
            setNuevoDepartamentoDialog(false);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Departamento creado y seleccionado', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo crear el departamento', life: 3000 });
        } finally {
            setGuardandoCatalogo(false);
        }
    }, [nuevoDepartamentoNombre]);

    const abrirNuevoPuesto = useCallback(() => {
        setNuevoPuestoNombre('');
        setNuevoPuestoDialog(true);
    }, []);

    const guardarNuevoPuesto = useCallback(async () => {
        if (!nuevoPuestoNombre.trim()) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'El nombre del puesto es requerido', life: 3000 });
            return;
        }
        try {
            setGuardandoCatalogo(true);
            const nuevo = await createPuesto(nuevoPuestoNombre.trim());
            const puestosActualizados = await fetchPuestosActivos();
            setPuestos(puestosActualizados);
            setOperador(prev => ({ ...prev, puesto_id: nuevo.id!, puesto: nuevo.nombre }));
            setNuevoPuestoDialog(false);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Puesto creado y seleccionado', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo crear el puesto', life: 3000 });
        } finally {
            setGuardandoCatalogo(false);
        }
    }, [nuevoPuestoNombre]);

    const abrirDocumentos = useCallback((operadorSeleccionado: Operador) => {
        setOperadorDocumentos(operadorSeleccionado);
        setDocumentosDialog(true);
    }, []);

    const confirmDeleteOperador = useCallback((operador: Operador) => {
        setOperador(operador);
        setDeleteOperadorDialog(true);
    }, []);

    const confirmDeleteSelected = useCallback(() => {
        setDeleteOperadoresDialog(true);
    }, []);

    const deleteOperadorConfirmado = useCallback(async () => {
        try {
            await deleteOperador(operador.id!);
            setOperadores(prev => prev.filter(o => o.id !== operador.id));
            setDeleteOperadorDialog(false);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Empleado eliminado', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar empleado', life: 3000 });
        }
    }, [operador]);

    const toggleEstatus = useCallback(async (operador: Operador) => {
        try {
            const newEstatus = await toggleEstatusOperador(operador.id!, operador.estatus);
            setOperadores(prev => prev.map(o => 
                o.id === operador.id ? { ...o, estatus: newEstatus } : o
            ));
            toast.current?.show({ 
                severity: 'success', 
                summary: 'Éxito', 
                detail: `Empleado ${newEstatus ? 'activado' : 'desactivado'}`,
                life: 3000 
            });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cambiar estatus', life: 3000 });
        }
    }, []);

    const deleteSelectedOperadores = useCallback(async () => {
        try {
            await Promise.all(selectedOperadores.map(o => deleteOperador(o.id!)));
            setOperadores(prev => prev.filter(o => !selectedOperadores.includes(o)));
            setDeleteOperadoresDialog(false);
            setSelectedOperadores([]);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Empleados eliminados', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar empleados', life: 3000 });
        }
    }, [selectedOperadores]);

    const exportCSV = useCallback(() => {
        dt.current?.exportCSV();
    }, []);

    // Templates para la tabla
    const nombreBodyTemplate = useCallback((rowData: Operador) => {
        return <span>{rowData.nombre}</span>;
    }, []);

    const puestoBodyTemplate = useCallback((rowData: Operador) => {
        return <span>{rowData.puesto}</span>;
    }, []);

    const salarioBodyTemplate = useCallback((rowData: Operador) => {
        return <span>${rowData.salario_base?.toFixed(2) || '0.00'}</span>;
    }, []);

    const telefonoBodyTemplate = useCallback((rowData: Operador) => {
        return <span>{rowData.telefono || '-'}</span>;
    }, []);

    const fechaContratacionBodyTemplate = useCallback((rowData: Operador) => {
        return <span>{rowData.fecha_contratacion || '-'}</span>;
    }, []);

    const idBodyTemplate = useCallback((rowData: Operador) => {
        return <span>{rowData.id}</span>;
    }, []);

    const estatusBodyTemplate = useCallback((rowData: Operador) => {
        return (
            <ToggleButton
                checked={rowData.estatus}
                onChange={() => toggleEstatus(rowData)}
                onLabel="Activo"
                offLabel="Inactivo"
                onIcon="pi pi-check"
                offIcon="pi pi-times"
                className="w-8rem"
            />
        );
    }, [toggleEstatus]);

    const accesoBodyTemplate = useCallback((rowData: Operador) => {
        return rowData.acceso_sistema ? (
            <span className="inline-flex align-items-center gap-1">
                <i className="pi pi-check-circle text-green-500" />
                <span>Sí</span>
            </span>
        ) : (
            <span className="inline-flex align-items-center gap-1">
                <i className="pi pi-times-circle text-red-500" />
                <span>No</span>
            </span>
        );
    }, []);

    const descripcionBodyTemplate = useCallback((rowData: Operador) => {
        return <span>{rowData.descripcion || '-'}</span>;
    }, []);

    // Template para camion_full
    const departamentoBodyTemplate = useCallback((rowData: Operador) => {
        return <span>{rowData.departamento_nombre || '-'}</span>;
    }, []);

    const camionFullBodyTemplate = useCallback((rowData: Operador) => {
        const isFull = rowData.camion_full === true;
        return isFull ? (
            <span className="inline-flex align-items-center gap-1">
                <i className="pi pi-check-circle text-green-500" />
                <span>Sí</span>
            </span>
        ) : (
            <span className="inline-flex align-items-center gap-1">
                <i className="pi pi-times-circle text-red-500" />
                <span>No</span>
            </span>
        );
    }, []);

    const externoBodyTemplate = useCallback((rowData: Operador) => {
        const isExterno = rowData.es_externo === true;
        return isExterno ? (
            <span className="inline-flex align-items-center gap-1">
                <i className="pi pi-check-circle text-green-500" />
                <span>Sí</span>
            </span>
        ) : (
            <span className="inline-flex align-items-center gap-1">
                <i className="pi pi-times-circle text-red-500" />
                <span>No</span>
            </span>
        );
    }, []);

    const actionBodyTemplate = useCallback((rowData: Operador) => {
        return (
            <div className="flex gap-2">
                <Button icon="pi pi-pencil" rounded severity="info" onClick={() => editOperador(rowData)} />
                <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteOperador(rowData)} />
            </div>
        );
    }, [editOperador, confirmDeleteOperador]);

    const documentosBodyTemplate = useCallback((rowData: Operador) => {
        return (
            <Button
                icon="pi pi-file-pdf"
                rounded
                text
                severity="info"
                tooltip="Ver Documentos"
                onClick={() => abrirDocumentos(rowData)}
            />
        );
    }, [abrirDocumentos]);

    const leftToolbarTemplate = useCallback(() => {
        return (
            <div className="my-2">
                <Button label="Nuevo" icon="pi pi-plus" severity="info" className="mr-2" onClick={openNew} />
                <Button label="Eliminar" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} 
                    disabled={!selectedOperadores || selectedOperadores.length === 0} />
            </div>
        );
    }, [openNew, confirmDeleteSelected, selectedOperadores]);

    const rightToolbarTemplate = useCallback(() => {
        return (
            <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={exportCSV} />
        );
    }, [exportCSV]);

    const header = useCallback(() => {
        return (
            <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
                <h5 className="m-0">Gestión de Empleados</h5>
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
    }, []);

    const operadorDialogFooter = useCallback(() => (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveOperador} loading={loading} />
        </>
    ), [hideDialog, saveOperador, loading]);

    const deleteOperadorDialogFooter = useCallback(() => (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteOperadorDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteOperadorConfirmado} />
        </>
    ), [hideDeleteOperadorDialog, deleteOperadorConfirmado]);

    const deleteOperadoresDialogFooter = useCallback(() => (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteOperadoresDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteSelectedOperadores} />
        </>
    ), [hideDeleteOperadoresDialog, deleteSelectedOperadores]);

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} right={rightToolbarTemplate}></Toolbar>

                    <div className="block md:hidden">
                        {operadores.length === 0 ? (
                            <div className="text-center py-5 text-500">No se encontraron empleados</div>
                        ) : (
                            <div className="flex flex-column gap-3">
                                {operadores.map((operadorItem) => (
                                    <div key={operadorItem.id} className="surface-card border-1 border-round p-3 shadow-1">
                                        <div className="flex justify-content-between align-items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-lg">{operadorItem.nombre || '-'}</div>
                                                <div className="text-sm text-500">{operadorItem.puesto || '-'}</div>
                                                <div className="text-sm text-500">{operadorItem.departamento_nombre || 'Sin departamento'}</div>
                                            </div>
                                            <span className={`px-3 py-1 border-round text-sm font-medium ${getStatusBadgeClass(operadorItem.estatus)}`}>
                                                {operadorItem.estatus ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </div>

                                        <div className="grid mt-3">
                                            <div className="col-12 sm:col-6">
                                                <div className="text-500 text-sm">Teléfono</div>
                                                <div className="font-medium">{telefonoBodyTemplate(operadorItem)}</div>
                                            </div>
                                            <div className="col-12 sm:col-6">
                                                <div className="text-500 text-sm">Fecha alta</div>
                                                <div className="font-medium">{fechaContratacionBodyTemplate(operadorItem)}</div>
                                            </div>
                                            <div className="col-12 sm:col-6">
                                                <div className="text-500 text-sm">Salario</div>
                                                <div className="font-medium">{salarioBodyTemplate(operadorItem)}</div>
                                            </div>
                                            <div className="col-12 sm:col-6">
                                                <div className="text-500 text-sm">Acceso</div>
                                                <div className="font-medium">{accesoBodyTemplate(operadorItem)}</div>
                                            </div>
                                            <div className="col-12 sm:col-6">
                                                <div className="text-500 text-sm">Camión Full</div>
                                                <div className="font-medium">{camionFullBodyTemplate(operadorItem)}</div>
                                            </div>
                                            <div className="col-12 sm:col-6">
                                                <div className="text-500 text-sm">Externo</div>
                                                <div className="font-medium">{externoBodyTemplate(operadorItem)}</div>
                                            </div>
                                            {operadorItem.descripcion && (
                                                <div className="col-12">
                                                    <div className="text-500 text-sm">Notas</div>
                                                    <div className="font-medium">{operadorItem.descripcion}</div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-3">
                                            <div className="text-500 text-sm mb-2">Cambiar estatus</div>
                                            <ToggleButton
                                                checked={operadorItem.estatus}
                                                onChange={() => toggleEstatus(operadorItem)}
                                                onLabel="Activo"
                                                offLabel="Inactivo"
                                                onIcon="pi pi-check"
                                                offIcon="pi pi-times"
                                                className="w-full"
                                            />
                                        </div>

                                        <div className="flex gap-2 mt-3">
                                            <Button label="Editar" icon="pi pi-pencil" severity="info" className="flex-1" onClick={() => editOperador(operadorItem)} />
                                            <Button label="Documentos" icon="pi pi-file-pdf" severity="secondary" className="flex-1" onClick={() => abrirDocumentos(operadorItem)} />
                                            <Button label="Eliminar" icon="pi pi-trash" severity="danger" className="flex-1" onClick={() => confirmDeleteOperador(operadorItem)} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="hidden md:block">
                        <DataTable
                            ref={dt}
                            value={operadores}
                            selection={selectedOperadores}
                            onSelectionChange={(e) => setSelectedOperadores(e.value)}
                            dataKey="id"
                            paginator
                            rows={10}
                            rowsPerPageOptions={[5, 10, 25]}
                            className="datatable-responsive"
                            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} empleados"
                            filters={filters} // PARA EL DE BUSQUEDA
                            emptyMessage="No se encontraron empleados"
                            header={header}
                            responsiveLayout="scroll"
                        >
                            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                            <Column field="id" header="ID" sortable body={idBodyTemplate}></Column>
                            <Column field="nombre" header="Nombre" sortable body={nombreBodyTemplate}></Column>
                            <Column field="puesto" header="Puesto" sortable body={puestoBodyTemplate}></Column>
                            <Column field="departamento_nombre" header="Departamento" sortable body={departamentoBodyTemplate}></Column>
                            <Column field="salario_base" header="Salario" sortable body={salarioBodyTemplate}></Column>
                            <Column field="telefono" header="Teléfono" body={telefonoBodyTemplate}></Column>
                            <Column field="fecha_contratacion" header="Fecha Alta" body={fechaContratacionBodyTemplate}></Column>
                            <Column field="acceso_sistema" header="Acceso" body={accesoBodyTemplate}></Column>
                            <Column field="camion_full" header="Camión Full ?" body={camionFullBodyTemplate}></Column>
                            <Column field="es_externo" header="Externo ?" body={externoBodyTemplate}></Column>
                            <Column field="estatus" header="Estatus" body={estatusBodyTemplate}></Column>
                            <Column header="Documentos" body={documentosBodyTemplate} style={{ width: '100px' }}></Column>
                            <Column header="Acciones" body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }}></Column>
                        </DataTable>
                    </div>

                    <Dialog
                        visible={operadorDialog}
                        style={{ width: '550px' }}
                        header={operador.id ? 'Editar Empleado' : 'Nuevo Empleado'}
                        modal
                        className="p-fluid"
                        footer={operadorDialogFooter}
                        onHide={hideDialog}
                    >
                        <div className="grid">
                            <div className="col-12">
                                <div className="field">
                                    <label htmlFor="nombre">Nombre completo *</label>
                                    <InputText
                                        id="nombre"
                                        value={operador.nombre}
                                        onChange={(e) => setOperador({ ...operador, nombre: e.target.value })}
                                        required
                                        autoFocus
                                        className={submitted && !operador.nombre ? 'p-invalid' : ''}
                                    />
                                    {submitted && !operador.nombre && (
                                        <small className="p-invalid">Nombre es requerido.</small>
                                    )}
                                </div>
                            </div>

                            {(!ceoActual || ceoActual.id === operador.id) && (
                                <div className="col-12">
                                    <div className="field">
                                        <div className="flex align-items-center">
                                            <Checkbox
                                                id="es_ceo"
                                                checked={operador.es_ceo === true}
                                                onChange={(e) => {
                                                    const checked = e.checked || false;
                                                    setOperador({
                                                        ...operador,
                                                        es_ceo: checked,
                                                        ...(checked ? { jefe_inmediato_id: null } : {})
                                                    });
                                                }}
                                            />
                                            <label htmlFor="es_ceo" className="ml-2">
                                                Es el CEO / máximo nivel jerárquico de la empresa
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!operador.es_ceo && (
                                <div className="col-12">
                                    <div className="field">
                                        <label htmlFor="jefe_inmediato_id">Gerente *</label>
                                        <Dropdown
                                            id="jefe_inmediato_id"
                                            value={operador.jefe_inmediato_id}
                                            options={operadores
                                                .filter(o => o.id !== operador.id)
                                                .map(o => ({ label: `${o.nombre} (${o.puesto})`, value: o.id }))}
                                            onChange={(e) => setOperador({ ...operador, jefe_inmediato_id: e.value })}
                                            placeholder="Busca y selecciona su gerente"
                                            filter
                                            required
                                            className={submitted && !operador.jefe_inmediato_id ? 'p-invalid' : ''}
                                        />
                                        {submitted && !operador.jefe_inmediato_id && (
                                            <small className="p-invalid">El gerente es requerido.</small>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="col-12">
                                <div className="field">
                                    <label htmlFor="departamento_id">Departamento *</label>
                                    <div className="flex gap-2">
                                        <Dropdown
                                            id="departamento_id"
                                            value={operador.departamento_id}
                                            options={departamentos.map(d => ({ label: d.nombre, value: d.id }))}
                                            onChange={(e) => setOperador({ ...operador, departamento_id: e.value })}
                                            placeholder="Busca un departamento"
                                            filter
                                            className={`flex-1 ${submitted && !operador.departamento_id ? 'p-invalid' : ''}`}
                                        />
                                        <Button type="button" icon="pi pi-plus" tooltip="Crear departamento nuevo" onClick={abrirNuevoDepartamento} />
                                    </div>
                                    {submitted && !operador.departamento_id && (
                                        <small className="p-invalid">El departamento es requerido.</small>
                                    )}
                                </div>
                            </div>

                            <div className="col-12">
                                <div className="field">
                                    <label htmlFor="puesto_id">Puesto *</label>
                                    <div className="flex gap-2">
                                        <Dropdown
                                            id="puesto_id"
                                            value={operador.puesto_id}
                                            options={puestos.map(p => ({ label: p.nombre, value: p.id }))}
                                            onChange={(e) => {
                                                const puestoSeleccionado = puestos.find(p => p.id === e.value);
                                                setOperador({ ...operador, puesto_id: e.value, puesto: puestoSeleccionado?.nombre || operador.puesto });
                                            }}
                                            placeholder="Busca un puesto"
                                            filter
                                            className={`flex-1 ${submitted && !operador.puesto_id ? 'p-invalid' : ''}`}
                                        />
                                        <Button type="button" icon="pi pi-plus" tooltip="Crear puesto nuevo" onClick={abrirNuevoPuesto} />
                                    </div>
                                    {submitted && !operador.puesto_id && (
                                        <small className="p-invalid">El puesto es requerido.</small>
                                    )}
                                </div>
                            </div>

                            <div className="col-12 md:col-6">
                                <div className="field">
                                    <label htmlFor="salario_base">Salario base</label>
                                    <InputText
                                        id="salario_base"
                                        value={operador.salario_base?.toString() || '0'}
                                        onChange={(e) => setOperador({ ...operador, salario_base: parseFloat(e.target.value) || 0 })}
                                        keyfilter="money"
                                    />
                                </div>
                            </div>

                            <div className="col-12 md:col-6">
                                <div className="field">
                                    <label htmlFor="telefono">Teléfono</label>
                                    <InputText
                                        id="telefono"
                                        value={operador.telefono || ''}
                                        onChange={(e) => setOperador({ ...operador, telefono: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="col-12 md:col-6">
                                <div className="field">
                                    <label htmlFor="direccion">Dirección</label>
                                    <InputText
                                        id="direccion"
                                        value={operador.direccion || ''}
                                        onChange={(e) => setOperador({ ...operador, direccion: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="col-12 md:col-6">
                                <div className="field">
                                    <label htmlFor="fecha_contratacion">Fecha de contratación</label>
                                    <Calendar
                                        id="fecha_contratacion"
                                        value={
                                        operador.fecha_contratacion
                                            ? (() => {
                                                const [year, month, day] = operador.fecha_contratacion.split('-').map(Number);
                                                return new Date(year, month - 1, day);
                                            })()
                                            : null
                                        }
                                        onChange={(e) =>
                                        setOperador({
                                            ...operador,
                                            fecha_contratacion: e.value
                                                ? `${e.value.getFullYear()}-${String(e.value.getMonth() + 1).padStart(2, '0')}-${String(e.value.getDate()).padStart(2, '0')}`
                                                : ''
                                        })
                                        }
                                        dateFormat="yy-mm-dd"
                                        showIcon
                                        />
                                </div>
                            </div>

                            <div className="col-12">
                                <div className="field">
                                    <label htmlFor="descripcion">Notas adicionales</label>
                                    <InputText
                                        id="descripcion"
                                        value={operador.descripcion || ''}
                                        onChange={(e) => setOperador({ ...operador, descripcion: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Sección de Acceso al Sistema */}
                            <div className="col-12">
                                <div className="field">
                                    <div className="flex align-items-center">
                                        <Checkbox
                                            id="acceso_sistema"
                                            checked={operador.acceso_sistema || false}
                                            onChange={(e) => {
                                                const checked = e.checked || false;
                                                setOperador({ 
                                                    ...operador, 
                                                    acceso_sistema: checked,
                                                    ...(checked ? {} : { email: '', pass: '', rol_id: null })
                                                });
                                            }}
                                        />
                                        <label htmlFor="acceso_sistema" className="ml-2">
                                            Dar acceso al sistema
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Campos de acceso al sistema (solo si está activado) */}
                            {operador.acceso_sistema && (
                                <>
                                    <div className="col-12">
                                        <div className="field">
                                            <label htmlFor="email">
                                                Email {!operador.id && '*'}
                                            </label>
                                            <InputText
                                                id="email"
                                                type="email"
                                                value={operador.email || ''}
                                                onChange={(e) => setOperador({ ...operador, email: e.target.value })}
                                                placeholder="correo@ejemplo.com"
                                                required={!operador.id}
                                                className={submitted && !operador.id && !operador.email ? 'p-invalid' : ''}
                                            />
                                            {submitted && !operador.id && !operador.email && (
                                                <small className="p-error">Email es requerido para acceso al sistema.</small>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-12">
                                        <div className="field">
                                            <label htmlFor="password">
                                                Contraseña {!operador.id && '*'}
                                            </label>
                                            <Password
                                                id="password"
                                                value={operador.pass || ''}
                                                onChange={(e) => setOperador({ ...operador, pass: e.target.value })}
                                                placeholder={operador.id ? "Dejar vacío para mantener la actual" : "Mínimo 6 caracteres"}
                                                toggleMask
                                                required={!operador.id}
                                                feedback={false}
                                                className={submitted && !operador.id && !operador.pass ? 'p-invalid' : ''}
                                            />
                                            {submitted && !operador.id && !operador.pass && (
                                                <small className="p-invalid">Contraseña es requerida (mínimo 6 caracteres).</small>
                                            )}
                                            {operador.id && operador.pass && operador.pass.length > 0 && operador.pass.length < 6 && (
                                                <small className="p-invalid">La contraseña debe tener al menos 6 caracteres.</small>
                                            )}
                                            {operador.id && (
                                                <small className="text-500">* Dejar vacío para mantener la contraseña actual</small>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-12">
                                        <div className="field">
                                            <label htmlFor="rol_id">Rol {!operador.id && '*'}</label>
                                            <Dropdown
                                                id="rol_id"
                                                value={operador.rol_id}
                                                options={roles.map(r => ({ label: `${r.nombre} (${r.descripcion})`, value: r.id }))}
                                                onChange={(e) => setOperador({ ...operador, rol_id: e.value })}
                                                placeholder="Selecciona un rol"
                                                required={!operador.id}
                                                filter
                                                className={submitted && !operador.id && !operador.rol_id ? 'p-invalid' : ''}
                                            />
                                            {submitted && !operador.id && !operador.rol_id && (
                                                <small className="p-invalid">Rol es requerido para acceso al sistema.</small>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Camion full? */}
                            <div className="col-12">
                                <div className="field">
                                    <div className="flex align-items-center">
                                        <Checkbox
                                            id="camion_full"
                                            checked={operador.camion_full === true}
                                            onChange={(e) => {
                                                const checked = e.checked || false;
                                                setOperador({ 
                                                    ...operador, 
                                                    camion_full: checked 
                                                });
                                            }}
                                        />
                                        <label htmlFor="camion_full" className="ml-2">
                                            Camion Full ?
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Empleado externo? */}
                            <div className="col-12">
                                <div className="field">
                                    <div className="flex align-items-center">
                                        <Checkbox
                                            id="es_externo"
                                            checked={operador.es_externo === true}
                                            onChange={(e) => {
                                                const checked = e.checked || false;
                                                setOperador({
                                                    ...operador,
                                                    es_externo: checked
                                                });
                                            }}
                                        />
                                        <label htmlFor="es_externo" className="ml-2">
                                            Externo ?
                                        </label>
                                    </div>
                                    <small className="text-500">
                                        Los empleados externos no se incluyen en el cálculo de nómina.
                                    </small>
                                </div>
                            </div>

                            {operador.id && (
                                <div className="col-12">
                                    <div className="field">
                                        {/* <label htmlFor="estatus">Estatus</label> */}
                                        <ToggleButton
                                            checked={operador.estatus}
                                            onChange={(e) => setOperador({ ...operador, estatus: e.value })}
                                            onLabel="Activo"
                                            offLabel="Inactivo"
                                            className="w-full md:w-8rem"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </Dialog>

                    <Dialog
                        visible={deleteOperadorDialog}
                        style={{ width: '450px' }}
                        header="Confirmar"
                        modal
                        footer={deleteOperadorDialogFooter}
                        onHide={hideDeleteOperadorDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {operador && (
                                <span>
                                    ¿Estás seguro de eliminar al empleado <b>{operador.nombre}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <Dialog
                        visible={deleteOperadoresDialog}
                        style={{ width: '450px' }}
                        header="Confirmar"
                        modal
                        footer={deleteOperadoresDialogFooter}
                        onHide={hideDeleteOperadoresDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {operador && (
                                <span>
                                    ¿Estás seguro de eliminar los {selectedOperadores.length} empleados seleccionados?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <Dialog
                        visible={nuevoDepartamentoDialog}
                        style={{ width: '400px' }}
                        header="Nuevo Departamento"
                        modal
                        className="p-fluid"
                        onHide={() => setNuevoDepartamentoDialog(false)}
                        footer={
                            <>
                                <Button label="Cancelar" icon="pi pi-times" text onClick={() => setNuevoDepartamentoDialog(false)} />
                                <Button label="Guardar" icon="pi pi-check" text onClick={guardarNuevoDepartamento} loading={guardandoCatalogo} />
                            </>
                        }
                    >
                        <div className="field">
                            <label htmlFor="nuevo_departamento_nombre">Nombre del departamento *</label>
                            <InputText
                                id="nuevo_departamento_nombre"
                                value={nuevoDepartamentoNombre}
                                onChange={(e) => setNuevoDepartamentoNombre(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </Dialog>

                    <Dialog
                        visible={nuevoPuestoDialog}
                        style={{ width: '400px' }}
                        header="Nuevo Puesto"
                        modal
                        className="p-fluid"
                        onHide={() => setNuevoPuestoDialog(false)}
                        footer={
                            <>
                                <Button label="Cancelar" icon="pi pi-times" text onClick={() => setNuevoPuestoDialog(false)} />
                                <Button label="Guardar" icon="pi pi-check" text onClick={guardarNuevoPuesto} loading={guardandoCatalogo} />
                            </>
                        }
                    >
                        <div className="field">
                            <label htmlFor="nuevo_puesto_nombre">Nombre del puesto *</label>
                            <InputText
                                id="nuevo_puesto_nombre"
                                value={nuevoPuestoNombre}
                                onChange={(e) => setNuevoPuestoNombre(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </Dialog>

                    <ModalDocumentosOperador
                        visible={documentosDialog}
                        onHide={() => setDocumentosDialog(false)}
                        operador={operadorDocumentos}
                    />
                </div>
            </div>
        </div>
    );
};

export default OperadoresCrud;