'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
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
    fetchCeo,
    fetchJerarquiaEmpleados,
    Departamento,
    EmpleadoResumen,
    OperadorJerarquia
} from '../../../../Services/BD/departamentoService';

interface OrgNode {
    label: string;
    className?: string;
    expanded?: boolean;
    children?: OrgNode[];
    data?: { puesto?: string; departamentoNombre?: string };
}

const DepartamentosCrud = () => {
    const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
    const [departamentoDialog, setDepartamentoDialog] = useState(false);
    const [deleteDepartamentoDialog, setDeleteDepartamentoDialog] = useState(false);
    const [empleadosDialog, setEmpleadosDialog] = useState(false);
    const [empleadosDepartamentoActual, setEmpleadosDepartamentoActual] = useState<{ nombre: string; empleados: EmpleadoResumen[] }>({ nombre: '', empleados: [] });
    const [organigramaDialog, setOrganigramaDialog] = useState(false);
    const [ceoActual, setCeoActual] = useState<EmpleadoResumen | null>(null);
    const [jerarquia, setJerarquia] = useState<OperadorJerarquia[]>([]);
    const [departamento, setDepartamento] = useState<Departamento>({ nombre: '', descripcion: '', estatus: true });
    const [zoomOrganigrama, setZoomOrganigrama] = useState(1);
    const [generandoPdf, setGenerandoPdf] = useState(false);
    const organigramaRef = useRef<HTMLDivElement>(null);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);

    const cargarDatos = useCallback(async () => {
        try {
            const [departamentosData, ceoData] = await Promise.all([
                fetchDepartamentos(),
                fetchCeo()
            ]);
            setDepartamentos(departamentosData);
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
        setDepartamento({ nombre: '', descripcion: '', estatus: true });
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

        try {
            setLoading(true);
            if (departamento.id) {
                await updateDepartamento(departamento);
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Departamento actualizado correctamente', life: 3000 });
            } else {
                await createDepartamento(departamento);
                toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Departamento creado correctamente', life: 3000 });
            }
            setDepartamentoDialog(false);
            const departamentosActualizados = await fetchDepartamentos();
            setDepartamentos(departamentosActualizados);
        } catch (error: any) {
            console.error('Error:', error);
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message || 'Error al guardar el departamento', life: 3000 });
        } finally {
            setLoading(false);
        }
    }, [departamento]);

    const editDepartamento = useCallback((dep: Departamento) => {
        setDepartamento({ ...dep });
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
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar. Verifica que no tenga empleados asignados.', life: 4000 });
        }
    }, [departamento]);

    const verEmpleadosDepartamento = useCallback(async (dep: Departamento) => {
        try {
            const empleados = await fetchEmpleadosDeDepartamento(dep.id!);
            setEmpleadosDepartamentoActual({ nombre: dep.nombre, empleados });
            setEmpleadosDialog(true);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la lista de empleados', life: 3000 });
        }
    }, []);

    const abrirOrganigrama = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchJerarquiaEmpleados();
            setJerarquia(data);
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
            setZoomOrganigrama(1);
            await new Promise(resolve => setTimeout(resolve, 150));

            const canvas = await html2canvas(organigramaRef.current, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true
            });

            const orientacion = canvas.width >= canvas.height ? 'l' : 'p';
            const pdf = new jsPDF(orientacion, 'pt', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margen = 24;
            const anchoDisponible = pageWidth - margen * 2;
            const altoDisponible = pageHeight - margen * 2;

            // Si el organigrama tiene muchos empleados, forzar todo en una sola página lo encoge
            // hasta hacer ilegibles los nombres y puestos. Se fija una escala mínima legible y,
            // cuando no cabe completo a esa escala, se reparte en varias páginas tipo póster.
            const ESCALA_MINIMA_LEGIBLE = 0.62;
            const escalaUnaPagina = Math.min(anchoDisponible / canvas.width, altoDisponible / canvas.height);

            if (escalaUnaPagina >= ESCALA_MINIMA_LEGIBLE) {
                const imgWidth = canvas.width * escalaUnaPagina;
                const imgHeight = canvas.height * escalaUnaPagina;
                const x = (pageWidth - imgWidth) / 2;
                const y = (pageHeight - imgHeight) / 2;
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, imgWidth, imgHeight);
            } else {
                const escala = ESCALA_MINIMA_LEGIBLE;
                const anchoTilePx = Math.floor(anchoDisponible / escala);
                const altoTilePx = Math.floor(altoDisponible / escala);
                const columnas = Math.max(1, Math.ceil(canvas.width / anchoTilePx));
                const filas = Math.max(1, Math.ceil(canvas.height / altoTilePx));

                const tileCanvas = document.createElement('canvas');
                const tileCtx = tileCanvas.getContext('2d')!;

                let primera = true;
                for (let fila = 0; fila < filas; fila++) {
                    for (let col = 0; col < columnas; col++) {
                        const sx = col * anchoTilePx;
                        const sy = fila * altoTilePx;
                        const sw = Math.min(anchoTilePx, canvas.width - sx);
                        const sh = Math.min(altoTilePx, canvas.height - sy);

                        tileCanvas.width = sw;
                        tileCanvas.height = sh;
                        tileCtx.clearRect(0, 0, sw, sh);
                        tileCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

                        if (!primera) pdf.addPage('a4', orientacion);
                        primera = false;

                        pdf.addImage(tileCanvas.toDataURL('image/png'), 'PNG', margen, margen, sw * escala, sh * escala);
                        pdf.setFontSize(8);
                        pdf.setTextColor(150);
                        pdf.text(`Fila ${fila + 1} de ${filas} · Columna ${col + 1} de ${columnas}`, margen, pageHeight - 8);
                    }
                }
            }

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
        if (jerarquia.length === 0) return [];

        const porId = new Map(jerarquia.map(e => [e.id, e]));
        const hijosDe = new Map<number, OperadorJerarquia[]>();
        jerarquia.forEach(e => {
            if (e.jefe_inmediato_id && porId.has(e.jefe_inmediato_id)) {
                const lista = hijosDe.get(e.jefe_inmediato_id) || [];
                lista.push(e);
                hijosDe.set(e.jefe_inmediato_id, lista);
            }
        });

        const construirNodo = (emp: OperadorJerarquia, visitados: Set<number>, nivel: number): OrgNode => {
            visitados.add(emp.id);
            const hijos = (hijosDe.get(emp.id) || []).filter(h => !visitados.has(h.id));
            const claseNivel = emp.es_ceo ? 'org-node-ceo' : nivel === 1 ? 'org-node-gerente' : 'org-node-empleado';
            return {
                label: emp.nombre,
                expanded: true,
                className: claseNivel,
                data: { puesto: emp.puesto, departamentoNombre: emp.departamento_nombre },
                children: hijos.map(h => construirNodo(h, visitados, nivel + 1))
            };
        };

        const visitados = new Set<number>();
        const raices = jerarquia.filter(e => e.es_ceo || !e.jefe_inmediato_id || !porId.has(e.jefe_inmediato_id));
        const nodosRaiz = raices.map(r => construirNodo(r, visitados, 0));

        if (nodosRaiz.length === 1) return nodosRaiz;

        return [{
            label: 'Empresa',
            expanded: true,
            className: 'org-node-empresa',
            children: nodosRaiz
        }];
    }, [jerarquia]);

    const inicialesDe = useCallback((nombre: string) => {
        return nombre
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(p => p[0]?.toUpperCase())
            .join('');
    }, []);

    const nodeTemplate = useCallback((node: any) => {
        if (!node.data) {
            return (
                <div className="org-card org-card-empresa">
                    <div className="org-card-nombre">{node.label}</div>
                </div>
            );
        }
        return (
            <div className="org-card">
                <div className="org-card-avatar">{inicialesDe(node.label)}</div>
                <div className="org-card-nombre">{node.label}</div>
                {node.data.puesto && <div className="org-card-puesto">{node.data.puesto}</div>}
                {node.data.departamentoNombre && <div className="org-card-departamento">{node.data.departamentoNombre}</div>}
            </div>
        );
    }, [inicialesDe]);

    const exportCSV = useCallback(() => {
        dt.current?.exportCSV();
    }, []);

    const nombreBodyTemplate = useCallback((rowData: Departamento) => <span>{rowData.nombre}</span>, []);
    const descripcionBodyTemplate = useCallback((rowData: Departamento) => <span>{rowData.descripcion || '-'}</span>, []);

    const empleadosBodyTemplate = useCallback((rowData: Departamento) => (
        <Button
            label={String(rowData.total_empleados ?? 0)}
            icon="pi pi-users"
            text
            onClick={() => verEmpleadosDepartamento(rowData)}
        />
    ), [verEmpleadosDepartamento]);

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
            {ceoActual && <Tag severity="warning" value={`CEO actual: ${ceoActual.nombre}`} />}
        </div>
    ), [openNew, abrirOrganigrama, loading, ceoActual]);

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

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <style jsx global>{`
                        .p-organizationchart .p-organizationchart-node-content {
                            border: none;
                            background: transparent;
                            padding: 0.4rem;
                        }
                        .p-organizationchart .p-organizationchart-line-down {
                            background: var(--surface-300);
                            width: 2px;
                        }
                        .p-organizationchart .p-organizationchart-line-left,
                        .p-organizationchart .p-organizationchart-line-top {
                            border-color: var(--surface-300);
                            border-width: 2px;
                        }

                        .org-card {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            min-width: 170px;
                            max-width: 210px;
                            padding: 1rem 0.75rem 0.85rem;
                            background: var(--surface-card);
                            border-radius: 12px;
                            border-top: 4px solid var(--surface-400);
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                            transition: transform 0.15s ease, box-shadow 0.15s ease;
                        }
                        .org-card:hover {
                            transform: translateY(-2px);
                            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
                        }
                        .org-card-empresa {
                            border-top-color: var(--surface-500);
                            padding: 0.6rem 1rem;
                            min-width: auto;
                        }

                        .org-card-avatar {
                            width: 48px;
                            height: 48px;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-weight: 700;
                            font-size: 0.95rem;
                            color: #ffffff;
                            background: var(--surface-400);
                            margin-bottom: 0.4rem;
                        }
                        .org-card-nombre {
                            font-weight: 700;
                            font-size: 0.92rem;
                            line-height: 1.2;
                            text-align: center;
                            color: var(--text-color);
                            word-break: break-word;
                        }
                        .org-card-puesto {
                            font-size: 0.78rem;
                            line-height: 1.2;
                            text-align: center;
                            color: var(--text-color-secondary);
                            margin-top: 0.15rem;
                            word-break: break-word;
                        }
                        .org-card-departamento {
                            font-size: 0.68rem;
                            text-align: center;
                            color: var(--primary-color);
                            background: var(--primary-50, rgba(99, 102, 241, 0.12));
                            padding: 1px 8px;
                            border-radius: 10px;
                            margin-top: 0.35rem;
                        }

                        .org-node-ceo .org-card {
                            border-top-color: var(--primary-color);
                        }
                        .org-node-ceo .org-card-avatar {
                            background: var(--primary-color);
                        }
                        .org-node-gerente .org-card {
                            border-top-color: #3b82f6;
                        }
                        .org-node-gerente .org-card-avatar {
                            background: #3b82f6;
                        }
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
                        <Column field="descripcion" header="Descripción" body={descripcionBodyTemplate}></Column>
                        <Column field="total_empleados" header="Empleados" body={empleadosBodyTemplate}></Column>
                        <Column field="estatus" header="Estatus" body={estatusBodyTemplate}></Column>
                        <Column header="Acciones" body={actionBodyTemplate} headerStyle={{ minWidth: '10rem' }}></Column>
                    </DataTable>

                    <Dialog
                        visible={departamentoDialog}
                        style={{ width: '500px' }}
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
                        visible={empleadosDialog}
                        style={{ width: '500px' }}
                        header={`Empleados de ${empleadosDepartamentoActual.nombre}`}
                        modal
                        onHide={() => setEmpleadosDialog(false)}
                    >
                        <DataTable value={empleadosDepartamentoActual.empleados} emptyMessage="Este departamento no tiene empleados asignados">
                            <Column field="nombre" header="Nombre"></Column>
                            <Column field="puesto" header="Puesto"></Column>
                        </DataTable>
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
                                No hay datos suficientes para generar el organigrama. Define un CEO y asigna gerentes a los empleados desde el módulo de Empleados.
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
