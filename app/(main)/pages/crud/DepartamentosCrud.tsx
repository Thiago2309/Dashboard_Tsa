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
    children?: OrgNode[];
    data?: { puesto?: string; departamentoNombre?: string };
}

const PALETA_AREAS = ['#f2a49c', '#8ecae6', '#f5e26b', '#74c9ae', '#c9a4e0', '#f4b183'];

const primerNombre = (nombreCompleto: string) => nombreCompleto.trim().split(/\s+/)[0];

const ListaDescendientes: React.FC<{ nodos: OrgNode[]; nivel?: number }> = ({ nodos, nivel = 0 }) => {
    if (!nodos || nodos.length === 0) return null;
    return (
        <div className="ov-lista" style={nivel > 0 ? { marginLeft: `${nivel * 12}px` } : undefined}>
            {nodos.map((n, i) => (
                <div className="ov-lista-item" key={i}>
                    <div className="ov-lista-conector" />
                    <span className="ov-lista-texto">{primerNombre(n.label)}</span>
                    <ListaDescendientes nodos={n.children || []} nivel={nivel + 1} />
                </div>
            ))}
        </div>
    );
};

// Reproduce el formato de "organigrama vertical" clásico: una cadena de cajas
// centradas mientras cada nivel tiene un único subordinado, y en el primer punto
// donde un jefe tiene varios subordinados directos, esos se muestran como una
// fila de cajas de color (las "áreas"), cada una con su gente a cargo en una
// lista simple debajo.
const OrganigramaVertical: React.FC<{ nodo: OrgNode }> = ({ nodo }) => {
    const cadena: OrgNode[] = [nodo];
    let actual = nodo;
    while (actual.children && actual.children.length === 1) {
        actual = actual.children[0];
        cadena.push(actual);
    }
    const ramas = actual.children && actual.children.length > 1 ? actual.children : [];

    return (
        <div className="organigrama-vertical">
            {cadena.map((n, i) => (
                <React.Fragment key={i}>
                    <div className={`ov-caja-nivel ${i === 0 ? 'ov-caja-ceo' : 'ov-caja-cadena'}`}>
                        <div className="ov-caja-nombre">{n.data ? primerNombre(n.label) : n.label}</div>
                        {n.data?.puesto && <div className="ov-caja-puesto">{n.data.puesto}</div>}
                    </div>
                    {(i < cadena.length - 1 || ramas.length > 0) && <div className="ov-flecha">▼</div>}
                </React.Fragment>
            ))}
            {ramas.length > 0 && (
                <div className="ov-ramas">
                    {ramas.map((rama, idx) => (
                        <div className="ov-columna" key={idx}>
                            <div className="ov-caja-area" style={{ background: PALETA_AREAS[idx % PALETA_AREAS.length] }}>
                                <div className="ov-caja-nombre">{primerNombre(rama.label)}</div>
                                {rama.data?.puesto && <div className="ov-caja-puesto">{rama.data.puesto}</div>}
                            </div>
                            <ListaDescendientes nodos={rama.children || []} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

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
            className: 'org-node-empresa',
            children: nodosRaiz
        }];
    }, [jerarquia]);

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
                        .organigrama-vertical {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                        }

                        .ov-caja-nivel {
                            min-width: 200px;
                            text-align: center;
                            padding: 0.55rem 1.25rem;
                            border-radius: 6px;
                            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
                        }
                        .ov-caja-ceo {
                            background: var(--primary-color);
                            color: var(--primary-color-text);
                        }
                        .ov-caja-cadena {
                            background: #2f3542;
                            color: #ffffff;
                        }
                        .ov-caja-nombre {
                            font-weight: 700;
                            font-size: 0.9rem;
                            text-transform: uppercase;
                            letter-spacing: 0.02em;
                        }
                        .ov-caja-puesto {
                            font-weight: 400;
                            font-size: 0.7rem;
                            opacity: 0.85;
                            margin-top: 2px;
                        }
                        .ov-flecha {
                            color: var(--surface-400);
                            font-size: 0.9rem;
                            line-height: 1.4;
                        }

                        .ov-ramas {
                            display: flex;
                            justify-content: center;
                            position: relative;
                            padding-top: 20px;
                        }
                        .ov-ramas::before {
                            content: '';
                            position: absolute;
                            top: 0;
                            left: 50%;
                            width: 0;
                            height: 20px;
                            border-left: 2px solid var(--surface-400);
                        }
                        .ov-columna {
                            position: relative;
                            padding: 20px 14px 0 14px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                        }
                        .ov-columna::before,
                        .ov-columna::after {
                            content: '';
                            position: absolute;
                            top: 0;
                            right: 50%;
                            width: 50%;
                            height: 20px;
                            border-top: 2px solid var(--surface-400);
                        }
                        .ov-columna::after {
                            right: auto;
                            left: 50%;
                            border-left: 2px solid var(--surface-400);
                        }
                        .ov-columna:only-child::before,
                        .ov-columna:only-child::after {
                            display: none;
                        }
                        .ov-columna:first-child::before {
                            border-color: transparent;
                        }
                        .ov-columna:last-child::after {
                            border-color: transparent;
                        }

                        .ov-caja-area {
                            min-width: 130px;
                            text-align: center;
                            padding: 0.5rem 0.9rem;
                            border-radius: 6px;
                            color: #2b2b2b;
                            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
                        }

                        .ov-lista {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            margin-top: 2px;
                        }
                        .ov-lista-item {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                        }
                        .ov-lista-conector {
                            width: 2px;
                            height: 10px;
                            background: var(--surface-300);
                        }
                        .ov-lista-texto {
                            font-size: 0.72rem;
                            color: var(--text-color-secondary);
                            padding: 2px 0;
                            white-space: nowrap;
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
                                            padding: '1rem',
                                            background: '#ffffff'
                                        }}
                                    >
                                        {arbolOrganigrama.map((raiz, idx) => (
                                            <OrganigramaVertical key={idx} nodo={raiz} />
                                        ))}
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
