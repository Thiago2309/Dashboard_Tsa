'use client';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import React, { useEffect, useRef, useState } from 'react';
import { CategoriaApu, createCategoriaApu, fetchCategoriasApuActivas } from '../../../../../Services/BD/apu/categoriasApuService';
import { ConceptoApu, createConceptoApu, deleteConceptoApu, fetchConceptosApu, updateConceptoApu } from '../../../../../Services/BD/apu/conceptosApuService';

const ConceptosApuCrud = () => {
    const emptyConcepto: ConceptoApu = {
        clave: '',
        descripcion: '',
        unidad: '',
        id_categoria: null,
        status: true
    };

    const [conceptos, setConceptos] = useState<ConceptoApu[]>([]);
    const [categorias, setCategorias] = useState<CategoriaApu[]>([]);
    const [conceptoDialog, setConceptoDialog] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [categoriaDialog, setCategoriaDialog] = useState(false);
    const [nuevaCategoria, setNuevaCategoria] = useState<CategoriaApu>({ nombre: '', grupo: 'Movimiento de Tierras', status: true });
    const [concepto, setConcepto] = useState<ConceptoApu>(emptyConcepto);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);
    const dt = useRef<DataTable<any>>(null);
    const [filters, setFilters] = useState<DataTableFilterMeta>({
        global: { value: null, matchMode: 'contains' as const }
    });

    const cargar = async () => {
        setLoading(true);
        try {
            const [conceptosData, categoriasData] = await Promise.all([fetchConceptosApu(), fetchCategoriasApuActivas()]);
            setConceptos(conceptosData);
            setCategorias(categoriasData);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al cargar el Catálogo de Conceptos', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
    }, []);

    const openNew = () => {
        setConcepto(emptyConcepto);
        setSubmitted(false);
        setConceptoDialog(true);
    };

    const hideDialog = () => {
        setSubmitted(false);
        setConceptoDialog(false);
    };

    const editConcepto = (row: ConceptoApu) => {
        setConcepto({ ...row });
        setConceptoDialog(true);
    };

    const confirmDelete = (row: ConceptoApu) => {
        setConcepto(row);
        setDeleteDialog(true);
    };

    const save = async () => {
        setSubmitted(true);

        if (concepto.clave.trim() && concepto.descripcion.trim() && concepto.unidad.trim()) {
            try {
                if (concepto.id) {
                    const actualizado = await updateConceptoApu(concepto);
                    setConceptos((prev) => prev.map((c) => (c.id === actualizado.id ? actualizado : c)));
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Concepto actualizado', life: 3000 });
                } else {
                    const creado = await createConceptoApu(concepto);
                    setConceptos((prev) => [...prev, creado]);
                    toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Concepto creado', life: 3000 });
                }
                setConceptoDialog(false);
                setConcepto(emptyConcepto);
            } catch (error) {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al guardar el Concepto', life: 3000 });
            }
        }
    };

    const deleteConfirmado = async () => {
        try {
            await deleteConceptoApu(concepto.id!);
            setConceptos((prev) => prev.filter((c) => c.id !== concepto.id));
            setDeleteDialog(false);
            setConcepto(emptyConcepto);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Concepto eliminado', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al eliminar el Concepto', life: 3000 });
        }
    };

    const guardarNuevaCategoria = async () => {
        if (!nuevaCategoria.nombre.trim()) return;
        try {
            const creada = await createCategoriaApu(nuevaCategoria);
            setCategorias((prev) => [...prev, creada]);
            setConcepto({ ...concepto, id_categoria: creada.id ?? null });
            setCategoriaDialog(false);
            setNuevaCategoria({ nombre: '', grupo: 'Movimiento de Tierras', status: true });
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Categoría creada', life: 3000 });
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al crear la Categoría', life: 3000 });
        }
    };

    const categoriaBodyTemplate = (row: ConceptoApu) => row.categoria_nombre || <span className="text-500">Sin categoría</span>;

    const tarjetaBodyTemplate = (row: ConceptoApu) => <Tag value={row.tiene_tarjeta ? 'Con Tarjeta' : 'Sin Tarjeta'} severity={row.tiene_tarjeta ? 'success' : 'warning'} />;

    const statusBodyTemplate = (row: ConceptoApu) => <Tag value={row.status ? 'Activo' : 'Inactivo'} severity={row.status ? 'success' : 'danger'} />;

    const actionBodyTemplate = (row: ConceptoApu) => (
        <>
            <Button icon="pi pi-pencil" rounded severity="info" className="mr-2" onClick={() => editConcepto(row)} />
            <Button icon="pi pi-trash" rounded severity="danger" onClick={() => confirmDelete(row)} />
        </>
    );

    const header = (
        <div className="flex flex-column md:flex-row md:justify-content-between md:align-items-center">
            <h5 className="m-0">Catálogo de Conceptos</h5>
            <span className="block mt-2 md:mt-0 p-input-icon-left">
                <i className="pi pi-search" />
                <InputText type="search" onInput={(e) => setFilters({ ...filters, global: { value: e.currentTarget.value, matchMode: 'contains' } })} placeholder="Buscar..." />
            </span>
        </div>
    );

    const conceptoDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={hideDialog} />
            <Button label="Guardar" icon="pi pi-check" text onClick={save} />
        </>
    );

    const deleteDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={() => setDeleteDialog(false)} />
            <Button label="Eliminar" icon="pi pi-check" text onClick={deleteConfirmado} />
        </>
    );

    const categoriaDialogFooter = (
        <>
            <Button label="Cancelar" icon="pi pi-times" text onClick={() => setCategoriaDialog(false)} />
            <Button label="Guardar" icon="pi pi-check" text onClick={guardarNuevaCategoria} />
        </>
    );

    return (
        <div className="grid crud-demo">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={() => <Button label="Nuevo Concepto" icon="pi pi-plus" severity="info" onClick={openNew} />} right={() => <Button label="Exportar" icon="pi pi-upload" severity="help" onClick={() => dt.current?.exportCSV()} />}></Toolbar>

                    <DataTable
                        ref={dt}
                        value={conceptos}
                        loading={loading}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[10, 25, 50]}
                        className="datatable-responsive"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
                        filters={filters}
                        filterDisplay="menu"
                        emptyMessage="No se encontraron conceptos."
                        header={header}
                        responsiveLayout="scroll"
                    >
                        <Column field="clave" header="Clave" sortable style={{ width: '120px' }}></Column>
                        <Column field="descripcion" header="Descripción" sortable></Column>
                        <Column field="unidad" header="Unidad" sortable style={{ width: '100px' }}></Column>
                        <Column field="categoria_nombre" header="Categoría" sortable body={categoriaBodyTemplate} style={{ width: '180px' }}></Column>
                        <Column header="Tarjeta APU" body={tarjetaBodyTemplate} style={{ width: '140px' }}></Column>
                        <Column field="status" header="Estado" sortable body={statusBodyTemplate} style={{ width: '110px' }}></Column>
                        <Column body={actionBodyTemplate} headerStyle={{ minWidth: '9rem' }}></Column>
                    </DataTable>

                    <Dialog visible={conceptoDialog} style={{ width: '480px' }} header="Detalles de Concepto" modal className="p-fluid" footer={conceptoDialogFooter} onHide={hideDialog}>
                        <div className="field">
                            <label htmlFor="clave">Clave</label>
                            <InputText id="clave" value={concepto.clave} onChange={(e) => setConcepto({ ...concepto, clave: e.target.value })} className={submitted && !concepto.clave ? 'p-invalid' : ''} />
                            {submitted && !concepto.clave && <small className="p-invalid">Clave es requerida.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="descripcion">Descripción</label>
                            <InputText id="descripcion" value={concepto.descripcion} onChange={(e) => setConcepto({ ...concepto, descripcion: e.target.value })} className={submitted && !concepto.descripcion ? 'p-invalid' : ''} />
                            {submitted && !concepto.descripcion && <small className="p-invalid">Descripción es requerida.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="unidad">Unidad (p.ej. m3, m2, ml, pza)</label>
                            <InputText id="unidad" value={concepto.unidad} onChange={(e) => setConcepto({ ...concepto, unidad: e.target.value })} className={submitted && !concepto.unidad ? 'p-invalid' : ''} />
                            {submitted && !concepto.unidad && <small className="p-invalid">Unidad es requerida.</small>}
                        </div>
                        <div className="field">
                            <label htmlFor="categoria">Categoría</label>
                            <div className="flex gap-2">
                                <Dropdown
                                    id="categoria"
                                    value={concepto.id_categoria}
                                    options={categorias}
                                    optionLabel="nombre"
                                    optionValue="id"
                                    placeholder="Selecciona una categoría"
                                    onChange={(e) => setConcepto({ ...concepto, id_categoria: e.value })}
                                    className="flex-grow-1"
                                    showClear
                                />
                                <Button icon="pi pi-plus" severity="secondary" type="button" onClick={() => setCategoriaDialog(true)} tooltip="Nueva categoría" />
                            </div>
                        </div>
                    </Dialog>

                    <Dialog visible={deleteDialog} style={{ width: '450px' }} header="Confirmar" modal footer={deleteDialogFooter} onHide={() => setDeleteDialog(false)}>
                        <div className="flex align-items-center justify-content-center">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem' }} />
                            {concepto && (
                                <span>
                                    ¿Estás seguro de eliminar <b>{concepto.descripcion}</b>?
                                </span>
                            )}
                        </div>
                    </Dialog>

                    <Dialog visible={categoriaDialog} style={{ width: '400px' }} header="Nueva Categoría" modal className="p-fluid" footer={categoriaDialogFooter} onHide={() => setCategoriaDialog(false)}>
                        <div className="field">
                            <label htmlFor="nombreCategoria">Nombre</label>
                            <InputText id="nombreCategoria" value={nuevaCategoria.nombre} onChange={(e) => setNuevaCategoria({ ...nuevaCategoria, nombre: e.target.value })} placeholder="p.ej. Terracerías" />
                        </div>
                        <div className="field">
                            <label htmlFor="grupoCategoria">Grupo / Especialidad</label>
                            <InputText id="grupoCategoria" value={nuevaCategoria.grupo} onChange={(e) => setNuevaCategoria({ ...nuevaCategoria, grupo: e.target.value })} placeholder="p.ej. Movimiento de Tierras" />
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default ConceptosApuCrud;
