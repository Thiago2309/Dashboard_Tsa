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
import React, { useEffect, useRef, useState } from 'react';
import { 
  fetchOperadores, 
  createOperador, 
  updateOperador, 
  deleteOperador, 
  toggleEstatusOperador,
  fetchRoles,
  Operador 
} from '../../../../Services/BD/operadoresService';

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
      rol_id: null
    });
    const [selectedOperadores, setSelectedOperadores] = useState<Operador[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');
    const [loading, setLoading] = useState(false);
    const [roles, setRoles] = useState<{ id: number; nombre: string; descripcion: string }[]>([]);
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    const getStatusBadgeClass = (estatus: boolean) => {
        return estatus ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    };

    const getAccessBadgeClass = (acceso: boolean) => {
        return acceso ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
    };

    const puestos = [
      'Operador Góndola',
      'Operador Volquete',
      'Operador Maquinaria',
      'Mecánico',
      'Soldador',
      'Vigilante',
      'Encargado de Obra',
      'Supervisor',
      'Gerente de Operaciones',
      'Ayudante'
    ];

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            const [operadoresData, rolesData] = await Promise.all([
                fetchOperadores(),
                fetchRoles()
            ]);
            setOperadores(operadoresData);
            setRoles(rolesData);
        } catch (error) {
            console.error('Error cargando datos:', error);
            toast.current?.show({ 
                severity: 'error', 
                summary: 'Error', 
                detail: 'Error al cargar los datos', 
                life: 3000 
            });
        }
    };

    const openNew = () => {
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
          rol_id: null
        });
        setSubmitted(false);
        setOperadorDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setOperadorDialog(false);
    };

    const hideDeleteOperadorDialog = () => {
        setDeleteOperadorDialog(false);
    };

    const hideDeleteOperadoresDialog = () => {
        setDeleteOperadoresDialog(false);
    };

    const saveOperador = async () => {
        setSubmitted(true);

        // Validaciones básicas
        if (!operador.nombre.trim() || !operador.puesto.trim()) {
            toast.current?.show({ 
                severity: 'error', 
                summary: 'Error', 
                detail: 'Nombre y puesto son requeridos', 
                life: 3000 
            });
            return;
        }

        // Validaciones para acceso al sistema
        if (operador.acceso_sistema) {
            // Solo validar email y password si es NUEVO o si se están modificando
            if (!operador.id) {
                // Nuevo: obligatorio
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
                // Edición: solo validar si se proporcionaron
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
            if (operador.id) {
                // Solo actualizar, no crear usuario (el usuario ya existe)
                const updatedOperador = await updateOperador(operador);
                setOperadores(operadores.map(o => o.id === updatedOperador.id ? updatedOperador : o));
                toast.current?.show({ 
                    severity: 'success', 
                    summary: 'Éxito', 
                    detail: 'Empleado actualizado correctamente', 
                    life: 3000 
                });
            } else {
                // Crear nuevo operador
                const newOperador = await createOperador(operador);
                setOperadores([...operadores, newOperador]);
                
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
            setOperadorDialog(false);
            // Recargar lista
            const operadoresActualizados = await fetchOperadores();
            setOperadores(operadoresActualizados);
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
    };

    const editOperador = (operador: Operador) => {
        setOperador({ ...operador });
        setOperadorDialog(true);
    };

    const confirmDeleteOperador = (operador: Operador) => {
        setOperador(operador);
        setDeleteOperadorDialog(true);
    };

    const confirmDeleteSelected = () => {
        setDeleteOperadoresDialog(true);
    };

    const deleteOperadorConfirmado = async () => {
        try {
            await deleteOperador(operador.id!);
            setOperadores(operadores.filter(o => o.id !== operador.id));
            setDeleteOperadorDialog(false);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Empleado eliminado', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar empleado', life: 3000 });
        }
    };

    const toggleEstatus = async (operador: Operador) => {
        try {
            const newEstatus = await toggleEstatusOperador(operador.id!, operador.estatus);
            setOperadores(operadores.map(o => 
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
    };

    const deleteSelectedOperadores = async () => {
        try {
            await Promise.all(selectedOperadores.map(o => deleteOperador(o.id!)));
            setOperadores(operadores.filter(o => !selectedOperadores.includes(o)));
            setDeleteOperadoresDialog(false);
            setSelectedOperadores([]);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Empleados eliminados', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar empleados', life: 3000 });
        }
    };

    const exportCSV = () => {
        dt.current?.exportCSV();
    };

    // Templates para la tabla
    const nombreBodyTemplate = (rowData: Operador) => {
        return <span>{rowData.nombre}</span>;
    };

    const puestoBodyTemplate = (rowData: Operador) => {
        return <span>{rowData.puesto}</span>;
    };

    const salarioBodyTemplate = (rowData: Operador) => {
        return <span>${rowData.salario_base?.toFixed(2) || '0.00'}</span>;
    };

    const telefonoBodyTemplate = (rowData: Operador) => {
        return <span>{rowData.telefono || '-'}</span>;
    };

    const fechaContratacionBodyTemplate = (rowData: Operador) => {
        return <span>{rowData.fecha_contratacion || '-'}</span>;
    };

    const idBodyTemplate = (rowData: Operador) => {
        return <span>{rowData.id}</span>;
    };

    const estatusBodyTemplate = (rowData: Operador) => {
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
    };

    const accesoBodyTemplate = (rowData: Operador) => {
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
    };

    const descripcionBodyTemplate = (rowData: Operador) => {
        return <span>{rowData.descripcion || '-'}</span>;
    };

    const actionBodyTemplate = (rowData: Operador) => {
        return (
            <div className="flex gap-2">
                <Button icon="pi pi-pencil" rounded severity="info" onClick={() => editOperador(rowData)} />
                <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteOperador(rowData)} />
            </div>
        );
    };

    const leftToolbarTemplate = () => {
        return (
            <div className="my-2">
                <Button label="Nuevo" icon="pi pi-plus" severity="info" className="mr-2" onClick={openNew} />
                <Button label="Eliminar" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} 
                    disabled={!selectedOperadores || selectedOperadores.length === 0} />
            </div>
        );
    };

    const rightToolbarTemplate = () => {
        return (
            <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={exportCSV} />
        );
    };

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Empleados</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setGlobalFilter(e.currentTarget.value)} placeholder="Buscar..." />
            </span>
        </div>
    );

    const operadorDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveOperador} loading={loading} />
        </>
    );

    const deleteOperadorDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteOperadorDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteOperadorConfirmado} />
        </>
    );

    const deleteOperadoresDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteOperadoresDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteSelectedOperadores} />
        </>
    );

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
                            globalFilter={globalFilter}
                            emptyMessage="No se encontraron empleados"
                            header={header}
                            responsiveLayout="scroll"
                        >
                            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                            <Column field="id" header="ID" sortable body={idBodyTemplate}></Column>
                            <Column field="nombre" header="Nombre" sortable body={nombreBodyTemplate}></Column>
                            <Column field="puesto" header="Puesto" sortable body={puestoBodyTemplate}></Column>
                            <Column field="salario_base" header="Salario" sortable body={salarioBodyTemplate}></Column>
                            <Column field="telefono" header="Teléfono" body={telefonoBodyTemplate}></Column>
                            <Column field="fecha_contratacion" header="Fecha Alta" body={fechaContratacionBodyTemplate}></Column>
                            <Column field="acceso_sistema" header="Acceso" body={accesoBodyTemplate}></Column>
                            <Column field="estatus" header="Estatus" body={estatusBodyTemplate}></Column>
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

                            <div className="col-12 md:col-6">
                                <div className="field">
                                    <label htmlFor="puesto">Puesto *</label>
                                    <Dropdown
                                        id="puesto"
                                        value={operador.puesto}
                                        options={puestos.map(p => ({ label: p, value: p }))}
                                        onChange={(e) => setOperador({ ...operador, puesto: e.value })}
                                        placeholder="Selecciona un puesto"
                                        required
                                        className={submitted && !operador.puesto ? 'p-invalid' : ''}
                                    />
                                    {submitted && !operador.puesto && (
                                        <small className="p-invalid">Puesto es requerido.</small>
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
                                                    // Si se desactiva el acceso, limpiar email, password y rol
                                                    ...(checked ? {} : { email: '', password: '', rol_id: null })
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
                                                required={!operador.id} // Solo requerido si es nuevo
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
                                                required={!operador.id} // Solo requerido si es nuevo
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

                            {operador.id && (
                                <div className="col-12">
                                    <div className="field">
                                        <label htmlFor="estatus">Estatus</label>
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
                </div>
            </div>
        </div>
    );
};

export default OperadoresCrud;