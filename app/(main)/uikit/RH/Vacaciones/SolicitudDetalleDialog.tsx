'use client';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import React, { RefObject, useEffect, useRef, useState } from 'react';
import {
    autorizarSolicitudVacaciones,
    OperadorVacaciones,
    parseFechaLocal,
    rechazarSolicitudVacaciones,
    SolicitudVacaciones
} from '../../../../../Services/BD/Vacaciones/vacacionesService';
import { getUserIdFromLocalStorage, getUserNombreFromLocalStorage } from '../../../../../Services/BD/userService';
import FirmaCanvas from './FirmaCanvas';
import SaldoVacaciones from './SaldoVacaciones';

interface SolicitudDetalleDialogProps {
    solicitud: SolicitudVacaciones | null;
    operador: OperadorVacaciones | null;
    diasPendientesOtras: number;
    onHide: () => void;
    onActualizada: () => void;
    toast: RefObject<Toast>;
}

const fmt = (fecha: string | null | undefined) => parseFechaLocal(fecha)?.toLocaleDateString('es-MX') ?? '-';

const ESTATUS_LABEL = { pendiente: 'PENDIENTE DE AUTORIZAR', autorizada: 'AUTORIZADA', rechazada: 'RECHAZADA' };

const celda: React.CSSProperties = { border: '1px solid #999', padding: '6px 8px', fontSize: 13 };
const celdaTitulo: React.CSSProperties = { ...celda, background: '#f1f1f1', fontWeight: 600, width: '35%' };

const SolicitudDetalleDialog = ({ solicitud, operador, diasPendientesOtras, onHide, onActualizada, toast }: SolicitudDetalleDialogProps) => {
    const formatoRef = useRef<HTMLDivElement>(null);
    const [firmaJefe, setFirmaJefe] = useState<string | null>(null);
    const [autorizadoPor, setAutorizadoPor] = useState('');
    const [motivoRechazo, setMotivoRechazo] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (solicitud) {
            setFirmaJefe(null);
            setAutorizadoPor(getUserNombreFromLocalStorage() || '');
            setMotivoRechazo('');
            setSubmitted(false);
        }
    }, [solicitud]);

    if (!solicitud) return null;

    const pendiente = solicitud.estatus === 'pendiente';

    // Autorizada: se usa la foto del saldo guardada al autorizar. Pendiente: saldo actual.
    const diasLey = pendiente ? operador?.dias_ley ?? 0 : solicitud.dias_ley ?? 0;
    const tomadosAntes = pendiente ? operador?.dias_disfrutados_periodo ?? 0 : solicitud.dias_tomados_antes ?? 0;
    const restantes = pendiente
        ? (operador?.dias_disponibles ?? 0) - diasPendientesOtras - solicitud.dias_solicitados
        : solicitud.dias_restantes ?? 0;

    const autorizar = async () => {
        setSubmitted(true);
        if (!firmaJefe || !autorizadoPor.trim()) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Se requiere la firma y el nombre de quien autoriza', life: 3000 });
            return;
        }
        if (!operador) return;
        setGuardando(true);
        try {
            await autorizarSolicitudVacaciones(solicitud, operador, {
                firma_jefe: firmaJefe,
                autorizado_por: autorizadoPor.trim(),
                autorizado_por_userid: getUserIdFromLocalStorage()
            });
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Vacaciones autorizadas', life: 3000 });
            onActualizada();
        } catch (error: any) {
            console.error('Error autorizando solicitud:', error);
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error?.message || 'Error al autorizar', life: 4000 });
        } finally {
            setGuardando(false);
        }
    };

    const rechazar = async () => {
        if (!motivoRechazo.trim() || !autorizadoPor.trim()) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Escribe el motivo del rechazo y tu nombre', life: 3000 });
            return;
        }
        setGuardando(true);
        try {
            await rechazarSolicitudVacaciones(solicitud.id!, motivoRechazo.trim(), autorizadoPor.trim(), getUserIdFromLocalStorage());
            toast.current?.show({ severity: 'info', summary: 'Rechazada', detail: 'La solicitud fue rechazada', life: 3000 });
            onActualizada();
        } catch (error) {
            console.error('Error rechazando solicitud:', error);
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Error al rechazar', life: 3000 });
        } finally {
            setGuardando(false);
        }
    };

    const imprimir = () => {
        if (!formatoRef.current) return;
        const ventana = window.open('', '_blank', 'width=800,height=900');
        if (!ventana) return;
        ventana.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
            <title>Solicitud_Vacaciones_${solicitud.id}</title>
            <style>
                body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px; background: #fff; color: #000; }
                @page { size: portrait; margin: 12mm; }
            </style></head>
            <body>${formatoRef.current.innerHTML}</body></html>`);
        ventana.document.close();
        ventana.focus();
        setTimeout(() => ventana.print(), 500);
    };

    const bloqueFirma = (firma: string | null, nombre: string, puesto: string) => (
        <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: 110, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                {firma && <img src={firma} alt={puesto} style={{ maxHeight: 105, maxWidth: '100%' }} />}
            </div>
            <div style={{ borderTop: '1px solid #000', margin: '0 16px', paddingTop: 4, fontSize: 13, fontWeight: 600 }}>{nombre || ' '}</div>
            <div style={{ fontSize: 12, color: '#555' }}>{puesto}</div>
        </div>
    );

    return (
        <Dialog
            visible={!!solicitud}
            style={{ width: '760px' }}
            breakpoints={{ '960px': '90vw', '641px': '100vw' }}
            header={`Solicitud de Vacaciones #${solicitud.id}`}
            modal
            onHide={onHide}
            footer={
                <div className="flex flex-wrap justify-content-end gap-2">
                    <Button label="Cerrar" icon="pi pi-times" text onClick={onHide} />
                    <Button label="Imprimir" icon="pi pi-print" severity="secondary" outlined onClick={imprimir} />
                    {pendiente && <Button label="Rechazar" icon="pi pi-ban" severity="danger" outlined onClick={rechazar} loading={guardando} />}
                    {pendiente && <Button label="Autorizar" icon="pi pi-check" severity="success" onClick={autorizar} loading={guardando} />}
                </div>
            }
        >
            {/* Formato imprimible: solo estilos inline para que se vea igual al imprimir */}
            <div ref={formatoRef}>
                <div style={{ background: '#fff', color: '#000', padding: 16, border: '1px solid #ccc', borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>SOLICITUD DE VACACIONES</div>
                        <div style={{ textAlign: 'right', fontSize: 12 }}>
                            <div>Folio: <b>{solicitud.id}</b></div>
                            <div>Fecha de solicitud: <b>{fmt(solicitud.fecha_solicitud)}</b></div>
                            <div style={{ fontWeight: 700, marginTop: 2 }}>{ESTATUS_LABEL[solicitud.estatus]}</div>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                        <tbody>
                            <tr><td style={celdaTitulo}>Nombre completo del empleado</td><td style={celda}>{solicitud.operador_nombre}</td></tr>
                            <tr><td style={celdaTitulo}>Fecha de ingreso</td><td style={celda}>{fmt(solicitud.fecha_contratacion)}</td></tr>
                            <tr><td style={celdaTitulo}>Periodo de vacaciones</td><td style={celda}>Del {fmt(solicitud.fecha_inicio)} al {fmt(solicitud.fecha_fin)}</td></tr>
                            <tr><td style={celdaTitulo}>Fecha de regreso a labores</td><td style={celda}>{fmt(solicitud.fecha_regreso)}</td></tr>
                            {solicitud.motivo && <tr><td style={celdaTitulo}>Observaciones</td><td style={celda}>{solicitud.motivo}</td></tr>}
                        </tbody>
                    </table>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, textAlign: 'center' }}>
                        <thead>
                            <tr>
                                <th style={{ ...celda, background: '#f1f1f1' }}>Días que le corresponden</th>
                                <th style={{ ...celda, background: '#f1f1f1' }}>Días tomados antes</th>
                                <th style={{ ...celda, background: '#f1f1f1' }}>Días que toma</th>
                                <th style={{ ...celda, background: '#f1f1f1' }}>Días que le quedan</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ ...celda, fontSize: 16, fontWeight: 700 }}>{diasLey}</td>
                                <td style={{ ...celda, fontSize: 16, fontWeight: 700 }}>{tomadosAntes}</td>
                                <td style={{ ...celda, fontSize: 16, fontWeight: 700 }}>{solicitud.dias_solicitados}</td>
                                <td style={{ ...celda, fontSize: 16, fontWeight: 700 }}>{restantes}</td>
                            </tr>
                        </tbody>
                    </table>

                    {solicitud.estatus === 'rechazada' && (
                        <div style={{ fontSize: 13, marginBottom: 12 }}>
                            <b>Motivo del rechazo:</b> {solicitud.motivo_rechazo}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
                        {bloqueFirma(solicitud.firma_empleado, solicitud.operador_nombre || '', 'Firma del empleado')}
                        {bloqueFirma(
                            solicitud.firma_jefe,
                            solicitud.autorizado_por || '',
                            solicitud.estatus === 'rechazada' ? 'Rechazó' : 'Autoriza (jefe inmediato)'
                        )}
                    </div>

                    {solicitud.fecha_autorizacion && (
                        <div style={{ fontSize: 11, color: '#555', marginTop: 12, textAlign: 'right' }}>
                            {solicitud.estatus === 'autorizada' ? 'Autorizada' : 'Revisada'} el{' '}
                            {new Date(solicitud.fecha_autorizacion).toLocaleString('es-MX')} por {solicitud.autorizado_por}
                        </div>
                    )}
                </div>
            </div>

            {pendiente && (
                <div className="mt-4 p-fluid">
                    <h6 className="mt-0">Autorización del jefe</h6>
                    {operador && <SaldoVacaciones operador={operador} diasPendientes={diasPendientesOtras} diasSolicitados={solicitud.dias_solicitados} />}
                    <div className="grid">
                        <div className="col-12 md:col-6">
                            <FirmaCanvas label="Firma del jefe *" value={firmaJefe} onChange={setFirmaJefe} invalid={submitted && !firmaJefe} />
                        </div>
                        <div className="col-12 md:col-6">
                            <div className="field">
                                <label htmlFor="det_autoriza">Nombre de quien autoriza *</label>
                                <InputText
                                    id="det_autoriza"
                                    value={autorizadoPor}
                                    onChange={e => setAutorizadoPor(e.target.value)}
                                    className={submitted && !autorizadoPor.trim() ? 'p-invalid' : ''}
                                />
                            </div>
                            <div className="field">
                                <label htmlFor="det_rechazo">Motivo de rechazo (solo si se rechaza)</label>
                                <InputTextarea id="det_rechazo" value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)} rows={3} autoResize />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Dialog>
    );
};

export default SolicitudDetalleDialog;
