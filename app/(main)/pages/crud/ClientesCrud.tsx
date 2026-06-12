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
import React, { useEffect, useRef, useState } from 'react';
import { fetchClientes, createCliente, updateCliente, deleteCliente, Cliente } from '../../../../Services/BD/clientesService';
import { RadioButton } from 'primereact/radiobutton';

const ClientesCrud = () => {
    let emptyCliente: Cliente = {
        empresa: '',
        contacto: '',
        telefono: '',
        tipo_cliente: undefined,
        rfc: '',
        direccion: '',
        metodo_pago: undefined,
        uso_cfdi: '',
        regimen_fiscal: '',
        obra: '',
        estatus: undefined,
        porcentaje_administrativo: 0,
    };

    const [clientesList, setClientesList] = useState<Cliente[]>([]);
    const [clienteDialog, setClienteDialog] = useState(false);
    const [deleteClienteDialog, setDeleteClienteDialog] = useState(false);
    const [deleteClientesDialog, setDeleteClientesDialog] = useState(false);
    const [cliente, setCliente] = useState<Cliente>(emptyCliente);
    const [selectedClientes, setSelectedClientes] = useState<Cliente[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    const metodosPago = [
        { label: 'Efectivo', value: 'Efectivo' },
        { label: 'Trasferencia', value: 'Trasferencia' }
    ];

    const TipoCliente = [
        { label: 'Efectivo', value: 'Efectivo' },
        { label: 'Facturado', value: 'Facturado' }
    ];

    const usosCFDI = [
        { label: 'G01 - Adquisición de mercancías', value: 'G01' },
        { label: 'G03 - Gastos en general', value: 'G03' },
        // Agrega más opciones según sea necesario
    ];

    useEffect(() => {
        fetchClientes().then(setClientesList);
    }, []);

    const openNew = () => {
        setCliente(emptyCliente);
        setSubmitted(false);
        setClienteDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setClienteDialog(false);
    };

    const hideDeleteClienteDialog = () => {
        setDeleteClienteDialog(false);
    };

    const hideDeleteClientesDialog = () => {
        setDeleteClientesDialog(false);
    };

    const saveCliente = async () => {
        setSubmitted(true);
    
        if (cliente.empresa.trim() && cliente.contacto.trim()) {
            if (cliente.tipo_cliente === 'Facturado' && !cliente.rfc) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'RFC es requerido para facturación', life: 3000 });
                return;
            }

            try {
                if (cliente.id) {
                    const updatedCliente = await updateCliente(cliente);
                    setClientesList(clientesList.map(c => c.id === updatedCliente.id ? updatedCliente : c));
                    toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Cliente Updated', life: 3000 });
                } else {
                    const newCliente = await createCliente(cliente);
                    setClientesList([...clientesList, newCliente]);
                    toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Cliente Created', life: 3000 });
                }
                setClienteDialog(false);
                setCliente(emptyCliente);
                fetchClientes().then(setClientesList);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error saving Cliente', life: 3000 });
            }
        }
    };

    const editCliente = (cliente: Cliente) => {
        setCliente({ ...cliente });
        setClienteDialog(true);
    };

    const confirmDeleteCliente = (cliente: Cliente) => {
        setCliente(cliente);
        setDeleteClienteDialog(true);
    };

    const deleteClienteConfirmado = async () => {
        try {
            await deleteCliente(cliente.id!);
            setClientesList(clientesList.filter(c => c.id !== cliente.id));
            setDeleteClienteDialog(false);
            setCliente(emptyCliente);
            toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Cliente Deleted', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error deleting Cliente', life: 3000 });
        }
    };

    const exportCSV = () => {
        dt.current?.exportCSV();
    };

    const confirmDeleteSelected = () => {
        setDeleteClientesDialog(true);
    };

    const deleteSelectedClientes = async () => {
        try {
            await Promise.all(selectedClientes.map(c => deleteCliente(c.id!)));
            setClientesList(clientesList.filter(c => !selectedClientes.includes(c)));
            setDeleteClientesDialog(false);
            setSelectedClientes([]);
            toast.current?.show({ severity: 'success', summary: 'Successful', detail: 'Clientes Deleted', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error deleting Clientes', life: 3000 });
        }
    };

    const leftToolbarTemplate = () => {
        return (
            <React.Fragment>
                <div className="my-2">
                    <Button label="Nuevo" icon="pi pi-plus" severity="info" className="mr-2" onClick={openNew} />
                    <Button label="Eliminar" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} disabled={!selectedClientes || !selectedClientes.length} />
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

    const idBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <span className="p-column-title">Id</span>
                {rowData.id}
            </>
        );
    };

    const empresaBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <span className="p-column-title">Empresa</span>
                {rowData.empresa || '-'}
            </>
        );
    };

    const contactoBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <span className="p-column-title">Contacto</span>
                {rowData.contacto || '-'}
            </>
        );
    };

    const TelefonoBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <span className="p-column-title">Telefono</span>
                {rowData.telefono || '-'}
            </>
        );
    };

    const TipoClienteBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <span className="p-column-title">Tipo de Cliente</span>
                {rowData.tipo_cliente || '-'}
            </>
        );
    };

    const metodoPagoBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <span className="p-column-title">Método Pago</span>
                {rowData.metodo_pago || '-'}
            </>
        );
    };

    const rfcBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <span className="p-column-title">RFC</span>
                {rowData.rfc || '-'}
            </>
        );
    };

    const cfdiBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <span className="p-column-title">CFDI</span>
                {rowData.uso_cfdi || '-'}
            </>
        );
    };

    const RegiFiscalBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <span className="p-column-title">Regimen Fiscal</span>
                {rowData.regimen_fiscal || '-'}
            </>
        );
    };

    const direccionBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <span className="p-column-title">Dirección</span>
                {rowData.direccion || '-'}
            </>
        );
    };

    const obraBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <span className="p-column-title">Obra</span>
                {rowData.obra || '-'}
            </>
        );
    };

    const porcentajeAdminBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <span className="p-column-title">% Admin</span>
                {rowData.porcentaje_administrativo ? `${rowData.porcentaje_administrativo}%` : '0%'}
            </>
        );
    };

    const estatusBodyTemplate = (rowData: Cliente) => {
        return (
            <span className={`product-badge p-tag ${rowData.estatus ? 'p-tag-success' : 'p-tag-danger'}`}>
                {rowData.estatus ? 'Activo' : 'Inactivo'}
            </span>
        );
    };

    const actionBodyTemplate = (rowData: Cliente) => {
        return (
            <>
                <Button icon="pi pi-pencil" rounded severity="info" className="mr-2" onClick={() => editCliente(rowData)} />
                <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteCliente(rowData)} />
            </>
        );
    };

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Clientes</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setGlobalFilter(e.currentTarget.value)} placeholder="Buscar..." />
            </span>
        </div>
    );

    const clienteDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveCliente} />
        </>
    );

    const deleteClienteDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteClienteDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteClienteConfirmado} />
        </>
    );

    const deleteClientesDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteClientesDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteSelectedClientes} />
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
                        value={clientesList}
                        selection={selectedClientes}
                        onSelectionChange={(e) => setSelectedClientes(e.value)}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        className="datatable-responsive"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
                        globalFilter={globalFilter}
                        emptyMessage="No se encontraron registros."
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '4rem' }}></Column>
                        <Column field="id" header="Id" sortable body={idBodyTemplate}></Column>
                        <Column field="empresa" header="Empresa" sortable body={empresaBodyTemplate}></Column>
                        <Column field="contacto" header="Contacto" sortable body={contactoBodyTemplate}></Column>
                        <Column field="telefono" header="Teléfono" sortable body={TelefonoBodyTemplate}></Column>
                        <Column field="direccion" header="Dirección" sortable body={direccionBodyTemplate}></Column>
                        <Column field="Tipo cliente" header="Tipo Cliente" sortable body={TipoClienteBodyTemplate}></Column>
                        <Column field="metodo_pago" header="Método Pago" sortable body={metodoPagoBodyTemplate}></Column>
                        <Column field="rfc" header="RFC" sortable body={rfcBodyTemplate}></Column>
                        <Column field="CFDI" header="CFDI" sortable body={cfdiBodyTemplate}></Column>
                        <Column field="Regimen_Fiscal" header="Régimen Fiscal" sortable body={RegiFiscalBodyTemplate}></Column>
                        <Column field="porcentaje_administrativo" header="% Admin" sortable body={porcentajeAdminBodyTemplate}></Column>
                        <Column field="Obra" header="Obra" sortable body={obraBodyTemplate}></Column>
                        <Column field="estatus" header="Status" sortable body={estatusBodyTemplate}></Column>
                        <Column header="Acción" body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }}></Column>
                    </DataTable>

                    <Dialog visible={clienteDialog} style={{ width: '650px' }} header="Detalles de Cliente" modal className="p-fluid" footer={clienteDialogFooter} onHide={hideDialog}>
                        <div className="field">
                            <label htmlFor="empresa">Empresa</label><span style={{ color: 'red' }}> *</span>
                            <InputText
                                id="empresa"
                                value={cliente.empresa}
                                onChange={(e) => setCliente({ ...cliente, empresa: e.target.value })}
                                required
                                className={submitted && !cliente.empresa ? 'p-invalid' : ''}
                            />
                            {submitted && !cliente.empresa && <small className="p-invalid">Empresa es requerida.</small>}
                        </div>
                        
                        <div className="field">
                            <label htmlFor="contacto">Contacto</label><span style={{ color: 'red' }}> *</span>
                            <InputText
                                id="contacto"
                                value={cliente.contacto}
                                onChange={(e) => setCliente({ ...cliente, contacto: e.target.value })}
                                required
                                className={submitted && !cliente.contacto ? 'p-invalid' : ''}
                            />
                            {submitted && !cliente.contacto && <small className="p-invalid">Contacto es requerido.</small>}
                        </div>

                        <div className="field">
                            <label htmlFor="telefono">Teléfono</label>
                            <InputText
                                id="telefono"
                                value={cliente.telefono || ''}
                                onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="direccion">Dirección</label><span style={{ color: 'red' }}> *</span>
                            <InputText
                                id="direccion"
                                value={cliente.direccion || ''}
                                onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
                            />
                            {submitted && !cliente.direccion && <small className="p-invalid">Direccion es requerido.</small>}
                        </div>

                        <div className="field">
                            <label htmlFor="TipoCliente">Tipo Cliente</label><span style={{ color: 'red' }}> *</span>
                            <Dropdown
                                id="tipo_cliente"
                                value={cliente.tipo_cliente}
                                options={TipoCliente}
                                onChange={(e) => setCliente({ ...cliente, tipo_cliente: e.value })}
                                placeholder="Seleccione método"
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="metodo_pago">Método de Pago</label><span style={{ color: 'red' }}> *</span>
                            <Dropdown
                                id="metodo_pago"
                                value={cliente.metodo_pago}
                                options={metodosPago}
                                onChange={(e) => setCliente({ ...cliente, metodo_pago: e.value })}
                                placeholder="Seleccione método"
                            />
                        </div>

                        {cliente.tipo_cliente === 'Facturado' && (
                            <>
                                <div className="field">
                                    <label htmlFor="rfc">RFC</label><span style={{ color: 'red' }}> *</span>
                                    <InputText
                                        id="rfc"
                                        value={cliente.rfc || ''}
                                        maxLength={13} // Solo permite 13 caracteres
                                        onChange={(e) => setCliente({ ...cliente, rfc: e.target.value })}
                                        className={submitted && cliente.tipo_cliente === 'Facturado' && !cliente.rfc ? 'p-invalid' : ''}
                                    />
                                    {submitted && cliente.tipo_cliente === 'Facturado' && !cliente.rfc && (
                                        <small className="p-invalid">RFC es requerido para facturación</small>
                                    )}
                                </div>

                                <div className="field">
                                    <label htmlFor="uso_cfdi">Uso CFDI</label>
                                    <Dropdown
                                        id="uso_cfdi"
                                        value={cliente.uso_cfdi}
                                        options={usosCFDI}
                                        onChange={(e) => setCliente({ ...cliente, uso_cfdi: e.value })}
                                        placeholder="Seleccione uso CFDI"
                                    />
                                </div>

                                <div className="field">
                                    <label htmlFor="regimen_fiscal">Régimen Fiscal</label>
                                    <InputText
                                        id="regimen_fiscal"
                                        value={cliente.regimen_fiscal || ''}
                                        onChange={(e) => setCliente({ ...cliente, regimen_fiscal: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        <div className="field">
                            <label htmlFor="porcentaje_administrativo">% Administrativo</label>
                            <InputNumber
                                id="porcentaje_administrativo"
                                value={cliente.porcentaje_administrativo || 0}
                                onValueChange={(e) => setCliente({ ...cliente, porcentaje_administrativo: e.value || 0 })}
                                mode="decimal"
                                min={0}
                                max={100}
                                suffix="%"
                                placeholder="Ej: 5%"
                            />
                            <small>Porcentaje que se aplicará a las cuentas por cobrar</small>
                        </div>

                        <div className="field">
                            <label htmlFor="obra">Obra - Proyecto</label>
                            <InputText
                                id="obra"
                                value={cliente.obra || ''}
                                onChange={(e) => setCliente({ ...cliente, obra: e.target.value })}
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="estatus">Estatus</label>
                            <div className="flex align-items-center">
                                <div className="flex align-items-center mr-3">
                                    <RadioButton
                                        inputId="estatus_activo"
                                        name="estatus"
                                        value={1}
                                        onChange={(e) => setCliente({ ...cliente, estatus: 1 })}
                                        checked={cliente.estatus === 1}
                                    />
                                    <label htmlFor="estatus_activo" className="ml-2">Activo</label>
                                </div>
                                <div className="flex align-items-center">
                                    <RadioButton
                                        inputId="estatus_inactivo"
                                        name="estatus"
                                        value={0}
                                        onChange={(e) => setCliente({ ...cliente, estatus: 0 })}
                                        checked={cliente.estatus === 0}
                                    />
                                    <label htmlFor="estatus_inactivo" className="ml-2">Inactivo</label>
                                </div>
                            </div>
                        </div>
                    </Dialog>

                    <Dialog visible={deleteClienteDialog} style={{ width: '450px' }} header="Confirmar" modal footer={deleteClienteDialogFooter} onHide={hideDeleteClienteDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {cliente && (
                                <span>
                                    ¿Estás seguro de eliminar <b>{cliente.empresa}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <Dialog visible={deleteClientesDialog} style={{ width: '450px' }} header="Confirmar" modal footer={deleteClientesDialogFooter} onHide={hideDeleteClientesDialog}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {cliente && <span>¿Estás seguro de eliminar los registros seleccionados?</span>}
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default ClientesCrud;