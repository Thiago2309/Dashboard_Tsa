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
import React, { useEffect, useRef, useState } from 'react';
import { 
  fetchOperadores, 
  createOperador, 
  updateOperador, 
  deleteOperador, 
  toggleEstatusOperador,
  Operador 
} from '../../../../Services/BD/operadoresService';

const OperadoresCrud = () => {
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [operadorDialog, setOperadorDialog] = useState(false);
    const [deleteOperadorDialog, setDeleteOperadorDialog] = useState(false);
    const [deleteOperadoresDialog, setDeleteOperadoresDialog] = useState(false);
    const [operador, setOperador] = useState<Operador>({ 
      nombre: '', 
      puesto: 'Operador', 
      salario_base: 0, 
      estatus: true,
      descripcion: ''
    });
    const [selectedOperadores, setSelectedOperadores] = useState<Operador[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    const puestos = [
      'Operador',
      'Operador Senior',
      'Supervisor',
      'Gerente de Operaciones',
      'Ayudante'
    ];

    useEffect(() => {
        fetchOperadores().then(setOperadores);
    }, []);

    const openNew = () => {
        setOperador({ 
          nombre: '', 
          puesto: 'Operador', 
          salario_base: 0, 
          estatus: true,
          descripcion: '',
          telefono: '',
          direccion: ''
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

        if (operador.nombre.trim() && operador.puesto.trim()) {
            try {
                if (operador.id) {
                    const updatedOperador = await updateOperador(operador);
                    setOperadores(operadores.map(o => o.id === updatedOperador.id ? updatedOperador : o));
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Operador actualizado', life: 3000 });
                } else {
                    const newOperador = await createOperador(operador);
                    setOperadores([...operadores, newOperador]);
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Operador creado', life: 3000 });
                }
                setOperadorDialog(false);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar operador', life: 3000 });
            }
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
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Operador eliminado', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar operador', life: 3000 });
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
                detail: `Operador ${newEstatus ? 'activado' : 'desactivado'}`,
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
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Operadores eliminados', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar operadores', life: 3000 });
        }
    };

    const exportCSV = () => {
        dt.current?.exportCSV();
    };

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
            <h5 className="m-0">Gestión de Operadores</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setGlobalFilter(e.currentTarget.value)} placeholder="Buscar..." />
            </span>
        </div>
    );

    const operadorDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveOperador} />
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
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} operadores"
                        globalFilter={globalFilter}
                        emptyMessage="No se encontraron operadores"
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                        <Column field="nombre" header="Nombre" sortable body={nombreBodyTemplate}></Column>
                        <Column field="puesto" header="Puesto" sortable body={puestoBodyTemplate}></Column>
                        <Column field="salario_base" header="Salario Base" sortable body={salarioBodyTemplate}></Column>
                        <Column field="telefono" header="Teléfono" body={telefonoBodyTemplate}></Column>
                        <Column field="estatus" header="Estatus" body={estatusBodyTemplate}></Column>
                        <Column field="descripcion" header="Notas" body={descripcionBodyTemplate}></Column>
                        <Column header="Acciones" body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }}></Column>
                    </DataTable>

                    <Dialog
                        visible={operadorDialog}
                        style={{ width: '500px' }}
                        header={operador.id ? 'Editar Operador' : 'Nuevo Operador'}
                        modal
                        className="p-fluid"
                        footer={operadorDialogFooter}
                        onHide={hideDialog}
                    >
                        <div className="field">
                            <label htmlFor="nombre">Nombre completo</label>
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

                        <div className="field">
                            <label htmlFor="puesto">Puesto</label>
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

                        <div className="field">
                            <label htmlFor="salario_base">Salario base</label>
                            <InputText
                                id="salario_base"
                                value={operador.salario_base?.toString() || '0'}
                                onChange={(e) => setOperador({ ...operador, salario_base: parseFloat(e.target.value) || 0 })}
                                keyfilter="money"
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="telefono">Teléfono</label>
                            <InputText
                                id="telefono"
                                value={operador.telefono || ''}
                                onChange={(e) => setOperador({ ...operador, telefono: e.target.value })}
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="direccion">Dirección</label>
                            <InputText
                                id="direccion"
                                value={operador.direccion || ''}
                                onChange={(e) => setOperador({ ...operador, direccion: e.target.value })}
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="fecha_contratacion">Fecha de contratación</label>
                            <Calendar
                                id="fecha_contratacion"
                                value={operador.fecha_contratacion ? new Date(operador.fecha_contratacion) : null}
                                onChange={(e) => setOperador({ ...operador, fecha_contratacion: e.value ? e.value.toISOString().split('T')[0] : '' })}
                                dateFormat="dd/mm/yy"
                                showIcon
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="descripcion">Notas adicionales</label>
                            <InputText
                                id="descripcion"
                                value={operador.descripcion || ''}
                                onChange={(e) => setOperador({ ...operador, descripcion: e.target.value })}
                            />
                        </div>

                        {operador.id && (
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
                        )}
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
                                    ¿Estás seguro de eliminar al operador <b>{operador.nombre}</b>?
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
                                    ¿Estás seguro de eliminar los {selectedOperadores.length} operadores seleccionados?
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