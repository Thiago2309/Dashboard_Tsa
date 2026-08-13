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
import { MultiSelect } from 'primereact/multiselect';
import { ToggleButton } from 'primereact/togglebutton';
import { Tag } from 'primereact/tag';
import { OrganizationChart } from 'primereact/organizationchart';
import { DataTableFilterMeta } from 'primereact/datatable';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
    fetchDepartamentos,
    createDepartamento,
    updateDepartamento,
    deleteDepartamento,
    fetchEmpleadosDeDepartamento,
    sincronizarEmpleadosDepartamento,
    fetchCeo,
    definirCeo,
    fetchOrganigramaEmpresa,
    Departamento,
    EmpleadoResumen,
    DepartamentoOrganigrama,
    OrganigramaEmpresa
} from '../../../../Services/BD/departamentoService';
import { fetchOperadores, Operador } from '../../../../Services/BD/operadoresService';

interface OrgNode {
    label: string;
    className?: string;
    expanded?: boolean;
    children?: OrgNode[];
    data?: { subtitulo?: string };
}

const DepartamentosCrud = () => {
    const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [departamentoDialog, setDepartamentoDialog] = useState(false);
    const [deleteDepartamentoDialog, setDeleteDepartamentoDialog] = useState(false);
    const [organigramaDialog, setOrganigramaDialog] = useState(false);
    const [ceoDialog, setCeoDialog] = useState(false);
    const [ceoActual, setCeoActual] = useState<EmpleadoResumen | null>(null);
    const [ceoSeleccionado, setCeoSeleccionado] = useState<number | null>(null);
    const [organigrama, setOrganigrama] = useState<OrganigramaEmpresa>({ ceo: null, departamentos: [] });
    const [zoomOrganigrama, setZoomOrganigrama] = useState(1);
    const [generandoPdf, setGenerandoPdf] = useState(false);
    const organigramaRef = useRef<HTMLDivElement>(null);
    const [departamento, setDepartamento] = useState<Departamento>({
        nombre: '',
        descripcion: '',
        departamento_padre_id: null,
        jefe_operador_id: null,
        estatus: true
    });
    const [empleadosACargo, setEmpleadosACargo] = useState<number[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    const cargarDatos = useCallback(async () => {
        try {
            const [departamentosData, operadoresData, ceoData] = await Promise.all([
                fetchDepartamentos(),
                fetchOperadores(),
                fetchCeo()
            ]);
            setDepartamentos(departamentosData);
            setOperadores(operadoresData);
            setCeoActual(ceoData);
        } catch (error) {
            console.error('Error cargando datos:', error);
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar los datos', life: 3000 });
        }
    }, []);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    const openNew = useCallback(() => {
        setDepartamento({ nombre: '', descripcion: '', departamento_padre_id: null, jefe_operador_id: null, estatus: true });
        setEmpleadosACargo([]);
        setSubmitted(false);
        setDepartamentoDialog(true);
    }, []);

    const hideDialog = useCallback(() => {
        setSubmitted(false);
        setDepartamentoDialog(false);
    }, []);

    const hideDeleteDepartamentoDialog = useCallback(() => setDeleteDepartamentoDialog(false), []);

    const saveDepartamento = useCallback(async () => {
        setSubmitted(true);

        if (!departamento.nombre.trim()) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'El nombre del departamento es requerido', life: 3000 });
            return;
        }

        if (departamento.id && departamento.departamento_padre_id === departamento.id) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Un departamento no puede ser su propio padre', life: 3000 });
            return;
        }

        try {
            setLoading(true);
            const guardado = departamento.id
                ? await updateDepartamento(departamento)
                : await createDepartamento(departamento);

            // Los empleados a cargo incluyen siempre al jefe (si se eligió uno)
            const idsACargo = new Set(empleadosACargo);
            if (departamento.jefe_operador_id) idsACargo.add(departamento.jefe_operador_id);
            await sincronizarEmpleadosDepartamento(guardado.id!, Array.from(idsACargo));

            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: departamento.id ? 'Departamento actualizado correctamente' : 'Departamento creado correctamente',
                life: 3000
            });

            setDepartamentoDialog(false);
            const [departamentosActualizados, operadoresActualizados] = await Promise.all([fetchDepartamentos(), fetchOperadores()]);
            setDepartamentos(departamentosActualizados);
            setOperadores(operadoresActualizados);
        } catch (error: any) {
            console.error('Error:', error);
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message || 'Error al guardar el departamento', life: 3000 });
        } finally {
            setLoading(false);
        }
    }, [departamento, empleadosACargo]);

    const editDepartamento = useCallback(async (dep: Departamento) => {
        setDepartamento({ ...dep });
        try {
            const empleadosActuales = await fetchEmpleadosDeDepartamento(dep.id!);
            setEmpleadosACargo(empleadosActuales.map(e => e.id));
        } catch (error) {
            setEmpleadosACargo([]);
        }
        setDepartamentoDialog(true);
    }, []);

    const confirmDeleteDepartamento = useCallback((dep: Departamento) => {
        setDepartamento(dep);
        setDeleteDepartamentoDialog(true);
    }, []);

    const deleteDepartamentoConfirmado = useCallback(async () => {
        try {
            await deleteDepartamento(departamento.id!);
            setDeleteDepartamentoDialog(false);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Departamento eliminado', life: 3000 });
            const departamentosActualizados = await fetchDepartamentos();
            setDepartamentos(departamentosActualizados);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar. Verifica que no tenga empleados o sub-departamentos asignados.', life: 4000 });
        }
    }, [departamento]);

    const abrirCeoDialog = useCallback(() => {
        setCeoSeleccionado(ceoActual?.id ?? null);
        setCeoDialog(true);
    }, [ceoActual]);

    const guardarCeo = useCallback(async () => {
        try {
            setLoading(true);
            await definirCeo(ceoSeleccionado);
            const nuevoCeo = await fetchCeo();
            setCeoActual(nuevoCeo);
            setCeoDialog(false);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'CEO actualizado correctamente', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo definir el CEO', life: 3000 });
        } finally {
            setLoading(false);
        }
    }, [ceoSeleccionado]);

    const abrirOrganigrama = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchOrganigramaEmpresa();
            setOrganigrama(data);
            setZoomOrganigrama(1);
            setOrganigramaDialog(true);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el organigrama', life: 3000 });
        } finally {
            setLoading(false);
        }
    }, []);

    const acercarOrganigrama = useCallback(() => setZoomOrganigrama(z => Math.min(Math.round((z + 0.1) * 10) / 10, 2)), []);
    const alejarOrganigrama = useCallback(() => setZoomOrganigrama(z => Math.max(Math.round((z - 0.1) * 10) / 10, 0.3)), []);
    const restablecerZoomOrganigrama = useCallback(() => setZoomOrganigrama(1), []);

    const descargarOrganigramaPDF = useCallback(async () => {
        if (!organigramaRef.current) return;

        const zoomPrevio = zoomOrganigrama;
        try {
            setGenerandoPdf(true);
            // Renderizamos a escala 1 para capturar el árbol completo, sin recortes por el zoom en pantalla
            setZoomOrganigrama(1);
            await new Promise(resolve => setTimeout(resolve, 150));

            const canvas = await html2canvas(organigramaRef.current, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true
            });

            const imgData = canvas.toDataURL('image/png');
            const orientacion = canvas.width >= canvas.height ? 'l' : 'p';
            const pdf = new jsPDF(orientacion, 'pt', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            // Ajustamos la imagen completa dentro de la página, conservando proporción
            const margen = 20;
            const anchoDisponible = pageWidth - margen * 2;
            const altoDisponible = pageHeight - margen * 2;
            const escala = Math.min(anchoDisponible / canvas.width, altoDisponible / canvas.height);
            const imgWidth = canvas.width * escala;
            const imgHeight = canvas.height * escala;
            const x = (pageWidth - imgWidth) / 2;
            const y = (pageHeight - imgHeight) / 2;

            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
            pdf.save('organigrama-empresa.pdf');
        } catch (error) {
            console.error('Error generando PDF del organigrama:', error);
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el PDF del organigrama', life: 3000 });
        } finally {
            setZoomOrganigrama(zoomPrevio);
            setGenerandoPdf(false);
        }
    }, [zoomOrganigrama]);

    const arbolOrganigrama: OrgNode[] = useMemo(() => {
        const nodoEmpleado = (emp: EmpleadoResumen): OrgNode => ({
            label: emp.nombre,
            className: 'org-node-empleado',
            data: { subtitulo: emp.puesto }
        });

        const nodoDepartamento = (dep: DepartamentoOrganigrama): OrgNode => ({
            label: dep.nombre,
            expanded: true,
            className: 'org-node-departamento',
            data: { subtitulo: dep.jefe ? `Jefe: ${dep.jefe.nombre}` : 'Sin jefe asignado' },
            children: [
                ...dep.subdepartamentos.map(nodoDepartamento),
                ...dep.empleados.map(nodoEmpleado)
            ]
        });

        const nodosDepartamentos = organigrama.departamentos.map(nodoDepartamento);

        if (organigrama.ceo) {
            return [{
                label: organigrama.ceo.nombre,
                expanded: true,
                className: 'org-node-ceo',
                data: { subtitulo: organigrama.ceo.puesto },
                children: nodosDepartamentos
            }];
        }

        if (nodosDepartamentos.length <= 1) return nodosDepartamentos;

        return [{
            label: 'Empresa',
            expanded: true,
            className: 'org-node-empresa',
            children: nodosDepartamentos
        }];
    }, [organigrama]);

    const nodeTemplate = useCallback((node: any) => {
        return (
            <div className="p-2 text-center">
                <div className="font-bold">{node.label}</div>
                {node.data?.subtitulo && <div className="text-sm text-500">{node.data.subtitulo}</div>}
            </div>
        );
    }, []);

    const exportCSV = useCallback(() => {
        dt.current?.exportCSV();
    }, []);

    const nombreBodyTemplate = useCallback((rowData: Departamento) => <span>{rowData.nombre}</span>, []);
    const padreBodyTemplate = useCallback((rowData: Departamento) => <span>{rowData.departamento_padre_nombre || 'CEO (directo)'}</span>, []);
    const jefeBodyTemplate = useCallback((rowData: Departamento) => <span>{rowData.jefe_nombre || '-'}</span>, []);
    const empleadosBodyTemplate = useCallback((rowData: Departamento) => <span>{rowData.total_empleados ?? 0}</span>, []);

    const estatusBodyTemplate = useCallback((rowData: Departamento) => (
        <span className={`px-3 py-1 border-round text-sm font-medium ${rowData.estatus ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {rowData.estatus ? 'Activo' : 'Inactivo'}
        </span>
    ), []);

    const actionBodyTemplate = useCallback((rowData: Departamento) => (
        <div className="flex gap-2">
            <Button icon="pi pi-pencil" rounded severity="info" onClick={() => editDepartamento(rowData)} />
            <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDeleteDepartamento(rowData)} />
        </div>
    ), [editDepartamento, confirmDeleteDepartamento]);

    const leftToolbarTemplate = useCallback(() => (
        <div className="my-2 flex flex-wrap align-items-center gap-2">
            <Button label="Nuevo Departamento" icon="pi pi-plus" severity="info" onClick={openNew} />
            <Button label="Ver Organigrama" icon="pi pi-sitemap" severity="help" onClick={abrirOrganigrama} loading={loading} />
            <Button label={ceoActual ? 'Cambiar CEO' : 'Definir CEO'} icon="pi pi-star" severity="warning" onClick={abrirCeoDialog} />
            {ceoActual && <Tag severity="warning" value={`CEO actual: ${ceoActual.nombre}`} />}
        </div>
    ), [openNew, abrirOrganigrama, abrirCeoDialog, loading, ceoActual]);

    const rightToolbarTemplate = useCallback(() => (
        <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={exportCSV} />
    ), [exportCSV]);

    const header = useCallback(() => (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Gestión de Departamentos</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText
                    type="search"
                    onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })}
                    placeholder="Buscar..."
                />
            </span>
        </div>
    ), [filters]);

    const departamentoDialogFooter = useCallback(() => (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={saveDepartamento} loading={loading} />
        </>
    ), [hideDialog, saveDepartamento, loading]);

    const deleteDepartamentoDialogFooter = useCallback(() => (
        <>
            <Button label="No" icon="pi pi-times" text onClick={hideDeleteDepartamentoDialog} />
            <Button label="Sí" icon="pi pi-check" text onClick={deleteDepartamentoConfirmado} />
        </>
    ), [hideDeleteDepartamentoDialog, deleteDepartamentoConfirmado]);

    const ceoDialogFooter = useCallback(() => (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={() => setCeoDialog(false)} />
            <Button label="Guardar" icon="pi pi-check" text onClick={guardarCeo} loading={loading} />
        </>
    ), [guardarCeo, loading]);

    const opcionesDepartamentoPadre = useMemo(
        () => departamentos.filter(d => d.id !== departamento.id).map(d => ({ label: d.nombre, value: d.id })),
        [departamentos, departamento.id]
    );

    const opcionesOperadores = useMemo(
        () => operadores.map(o => ({ label: `${o.nombre} (${o.puesto})`, value: o.id })),
        [operadores]
    );

    const opcionesEmpleadosACargo = useMemo(
        () => operadores
            .filter(o => o.id !== departamento.jefe_operador_id)
            .map(o => ({ label: `${o.nombre} (${o.puesto})`, value: o.id })),
        [operadores, departamento.jefe_operador_id]
    );

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <style jsx global>{`
                        .org-node-ceo { background: var(--primary-color); color: var(--primary-color-text); border-radius: 6px; }
                        .org-node-departamento { background: var(--surface-200); border-radius: 6px; font-weight: 600; }
                        .org-node-empleado { background: var(--surface-card); border-radius: 6px; }
                        .org-node-empresa { background: var(--surface-300); border-radius: 6px; }
                    `}</style>
                    <Toolbar className="mb-4" left={leftToolbarTemplate} right={rightToolbarTemplate}></Toolbar>

                    <DataTable
                        ref={dt}
                        value={departamentos}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[5, 10, 25]}
                        className="datatable-responsive"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} departamentos"
                        filters={filters}
                        emptyMessage="No se encontraron departamentos"
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column field="nombre" header="Departamento" sortable body={nombreBodyTemplate}></Column>
                        <Column field="departamento_padre_nombre" header="Depende de" body={padreBodyTemplate}></Column>
                        <Column field="jefe_nombre" header="Jefe de Departamento" body={jefeBodyTemplate}></Column>
                        <Column field="total_empleados" header="Empleados" body={empleadosBodyTemplate}></Column>
                        <Column field="estatus" header="Estatus" body={estatusBodyTemplate}></Column>
                        <Column header="Acciones" body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }}></Column>
                    </DataTable>

                    <Dialog
                        visible={departamentoDialog}
                        style={{ width: '600px' }}
                        header={departamento.id ? 'Editar Departamento' : 'Nuevo Departamento'}
                        modal
                        className="p-fluid"
                        footer={departamentoDialogFooter}
                        onHide={hideDialog}
                    >
                        <div className="grid">
                            <div className="col-12">
                                <div className="field">
                                    <label htmlFor="nombre">Nombre del departamento *</label>
                                    <InputText
                                        id="nombre"
                                        value={departamento.nombre}
                                        onChange={(e) => setDepartamento({ ...departamento, nombre: e.target.value })}
                                        required
                                        autoFocus
                                        className={submitted && !departamento.nombre ? 'p-invalid' : ''}
                                    />
                                    {submitted && !departamento.nombre && <small className="p-invalid">El nombre es requerido.</small>}
                                </div>
                            </div>

                            <div className="col-12">
                                <div className="field">
                                    <label htmlFor="descripcion">Descripción</label>
                                    <InputTextarea
                                        id="descripcion"
                                        value={departamento.descripcion || ''}
                                        onChange={(e) => setDepartamento({ ...departamento, descripcion: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <div className="col-12 md:col-6">
                                <div className="field">
                                    <label htmlFor="departamento_padre_id">Depende de</label>
                                    <Dropdown
                                        id="departamento_padre_id"
                                        value={departamento.departamento_padre_id}
                                        options={opcionesDepartamentoPadre}
                                        onChange={(e) => setDepartamento({ ...departamento, departamento_padre_id: e.value })}
                                        placeholder="Depende directamente del CEO"
                                        showClear
                                        filter
                                    />
                                    <small className="text-500">Déjalo vacío si el departamento depende directamente del CEO.</small>
                                </div>
                            </div>

                            <div className="col-12 md:col-6">
                                <div className="field">
                                    <label htmlFor="jefe_operador_id">Jefe de departamento</label>
                                    <Dropdown
                                        id="jefe_operador_id"
                                        value={departamento.jefe_operador_id}
                                        options={opcionesOperadores}
                                        onChange={(e) => setDepartamento({ ...departamento, jefe_operador_id: e.value })}
                                        placeholder="Selecciona un empleado"
                                        showClear
                                        filter
                                    />
                                </div>
                            </div>

                            <div className="col-12">
                                <div className="field">
                                    <label htmlFor="empleados_a_cargo">Empleados a cargo</label>
                                    <MultiSelect
                                        id="empleados_a_cargo"
                                        value={empleadosACargo}
                                        options={opcionesEmpleadosACargo}
                                        onChange={(e) => setEmpleadosACargo(e.value)}
                                        placeholder="Selecciona los empleados de este departamento"
                                        display="chip"
                                        filter
                                    />
                                    <small className="text-500">Al guardar, estos empleados quedarán asignados a este departamento (se reasignan si pertenecían a otro).</small>
                                </div>
                            </div>

                            {departamento.id && (
                                <div className="col-12">
                                    <div className="field">
                                        <ToggleButton
                                            checked={departamento.estatus}
                                            onChange={(e) => setDepartamento({ ...departamento, estatus: e.value })}
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
                        visible={deleteDepartamentoDialog}
                        style={{ width: '450px' }}
                        header="Confirmar"
                        modal
                        footer={deleteDepartamentoDialogFooter}
                        onHide={hideDeleteDepartamentoDialog}
                    >
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {departamento && (
                                <span>
                                    ¿Estás seguro de eliminar el departamento <b>{departamento.nombre}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <Dialog
                        visible={ceoDialog}
                        style={{ width: '450px' }}
                        header="Definir CEO de la empresa"
                        modal
                        className="p-fluid"
                        footer={ceoDialogFooter}
                        onHide={() => setCeoDialog(false)}
                    >
                        <div className="field">
                            <label htmlFor="ceo_id">Empleado</label>
                            <Dropdown
                                id="ceo_id"
                                value={ceoSeleccionado}
                                options={opcionesOperadores}
                                onChange={(e) => setCeoSeleccionado(e.value)}
                                placeholder="Selecciona al CEO"
                                showClear
                                filter
                            />
                            <small className="text-500">Es la cabeza de la jerarquía: de él dependen directamente todos los departamentos raíz.</small>
                        </div>
                    </Dialog>

                    <Dialog
                        visible={organigramaDialog}
                        style={{ width: '90vw' }}
                        header="Organigrama de la Empresa"
                        modal
                        maximizable
                        onHide={() => setOrganigramaDialog(false)}
                    >
                        {arbolOrganigrama.length === 0 ? (
                            <div className="text-center py-5 text-500">
                                No hay datos suficientes para generar el organigrama. Define un CEO y crea al menos un departamento con empleados asignados.
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                                    <div className="flex align-items-center gap-2">
                                        <Button icon="pi pi-search-minus" rounded outlined onClick={alejarOrganigrama} disabled={zoomOrganigrama <= 0.3} tooltip="Alejar" />
                                        <span className="font-medium" style={{ minWidth: '3.5rem', textAlign: 'center' }}>{Math.round(zoomOrganigrama * 100)}%</span>
                                        <Button icon="pi pi-search-plus" rounded outlined onClick={acercarOrganigrama} disabled={zoomOrganigrama >= 2} tooltip="Acercar" />
                                        <Button icon="pi pi-refresh" rounded outlined onClick={restablecerZoomOrganigrama} tooltip="Restablecer zoom" />
                                    </div>
                                    <Button
                                        label="Descargar PDF"
                                        icon="pi pi-file-pdf"
                                        severity="danger"
                                        onClick={descargarOrganigramaPDF}
                                        loading={generandoPdf}
                                    />
                                </div>
                                <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
                                    <div
                                        ref={organigramaRef}
                                        style={{
                                            display: 'inline-block',
                                            transform: `scale(${zoomOrganigrama})`,
                                            transformOrigin: 'top left',
                                            padding: '1rem'
                                        }}
                                    >
                                        <OrganizationChart value={arbolOrganigrama as any} nodeTemplate={nodeTemplate} />
                                    </div>
                                </div>
                            </>
                        )}
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default DepartamentosCrud;
