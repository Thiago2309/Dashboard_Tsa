// app/(main)/pages/crud/Auditoria/page.tsx
'use client';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Column } from 'primereact/column';
import { DataTable, DataTablePageEvent } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import React, { useEffect, useRef, useState } from 'react';
import { fetchAuditoria, FiltrosAuditoria, RegistroAuditoria, TABLAS_AUDITADAS } from '../../../../../Services/BD/auditoriaService';
import { getUserRoleIdFromLocalStorage } from '../../../../../Services/BD/userService';

const ROLEID_ADMIN = 1;
const PAGE_SIZE = 25;

const OPERACION_LABELS: Record<string, { label: string; severity: 'success' | 'info' | 'danger' }> = {
    INSERT: { label: 'Insertado', severity: 'success' },
    UPDATE: { label: 'Actualizado', severity: 'info' },
    DELETE: { label: 'Eliminado', severity: 'danger' }
};

const tablaOptions = [{ label: 'Todas las tablas', value: '' }, ...TABLAS_AUDITADAS.map((t) => ({ label: t, value: t }))];
const operacionOptions = [
    { label: 'Todas las operaciones', value: '' },
    { label: 'Insertado', value: 'INSERT' },
    { label: 'Actualizado', value: 'UPDATE' },
    { label: 'Eliminado', value: 'DELETE' }
];

const AuditoriaPage = () => {
    const esAdmin = getUserRoleIdFromLocalStorage() === ROLEID_ADMIN;

    const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [detalle, setDetalle] = useState<RegistroAuditoria | null>(null);

    const [tabla, setTabla] = useState('');
    const [operacion, setOperacion] = useState('');
    const [usuario, setUsuario] = useState('');
    const [rango, setRango] = useState<(Date | null)[] | null>(null);

    const toast = useRef<Toast>(null);

    const cargar = async (pagina: number) => {
        if (!esAdmin) return;
        setLoading(true);
        try {
            const filtros: FiltrosAuditoria = { page: pagina, pageSize: PAGE_SIZE };
            if (tabla) filtros.tabla = tabla;
            if (operacion) filtros.operacion = operacion as FiltrosAuditoria['operacion'];
            if (usuario.trim()) filtros.usuario = usuario.trim();
            if (rango?.[0]) filtros.desde = rango[0].toISOString();
            if (rango?.[1]) filtros.hasta = rango[1].toISOString();

            const { registros: data, total: totalRegistros } = await fetchAuditoria(filtros);
            setRegistros(data);
            setTotal(totalRegistros);
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la auditoría', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar(0);
        setPage(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabla, operacion, usuario, rango]);

    const onPageChange = (e: DataTablePageEvent) => {
        const nuevaPagina = (e.page ?? 0);
        setPage(nuevaPagina);
        cargar(nuevaPagina);
    };

    const fechaBodyTemplate = (rowData: RegistroAuditoria) => {
        const fecha = new Date(rowData.fecha);
        return fecha.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
    };

    const operacionBodyTemplate = (rowData: RegistroAuditoria) => {
        const info = OPERACION_LABELS[rowData.operacion] || { label: rowData.operacion, severity: 'info' as const };
        return <Tag value={info.label} severity={info.severity} />;
    };

    const usuarioBodyTemplate = (rowData: RegistroAuditoria) => rowData.usuario_nombre || rowData.usuario_email || 'Desconocido';

    const actionBodyTemplate = (rowData: RegistroAuditoria) => (
        <Button icon="pi pi-eye" rounded text tooltip="Ver detalle" onClick={() => setDetalle(rowData)} />
    );

    const leftToolbarTemplate = () => (
        <div className="flex flex-wrap gap-2 align-items-end my-2">
            <div>
                <label className="block text-sm mb-1">Tabla</label>
                <Dropdown value={tabla} options={tablaOptions} onChange={(e) => setTabla(e.value)} className="w-14rem" filter />
            </div>
            <div>
                <label className="block text-sm mb-1">Operación</label>
                <Dropdown value={operacion} options={operacionOptions} onChange={(e) => setOperacion(e.value)} className="w-12rem" />
            </div>
            <div>
                <label className="block text-sm mb-1">Usuario</label>
                <InputText value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Nombre o email" className="w-12rem" />
            </div>
            <div>
                <label className="block text-sm mb-1">Rango de fechas</label>
                <Calendar value={rango as any} onChange={(e) => setRango(e.value as any)} selectionMode="range" readOnlyInput showIcon className="w-16rem" />
            </div>
            <Button icon="pi pi-refresh" label="Recargar" severity="secondary" onClick={() => cargar(page)} loading={loading} />
        </div>
    );

    const formatValor = (valor: any) => {
        if (valor === null || valor === undefined || valor === '') return <span className="text-500">—</span>;
        if (typeof valor === 'object') return JSON.stringify(valor);
        return String(valor);
    };

    // Registro completo (INSERT: lo que se creó / DELETE: lo que se borró, "tal cual").
    const renderRegistroCompleto = (data: Record<string, any> | null) => {
        if (!data) return <span className="text-500">— sin datos —</span>;
        return (
            <table className="w-full">
                <tbody>
                    {Object.entries(data).map(([campo, valor]) => (
                        <tr key={campo} className="border-bottom-1 surface-border">
                            <td className="font-medium py-1 pr-3" style={{ whiteSpace: 'nowrap' }}>{campo}</td>
                            <td className="py-1">{formatValor(valor)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    // UPDATE: solo los campos que realmente cambiaron, no el registro completo.
    const renderDiff = (antes: Record<string, any> | null, despues: Record<string, any> | null) => {
        const campos = Array.from(new Set([...Object.keys(antes || {}), ...Object.keys(despues || {})]));
        const cambios = campos.filter((campo) => JSON.stringify(antes?.[campo]) !== JSON.stringify(despues?.[campo]));

        if (cambios.length === 0) return <span className="text-500">No se detectaron cambios de valor.</span>;

        return (
            <table className="w-full">
                <thead>
                    <tr className="text-left">
                        <th className="pb-2">Campo</th>
                        <th className="pb-2">Antes</th>
                        <th className="pb-2">Después</th>
                    </tr>
                </thead>
                <tbody>
                    {cambios.map((campo) => (
                        <tr key={campo} className="border-bottom-1 surface-border">
                            <td className="font-medium py-1 pr-3" style={{ whiteSpace: 'nowrap' }}>{campo}</td>
                            <td className="py-1 pr-3 text-red-600">{formatValor(antes?.[campo])}</td>
                            <td className="py-1 text-green-600">{formatValor(despues?.[campo])}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    if (!esAdmin) {
        return (
            <div className="grid">
                <div className="col-12">
                    <div className="card flex flex-column align-items-center py-6">
                        <i className="pi pi-lock text-6xl text-500 mb-3" />
                        <span className="text-900 text-xl font-medium">Acceso restringido</span>
                        <span className="text-600">Solo un administrador puede ver la auditoría.</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    <Toast ref={toast} />
                    <Toolbar className="mb-4" left={leftToolbarTemplate} />

                    <DataTable
                        value={registros}
                        dataKey="id"
                        lazy
                        paginator
                        rows={PAGE_SIZE}
                        totalRecords={total}
                        first={page * PAGE_SIZE}
                        onPage={onPageChange}
                        className="datatable-responsive"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
                        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport"
                        emptyMessage="No se encontraron registros de auditoría."
                        responsiveLayout="scroll"
                        loading={loading}
                    >
                        <Column field="fecha" header="Fecha" body={fechaBodyTemplate} style={{ minWidth: '11rem' }} />
                        <Column field="tabla" header="Tabla" sortable />
                        <Column field="operacion" header="Operación" body={operacionBodyTemplate} />
                        <Column header="Usuario" body={usuarioBodyTemplate} />
                        <Column field="registro_id" header="ID del registro" />
                        <Column header="" body={actionBodyTemplate} style={{ width: '4rem' }} />
                    </DataTable>

                    <Dialog
                        visible={!!detalle}
                        style={{ width: '700px' }}
                        header={detalle ? `${OPERACION_LABELS[detalle.operacion]?.label || detalle.operacion} — ${detalle.tabla}` : ''}
                        modal
                        onHide={() => setDetalle(null)}
                    >
                        {detalle && (
                            <div>
                                <p className="text-600 mb-3">
                                    {usuarioBodyTemplate(detalle)} — {fechaBodyTemplate(detalle)}
                                </p>
                                {detalle.operacion === 'UPDATE' && renderDiff(detalle.datos_anteriores, detalle.datos_nuevos)}
                                {detalle.operacion === 'INSERT' && renderRegistroCompleto(detalle.datos_nuevos)}
                                {detalle.operacion === 'DELETE' && renderRegistroCompleto(detalle.datos_anteriores)}
                            </div>
                        )}
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default AuditoriaPage;
