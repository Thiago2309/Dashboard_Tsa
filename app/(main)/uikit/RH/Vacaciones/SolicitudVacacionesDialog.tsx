'use client';
import { Button } from 'primereact/button';
import { Calendar } from 'primereact/calendar';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import React, { RefObject, useEffect, useState } from 'react';
import {
    autorizarSolicitudVacaciones,
    calcularFechaRegreso,
    contarDiasVacaciones,
    createSolicitudVacaciones,
    formatFechaLocal,
    OperadorVacaciones,
    parseFechaLocal,
    SolicitudVacaciones
} from '../../../../../Services/BD/Vacaciones/vacacionesService';
import { getUserIdFromLocalStorage, getUserNombreFromLocalStorage } from '../../../../../Services/BD/userService';
import FirmaCanvas from './FirmaCanvas';
import SaldoVacaciones from './SaldoVacaciones';

interface SolicitudVacacionesDialogProps {
    visible: boolean;
    onHide: () => void;
    onGuardada: () => void;
    operadores: OperadorVacaciones[];
    solicitudes: SolicitudVacaciones[];
    idOperadorInicial: number | null;
    toast: RefObject<Toast>;
}

interface FormSolicitud {
    id_operador: number | null;
    fecha_inicio: Date | null;
    fecha_fin: Date | null;
    dias_solicitados: number;
    motivo: string;
    firma_empleado: string | null;
    firma_jefe: string | null;
    autorizado_por: string;
}

const SolicitudVacacionesDialog = ({
    visible,
    onHide,
    onGuardada,
    operadores,
    solicitudes,
    idOperadorInicial,
    toast
}: SolicitudVacacionesDialogProps) => {
    const formVacio = (): FormSolicitud => ({
        id_operador: idOperadorInicial,
        fecha_inicio: null,
        fecha_fin: null,
        dias_solicitados: 0,
        motivo: '',
        firma_empleado: null,
        firma_jefe: null,
        autorizado_por: getUserNombreFromLocalStorage() || ''
    });

    const [form, setForm] = useState<FormSolicitud>(formVacio);
    const [submitted, setSubmitted] = useState(false);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (visible) {
            setForm(formVacio());
            setSubmitted(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const operador = operadores.find(op => op.id === form.id_operador) || null;
    const diasPendientes = solicitudes
        .filter(s => s.id_operador === form.id_operador && s.estatus === 'pendiente')
        .reduce((sum, s) => sum + s.dias_solicitados, 0);
    const disponiblesReales = operador ? operador.dias_disponibles - diasPendientes : 0;

    const cambiarFechas = (fecha_inicio: Date | null, fecha_fin: Date | null) => {
        const dias_solicitados = fecha_inicio && fecha_fin && fecha_fin >= fecha_inicio ? contarDiasVacaciones(fecha_inicio, fecha_fin) : 0;
        setForm({ ...form, fecha_inicio, fecha_fin, dias_solicitados });
    };

    const validar = (): string | null => {
        if (!form.id_operador || !form.fecha_inicio || !form.fecha_fin || !form.dias_solicitados || !form.firma_empleado) {
            return 'Completa los campos obligatorios y la firma del empleado';
        }
        if (form.fecha_fin < form.fecha_inicio) return 'La fecha fin no puede ser antes de la fecha inicio';
        if (!operador || operador.anios_cumplidos < 1) return 'El empleado aún no cumple 1 año, no tiene vacaciones por ley';
        if (form.dias_solicitados > disponiblesReales) {
            return `Solo tiene ${disponiblesReales} días disponibles${diasPendientes ? ` (${diasPendientes} en solicitudes pendientes)` : ''}`;
        }
        if (form.firma_jefe && !form.autorizado_por.trim()) return 'Escribe el nombre de quien autoriza';
        return null;
    };

    const guardar = async () => {
        setSubmitted(true);
        const error = validar();
        if (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error, life: 4000 });
            return;
        }

        setGuardando(true);
        try {
            const creada = await createSolicitudVacaciones({
                id_operador: form.id_operador,
                fecha_solicitud: formatFechaLocal(new Date()),
                fecha_inicio: formatFechaLocal(form.fecha_inicio!),
                fecha_fin: formatFechaLocal(form.fecha_fin!),
                fecha_regreso: formatFechaLocal(calcularFechaRegreso(form.fecha_fin!)),
                dias_solicitados: form.dias_solicitados,
                motivo: form.motivo.trim() || null,
                estatus: 'pendiente',
                firma_empleado: form.firma_empleado,
                firma_jefe: null,
                autorizado_por: null,
                autorizado_por_userid: null,
                fecha_autorizacion: null,
                motivo_rechazo: null,
                dias_ley: null,
                dias_tomados_antes: null,
                dias_restantes: null,
                id_periodo: null,
                creado_por: getUserIdFromLocalStorage()
            });

            if (form.firma_jefe) {
                await autorizarSolicitudVacaciones(creada, operador!, {
                    firma_jefe: form.firma_jefe,
                    autorizado_por: form.autorizado_por.trim(),
                    autorizado_por_userid: getUserIdFromLocalStorage()
                });
            }

            toast.current?.show({
                severity: 'success',
                summary: 'Éxito',
                detail: form.firma_jefe ? 'Solicitud creada y autorizada' : 'Solicitud creada, pendiente de firma del jefe',
                life: 3000
            });
            onGuardada();
        } catch (error: any) {
            console.error('Error guardando solicitud:', error);
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error?.message || 'Error al guardar la solicitud', life: 4000 });
        } finally {
            setGuardando(false);
        }
    };

    const regreso = form.fecha_fin ? calcularFechaRegreso(form.fecha_fin) : null;

    return (
        <Dialog
            visible={visible}
            style={{ width: '720px' }}
            breakpoints={{ '960px': '90vw', '641px': '100vw' }}
            header="Nueva Solicitud de Vacaciones"
            modal
            className="p-fluid"
            onHide={onHide}
            footer={
                <>
                    <Button label="Cancelar" icon="pi pi-times" text onClick={onHide} />
                    <Button
                        label={form.firma_jefe ? 'Guardar y Autorizar' : 'Guardar Solicitud'}
                        icon="pi pi-check"
                        text
                        onClick={guardar}
                        loading={guardando}
                    />
                </>
            }
        >
            <div className="field">
                <label htmlFor="sol_operador">Empleado *</label>
                <Dropdown
                    id="sol_operador"
                    value={form.id_operador}
                    options={operadores.map(op => ({ label: op.nombre, value: op.id }))}
                    onChange={e => setForm({ ...form, id_operador: e.value })}
                    placeholder="Selecciona un empleado"
                    filter
                    showClear
                    className={submitted && !form.id_operador ? 'p-invalid' : ''}
                />
            </div>

            {operador && <SaldoVacaciones operador={operador} diasPendientes={diasPendientes} diasSolicitados={form.dias_solicitados} />}

            <div className="grid">
                <div className="col-12 md:col-4">
                    <div className="field">
                        <label htmlFor="sol_inicio">Del *</label>
                        <Calendar
                            id="sol_inicio"
                            value={form.fecha_inicio}
                            onChange={e => cambiarFechas((e.value as Date) || null, form.fecha_fin)}
                            dateFormat="dd/mm/yy"
                            showIcon
                            className={submitted && !form.fecha_inicio ? 'p-invalid' : ''}
                        />
                    </div>
                </div>
                <div className="col-12 md:col-4">
                    <div className="field">
                        <label htmlFor="sol_fin">Al *</label>
                        <Calendar
                            id="sol_fin"
                            value={form.fecha_fin}
                            onChange={e => cambiarFechas(form.fecha_inicio, (e.value as Date) || null)}
                            minDate={form.fecha_inicio || undefined}
                            dateFormat="dd/mm/yy"
                            showIcon
                            className={submitted && !form.fecha_fin ? 'p-invalid' : ''}
                        />
                    </div>
                </div>
                <div className="col-12 md:col-4">
                    <div className="field">
                        <label htmlFor="sol_dias">Días a disfrutar *</label>
                        <InputNumber
                            id="sol_dias"
                            value={form.dias_solicitados}
                            onValueChange={e => setForm({ ...form, dias_solicitados: e.value || 0 })}
                            min={0}
                            max={365}
                            className={submitted && !form.dias_solicitados ? 'p-invalid' : ''}
                        />
                        <small className="text-500">
                            Sin contar domingos{regreso ? ` · Regresa el ${regreso.toLocaleDateString('es-MX')}` : ''}
                        </small>
                    </div>
                </div>
            </div>

            <div className="field">
                <label htmlFor="sol_motivo">Observaciones</label>
                <InputTextarea id="sol_motivo" value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} rows={2} autoResize />
            </div>

            <div className="grid">
                <div className="col-12 md:col-6">
                    <FirmaCanvas
                        label="Firma del empleado *"
                        value={form.firma_empleado}
                        onChange={firma => setForm(f => ({ ...f, firma_empleado: firma }))}
                        invalid={submitted && !form.firma_empleado}
                    />
                    <div className="text-center text-sm font-semibold">{operador?.nombre || 'Empleado'}</div>
                </div>
                <div className="col-12 md:col-6">
                    <FirmaCanvas
                        label="Firma del jefe (autoriza)"
                        value={form.firma_jefe}
                        onChange={firma => setForm(f => ({ ...f, firma_jefe: firma }))}
                    />
                    <InputText
                        value={form.autorizado_por}
                        onChange={e => setForm({ ...form, autorizado_por: e.target.value })}
                        placeholder="Nombre de quien autoriza"
                        className={submitted && form.firma_jefe && !form.autorizado_por.trim() ? 'p-invalid' : ''}
                    />
                    <small className="text-500">Si el jefe no firma ahora, la solicitud queda pendiente y puede autorizarse después.</small>
                </div>
            </div>
        </Dialog>
    );
};

export default SolicitudVacacionesDialog;
