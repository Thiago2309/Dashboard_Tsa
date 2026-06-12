'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import { Dropdown } from 'primereact/dropdown';
import { RadioButton } from 'primereact/radiobutton';
import React, { useEffect, useRef, useState } from 'react';
import { 
    fetchInvitados, 
    createInvitado, 
    updateInvitado, 
    deleteInvitado, 
    Invitado 
} from '../../../../Services/BD/invitadosService';

const InvitadosCrud = () => {
    const emptyInvitado: Invitado = {
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
        porcentaje_participacion: 0,
        estatus: 1,
    };

    const [invitados, setInvitados] = useState<Invitado[]>([]);
    const [invitadoDialog, setInvitadoDialog] = useState(false);
    const [deleteInvitadoDialog, setDeleteInvitadoDialog] = useState(false);
    const [deleteInvitadosDialog, setDeleteInvitadosDialog] = useState(false);
    const [invitado, setInvitado] = useState<Invitado>(emptyInvitado);
    const [selectedInvitados, setSelectedInvitados] = useState<Invitado[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    const metodosPago = [
        { label: 'Efectivo', value: 'Efectivo' },
        { label: 'Transferencia', value: 'Transferencia' }
    ];

    const TipoCliente = [
        { label: 'Efectivo', value: 'Efectivo' },
        { label: 'Facturado', value: 'Facturado' }
    ];

    const usosCFDI = [
        { label: 'G01 - Adquisición de mercancías', value: 'G01' },
        { label: 'G03 - Gastos en general', value: 'G03' },
    ];

    useEffect(() => {
        fetchInvitados().then(setInvitados);
    }, []);

    const openNew = () => {
        setInvitado(emptyInvitado);
        setSubmitted(false);
        setInvitadoDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setInvitadoDialog(false);
    };

    const hideDeleteInvitadoDialog = () => {
        setDeleteInvitadoDialog(false);
    };

    const hideDeleteInvitadosDialog = () => {
        setDeleteInvitadosDialog(false);
    };

    const saveInvitado = async () => {
        setSubmitted(true);
    
        if (invitado.empresa.trim() && invitado.contacto.trim()) {
            if (invitado.tipo_cliente === 'Facturado' && !invitado.rfc) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'RFC es requerido para facturación', life: 3000 });
                return;
            }

            try {
                if (invitado.id) {
                    const updatedInvitado = await updateInvitado(invitado);
                    setInvitados(invitados.map(i => i.id === updatedInvitado.id ? updatedInvitado : i));
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Invitado actualizado', life: 3000 });
                } else {
                    const newInvitado = await createInvitado(invitado);
                    setInvitados([...invitados, newInvitado]);
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Invitado creado', life: 3000 });
                }
                setInvitadoDialog(false);
                setInvitado(emptyInvitado);
                fetchInvitados().then(setInvitados);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar invitado', life: 3000 });
            }
        }
    };

    const editInvitado = (invitado: Invitado) => {
        setInvitado({ ...invitado });
        setInvitadoDialog(true);
    };

    const confirmDeleteInvitado = (invitado: Invitado) => {
        setInvitado(invitado);
        setDeleteInvitadoDialog(true);
    };

    const deleteInvitadoConfirmado = async () => {
        try {
            await deleteInvitado(invitado.id!);
            setInvitados(invitados.filter(i => i.id !== invitado.id));
            setDeleteInvitadoDialog(false);
            setInvitado(emptyInvitado);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Invitado eliminado', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar invitado', life: 3000 });
        }
    };

    const exportCSV = () => {
        dt.current?.exportCSV();
    };

    const confirmDeleteSelected = () => {
        setDeleteInvitadosDialog(true);
    };

    const deleteSelectedInvitados = async () => {
        try {
            await Promise.all(selectedInvitados.map(i => deleteInvitado(i.id!)));
            setInvitados(invitados.filter(i => !selectedInvitados.includes(i)));
            setDeleteInvitadosDialog(false);
            setSelectedInvitados([]);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Invitados eliminados', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar invitados', life: 3000 });
        }
    };

    const leftToolbarTemplate = () => {
        return (
            <div className="my-2">
                <Button label="Nuevo" icon="pi pi-plus" severity="info" className="mr-2" onClick={openNew} />
                <Button label="Eliminar" icon="pi pi-trash" severity="danger" onClick={confirmDeleteSelected} 
                    disabled={!selectedInvitados || selectedInvitados.length === 0} />
            </div>
        );
    };

    const rightToolbarTemplate = () => {
        return (
            <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={exportCSV} />
        );
    };

    const empresaBodyTemplate = (rowData: Invitado) => {
        return <span>{rowData.empresa || '-'}</span>;
    };

    const contactoBodyTemplate = (rowData: Invitado) => {
        return <span>{rowData.contacto || '-'}</span>;
    };

    const telefonoBodyTemplate = (rowData: Invitado) => {
        return <span>{rowData.telefono || '-'}</span>;
    };

    const tipoClienteBodyTemplate = (rowData: Invitado) => {
        return <span>{rowData.tipo_cliente || '-'}</span>;
    };

    const metodoPagoBodyTemplate = (rowData: Invitado) => {
        return <span>{rowData.metodo_pago || '-'}</span>;
    };

    const rfcBodyTemplate = (rowData: Invitado) => {
        return <span>{rowData.rfc || '-'}</span>;
    };

    const cfdiBodyTemplate = (rowData: Invitado) => {
        return <span>{rowData.uso_cfdi || '-'}</span>;
    };

    const regimenFiscalBodyTemplate = (rowData: Invitado) => {
        return <span>{rowData.regimen_fiscal || '-'}</span>;
    };

    const direccionBodyTemplate = (rowData: Invitado) => {
        return <span>{rowData.direccion || '-'}</span>;
    };

    const obraBodyTemplate = (rowData: Invitado) => {
        return <span>{rowData.obra || '-'}</span>;
    };

    const porcentajeBodyTemplate = (rowData: Invitado) => {
        return <span>{rowData.porcentaje_participacion ? `${rowData.porcentaje_participacion}%` : '0%'}</span>;
    };

    const estatusBodyTemplate = (rowData: Invitado) => {
        return (
            <span className={`p-tag ${rowData.estatus === 1 ? 'p-tag-success' : 'p-tag-danger'}`}>
                {rowData.estatus === 1 ? 'Activo' : 'Inactivo'}
            </span>
        );
    };

    const actionBodyTemplate = (rowData: Invitado) => {
        return (
            <div className="flex gap-2">
                <Button icon="pi pi-pencil" rounded severity="info" onClick={() => editInvitado(rowData)} />
                <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteInvitado(rowData)} />
            </div>
        );
    };

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Invitados</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setGlobalFilter(e.currentTarget.value)} placeholder="Buscar..." />
            </span>
        </div>
    );

    const invitadoDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveInvitado} />
        </>
    );

    const deleteInvitadoDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteInvitadoDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteInvitadoConfirmado} />
        </>
    );

    const deleteInvitadosDialogFooter = (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteInvitadosDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteSelectedInvitados} />
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
                        value={invitados}
                        selection={selectedInvitados}
                        onSelectionChange={(e) => setSelectedInvitados(e.value)}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        className="datatable-responsive"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} invitados"
                        globalFilter={globalFilter}
                        emptyMessage="No se encontraron invitados"
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                        <Column field="empresa" header="Empresa" sortable body={empresaBodyTemplate}></Column>
                        <Column field="contacto" header="Contacto" sortable body={contactoBodyTemplate}></Column>
                        <Column field="telefono" header="Teléfono" sortable body={telefonoBodyTemplate}></Column>
                        <Column field="direccion" header="Dirección" sortable body={direccionBodyTemplate}></Column>
                        <Column field="tipo_cliente" header="Tipo" sortable body={tipoClienteBodyTemplate}></Column>
                        <Column field="metodo_pago" header="Método Pago" sortable body={metodoPagoBodyTemplate}></Column>
                        <Column field="rfc" header="RFC" sortable body={rfcBodyTemplate}></Column>
                        <Column field="uso_cfdi" header="CFDI" sortable body={cfdiBodyTemplate}></Column>
                        <Column field="regimen_fiscal" header="Régimen Fiscal" sortable body={regimenFiscalBodyTemplate}></Column>
                        <Column field="obra" header="Obra" sortable body={obraBodyTemplate}></Column>
                        <Column field="porcentaje_participacion" header="Porcentaje" sortable body={porcentajeBodyTemplate}></Column>
                        <Column field="estatus" header="Estatus" sortable body={estatusBodyTemplate}></Column>
                        <Column header="Acciones" body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }}></Column>
                    </DataTable>

                    <Dialog
                        visible={invitadoDialog}
                        style={{ width: '600px' }}
                        header={invitado.id ? 'Editar Invitado' : 'Nuevo Invitado'}
                        modal
                        className="p-fluid"
                        footer={invitadoDialogFooter}
                        onHide={hideDialog}
                    >
                        <div className="field">
                            <label htmlFor="empresa">Empresa</label><span style={{ color: 'red' }}> *</span>
                            <InputText
                                id="empresa"
                                value={invitado.empresa}
                                onChange={(e) => setInvitado({ ...invitado, empresa: e.target.value })}
                                required
                                className={submitted && !invitado.empresa ? 'p-invalid' : ''}
                            />
                            {submitted && !invitado.empresa && <small className="p-invalid">Empresa es requerida.</small>}
                        </div>
                        
                        <div className="field">
                            <label htmlFor="contacto">Contacto</label><span style={{ color: 'red' }}> *</span>
                            <InputText
                                id="contacto"
                                value={invitado.contacto}
                                onChange={(e) => setInvitado({ ...invitado, contacto: e.target.value })}
                                required
                                className={submitted && !invitado.contacto ? 'p-invalid' : ''}
                            />
                            {submitted && !invitado.contacto && <small className="p-invalid">Contacto es requerido.</small>}
                        </div>

                        <div className="field">
                            <label htmlFor="telefono">Teléfono</label>
                            <InputText
                                id="telefono"
                                value={invitado.telefono || ''}
                                onChange={(e) => setInvitado({ ...invitado, telefono: e.target.value.replace(/\D/g, '') })}
                                keyfilter="int"
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="direccion">Dirección</label>
                            <InputText
                                id="direccion"
                                value={invitado.direccion || ''}
                                onChange={(e) => setInvitado({ ...invitado, direccion: e.target.value })}
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="tipo_cliente">Tipo Invitado</label>
                            <Dropdown
                                id="tipo_cliente"
                                value={invitado.tipo_cliente}
                                options={TipoCliente}
                                onChange={(e) => setInvitado({ ...invitado, tipo_cliente: e.value })}
                                placeholder="Seleccione tipo"
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="metodo_pago">Método de Pago</label>
                            <Dropdown
                                id="metodo_pago"
                                value={invitado.metodo_pago}
                                options={metodosPago}
                                onChange={(e) => setInvitado({ ...invitado, metodo_pago: e.value })}
                                placeholder="Seleccione método"
                            />
                        </div>

                        {invitado.tipo_cliente === 'Facturado' && (
                            <>
                                <div className="field">
                                    <label htmlFor="rfc">RFC</label><span style={{ color: 'red' }}> *</span>
                                    <InputText
                                        id="rfc"
                                        value={invitado.rfc || ''}
                                        maxLength={13}
                                        onChange={(e) => setInvitado({ ...invitado, rfc: e.target.value })}
                                        className={submitted && invitado.tipo_cliente === 'Facturado' && !invitado.rfc ? 'p-invalid' : ''}
                                    />
                                    {submitted && invitado.tipo_cliente === 'Facturado' && !invitado.rfc && (
                                        <small className="p-invalid">RFC es requerido para facturación</small>
                                    )}
                                </div>

                                <div className="field">
                                    <label htmlFor="uso_cfdi">Uso CFDI</label>
                                    <Dropdown
                                        id="uso_cfdi"
                                        value={invitado.uso_cfdi}
                                        options={usosCFDI}
                                        onChange={(e) => setInvitado({ ...invitado, uso_cfdi: e.value })}
                                        placeholder="Seleccione uso CFDI"
                                    />
                                </div>

                                <div className="field">
                                    <label htmlFor="regimen_fiscal">Régimen Fiscal</label>
                                    <InputText
                                        id="regimen_fiscal"
                                        value={invitado.regimen_fiscal || ''}
                                        onChange={(e) => setInvitado({ ...invitado, regimen_fiscal: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        <div className="field">
                            <label htmlFor="obra">Obra - Proyecto</label>
                            <InputText
                                id="obra"
                                value={invitado.obra || ''}
                                onChange={(e) => setInvitado({ ...invitado, obra: e.target.value })}
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="porcentaje_participacion">% Participación</label>
                            <InputText
                                id="porcentaje_participacion"
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={(invitado.porcentaje_participacion || 0).toString()}
                                onChange={(e) => setInvitado({ ...invitado, porcentaje_participacion: parseFloat(e.target.value) || 0 })}
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
                                        onChange={(e) => setInvitado({ ...invitado, estatus: 1 })}
                                        checked={invitado.estatus === 1}
                                    />
                                    <label htmlFor="estatus_activo" className="ml-2">Activo</label>
                                </div>
                                <div className="flex align-items-center">
                                    <RadioButton
                                        inputId="estatus_inactivo"
                                        name="estatus"
                                        value={0}
                                        onChange={(e) => setInvitado({ ...invitado, estatus: 0 })}
                                        checked={invitado.estatus === 0}
                                    />
                                    <label htmlFor="estatus_inactivo" className="ml-2">Inactivo</label>
                                </div>
                            </div>
                        </div>
                    </Dialog>

                    <Dialog
                        visible={deleteInvitadoDialog}
                        style={{ width: '450px' }}
                        header="Confirmar"
                        modal
                        footer={deleteInvitadoDialogFooter}
                        onHide={hideDeleteInvitadoDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {invitado && (
                                <span>
                                    ¿Estás seguro de eliminar a <b>{invitado.empresa}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <Dialog
                        visible={deleteInvitadosDialog}
                        style={{ width: '450px' }}
                        header="Confirmar"
                        modal
                        footer={deleteInvitadosDialogFooter}
                        onHide={hideDeleteInvitadosDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {invitado && <span>¿Estás seguro de eliminar los invitados seleccionados?</span>}
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default InvitadosCrud;