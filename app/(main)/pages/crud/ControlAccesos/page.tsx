// app/(main)/pages/crud/ControlAccesos/page.tsx
'use client';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { Dialog } from 'primereact/dialog';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Toolbar } from 'primereact/toolbar';
import React, { useEffect, useRef, useState } from 'react';
import {
    actualizarModulosDeUsuario,
    cambiarEstadoAcceso,
    cambiarPassword,
    fetchUsuariosConAccesos,
    ModuloDisponible,
    MODULOS_DISPONIBLES,
    UsuarioConAccesos
} from '../../../../../Services/BD/permisosService';
import { getUserRoleIdFromLocalStorage, register } from '../../../../../Services/BD/userService';

const ROLEID_ADMIN = 1;
const ROL_LABELS: Record<number, string> = { 1: 'Admin', 2: 'Empleado', 4: 'Almacén', 5: 'Logística' };

const emptyNuevoAcceso = { nombre: '', apellido: '', email: '', password: '' };

// Agrupa MODULOS_DISPONIBLES por su 'grupo' (ej. los submódulos de
// Mantenimiento) para que el checklist se vea organizado en vez de una lista
// plana de 12 opciones.
const gruposDeModulos = (): { grupo: string | null; modulos: ModuloDisponible[] }[] => {
    const sinGrupo = MODULOS_DISPONIBLES.filter((m) => !m.grupo);
    const nombresGrupo = Array.from(new Set(MODULOS_DISPONIBLES.filter((m) => m.grupo).map((m) => m.grupo as string)));
    return [
        { grupo: null, modulos: sinGrupo },
        ...nombresGrupo.map((grupo) => ({ grupo, modulos: MODULOS_DISPONIBLES.filter((m) => m.grupo === grupo) }))
    ];
};

const ControlAccesosPage = () => {
    const esAdmin = getUserRoleIdFromLocalStorage() === ROLEID_ADMIN;

    const [usuarios, setUsuarios] = useState<UsuarioConAccesos[]>([]);
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);

    const [modulosDialog, setModulosDialog] = useState<UsuarioConAccesos | null>(null);
    const [modulosSeleccionados, setModulosSeleccionados] = useState<string[]>([]);

    const [passwordDialog, setPasswordDialog] = useState<UsuarioConAccesos | null>(null);
    const [nuevaPassword, setNuevaPassword] = useState('');
    const [confirmarPassword, setConfirmarPassword] = useState('');

    const [desactivarDialog, setDesactivarDialog] = useState<UsuarioConAccesos | null>(null);

    const [nuevoAccesoDialog, setNuevoAccesoDialog] = useState(false);
    const [nuevoAcceso, setNuevoAcceso] = useState(emptyNuevoAcceso);
    const [nuevoAccesoModulos, setNuevoAccesoModulos] = useState<string[]>([]);

    const [guardando, setGuardando] = useState(false);

    const cargar = async () => {
        if (!esAdmin) return;
        setLoading(true);
        try {
            setUsuarios(await fetchUsuariosConAccesos());
        } catch {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los usuarios', life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const abrirModulos = (usuario: UsuarioConAccesos) => {
        setModulosDialog(usuario);
        setModulosSeleccionados(usuario.modulos);
    };

    const guardarModulos = async () => {
        if (!modulosDialog) return;
        setGuardando(true);
        try {
            await actualizarModulosDeUsuario(modulosDialog.id, modulosSeleccionados);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Módulos actualizados', life: 3000 });
            setModulosDialog(null);
            cargar();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message || 'No se pudo guardar', life: 3000 });
        } finally {
            setGuardando(false);
        }
    };

    const abrirPassword = (usuario: UsuarioConAccesos) => {
        setPasswordDialog(usuario);
        setNuevaPassword('');
        setConfirmarPassword('');
    };

    const guardarPassword = async () => {
        if (!passwordDialog) return;
        if (nuevaPassword.length < 6) {
            toast.current?.show({ severity: 'warn', summary: 'Atención', detail: 'La contraseña debe tener al menos 6 caracteres', life: 3000 });
            return;
        }
        if (nuevaPassword !== confirmarPassword) {
            toast.current?.show({ severity: 'warn', summary: 'Atención', detail: 'Las contraseñas no coinciden', life: 3000 });
            return;
        }
        setGuardando(true);
        try {
            await cambiarPassword(passwordDialog.id, nuevaPassword);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Contraseña actualizada', life: 3000 });
            setPasswordDialog(null);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message || 'No se pudo cambiar la contraseña', life: 3000 });
        } finally {
            setGuardando(false);
        }
    };

    // Reactivar es inmediato (es benigno); desactivar pide confirmación porque
    // bloquea el login de inmediato.
    const onToggleActivo = async (usuario: UsuarioConAccesos) => {
        if (usuario.activo) {
            setDesactivarDialog(usuario);
            return;
        }
        await aplicarCambioEstado(usuario, true);
    };

    const aplicarCambioEstado = async (usuario: UsuarioConAccesos, activo: boolean) => {
        setGuardando(true);
        try {
            await cambiarEstadoAcceso(usuario.id, activo);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: activo ? 'Acceso reactivado' : 'Acceso desactivado', life: 3000 });
            setDesactivarDialog(null);
            cargar();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message || 'No se pudo actualizar el estado', life: 3000 });
        } finally {
            setGuardando(false);
        }
    };

    const abrirNuevoAcceso = () => {
        setNuevoAcceso(emptyNuevoAcceso);
        setNuevoAccesoModulos([]);
        setNuevoAccesoDialog(true);
    };

    const guardarNuevoAcceso = async () => {
        if (!nuevoAcceso.nombre.trim() || !nuevoAcceso.email.trim() || nuevoAcceso.password.length < 6) {
            toast.current?.show({ severity: 'warn', summary: 'Atención', detail: 'Nombre, email y una contraseña de al menos 6 caracteres son obligatorios', life: 3000 });
            return;
        }
        setGuardando(true);
        try {
            const resultado = await register(
                nuevoAcceso.email,
                nuevoAcceso.password,
                { nombre: nuevoAcceso.nombre, apellido: nuevoAcceso.apellido, ciudad: '', sueldo: 0 }
            );

            if (!resultado?.userId) {
                throw new Error('No se pudo crear el acceso');
            }

            await actualizarModulosDeUsuario(resultado.userId, nuevoAccesoModulos);
            toast.current?.show({ severity: 'success', summary: 'Éxito', detail: 'Acceso creado correctamente', life: 3000 });
            setNuevoAccesoDialog(false);
            cargar();
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message || 'No se pudo crear el acceso', life: 3000 });
        } finally {
            setGuardando(false);
        }
    };

    const toggleModulo = (lista: string[], setLista: (m: string[]) => void, modulo: string) => {
        setLista(lista.includes(modulo) ? lista.filter((m) => m !== modulo) : [...lista, modulo]);
    };

    const renderChecklistModulos = (lista: string[], setLista: (m: string[]) => void, prefix: string) => (
        <div className="flex flex-column gap-3">
            {gruposDeModulos().map(({ grupo, modulos }) => (
                <div key={grupo || 'general'}>
                    {grupo && <div className="font-medium text-700 mb-2">{grupo}</div>}
                    <div className={`flex flex-column gap-2 ${grupo ? 'pl-3' : ''}`}>
                        {modulos.map((m) => (
                            <div key={m.key} className="flex align-items-center">
                                <Checkbox
                                    inputId={`${prefix}-${m.key}`}
                                    checked={lista.includes(m.key)}
                                    onChange={() => toggleModulo(lista, setLista, m.key)}
                                />
                                <label htmlFor={`${prefix}-${m.key}`} className="ml-2">{m.label}</label>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );

    const rolBodyTemplate = (rowData: UsuarioConAccesos) => (
        <Tag value={rowData.roleid ? ROL_LABELS[rowData.roleid] || `Rol ${rowData.roleid}` : 'Sin rol'} severity={rowData.roleid === ROLEID_ADMIN ? 'danger' : 'info'} />
    );

    const modulosBodyTemplate = (rowData: UsuarioConAccesos) => {
        if (rowData.roleid === ROLEID_ADMIN) return <span className="text-500">Todos (Admin)</span>;
        if (rowData.modulos.length === 0) return <span className="text-500">Solo Home</span>;
        return <span>{rowData.modulos.length} módulo(s)</span>;
    };

    const estadoBodyTemplate = (rowData: UsuarioConAccesos) => (
        <div className="flex align-items-center gap-2">
            <InputSwitch checked={rowData.activo} onChange={() => onToggleActivo(rowData)} disabled={rowData.roleid === ROLEID_ADMIN} />
            <Tag value={rowData.activo ? 'Activo' : 'Inactivo'} severity={rowData.activo ? 'success' : 'danger'} />
        </div>
    );

    const actionBodyTemplate = (rowData: UsuarioConAccesos) => (
        <div className="flex gap-1">
            <Button icon="pi pi-key" rounded text tooltip="Cambiar contraseña" onClick={() => abrirPassword(rowData)} />
            <Button icon="pi pi-sliders-h" rounded text tooltip="Módulos" onClick={() => abrirModulos(rowData)} disabled={rowData.roleid === ROLEID_ADMIN} />
        </div>
    );

    const leftToolbarTemplate = () => (
        <div className="my-2">
            <Button label="Nuevo acceso" icon="pi pi-plus" onClick={abrirNuevoAcceso} className="mr-2" />
            <Button label="Recargar" icon="pi pi-refresh" severity="secondary" onClick={cargar} loading={loading} />
        </div>
    );

    if (!esAdmin) {
        return (
            <div className="grid">
                <div className="col-12">
                    <div className="card flex flex-column align-items-center py-6">
                        <i className="pi pi-lock text-6xl text-500 mb-3" />
                        <span className="text-900 text-xl font-medium">Acceso restringido</span>
                        <span className="text-600">Solo un administrador puede gestionar accesos.</span>
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
                        value={usuarios}
                        dataKey="id"
                        paginator
                        rows={10}
                        rowsPerPageOptions={[10, 25, 50]}
                        className="datatable-responsive"
                        emptyMessage="No hay usuarios registrados."
                        responsiveLayout="scroll"
                        loading={loading}
                    >
                        <Column field="nombre" header="Nombre" sortable body={(r) => `${r.nombre} ${r.apellido || ''}`.trim()} />
                        <Column field="email" header="Email" sortable />
                        <Column header="Rol" body={rolBodyTemplate} />
                        <Column header="Módulos asignados" body={modulosBodyTemplate} />
                        <Column header="Estado" body={estadoBodyTemplate} />
                        <Column header="Acciones" body={actionBodyTemplate} style={{ width: '8rem' }} />
                    </DataTable>

                    {/* Dialog: módulos */}
                    <Dialog visible={!!modulosDialog} style={{ width: '520px' }} header={`Módulos — ${modulosDialog?.nombre || ''}`} modal onHide={() => setModulosDialog(null)}>
                        <p className="text-600 mb-3">Home siempre es visible para todos. Elige qué más puede ver esta cuenta.</p>
                        {renderChecklistModulos(modulosSeleccionados, setModulosSeleccionados, 'mod')}
                        <div className="flex justify-content-end gap-2 mt-4">
                            <Button label="Cancelar" text onClick={() => setModulosDialog(null)} />
                            <Button label="Guardar" icon="pi pi-check" onClick={guardarModulos} loading={guardando} />
                        </div>
                    </Dialog>

                    {/* Dialog: cambiar contraseña */}
                    <Dialog visible={!!passwordDialog} style={{ width: '420px' }} header={`Cambiar contraseña — ${passwordDialog?.nombre || ''}`} modal onHide={() => setPasswordDialog(null)}>
                        <div className="field">
                            <label>Nueva contraseña</label>
                            <Password value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} toggleMask feedback={false} className="w-full" inputClassName="w-full" />
                        </div>
                        <div className="field">
                            <label>Confirmar contraseña</label>
                            <Password value={confirmarPassword} onChange={(e) => setConfirmarPassword(e.target.value)} toggleMask feedback={false} className="w-full" inputClassName="w-full" />
                        </div>
                        <div className="flex justify-content-end gap-2 mt-3">
                            <Button label="Cancelar" text onClick={() => setPasswordDialog(null)} />
                            <Button label="Cambiar" icon="pi pi-check" onClick={guardarPassword} loading={guardando} />
                        </div>
                    </Dialog>

                    {/* Dialog: confirmar desactivar */}
                    <Dialog visible={!!desactivarDialog} style={{ width: '450px' }} header="Confirmar desactivación" modal onHide={() => setDesactivarDialog(null)}>
                        <div className="flex align-items-center mb-4">
                            <i className="pi pi-exclamation-triangle mr-3" style={{ fontSize: '2rem', color: 'var(--orange-500)' }} />
                            <span>
                                ¿Desactivar el acceso de <b>{desactivarDialog?.nombre} {desactivarDialog?.apellido}</b>? No podrá iniciar sesión hasta que lo reactives.
                                {' '}No se borra nada — puedes reactivarlo cuando quieras con el mismo interruptor.
                            </span>
                        </div>
                        <div className="flex justify-content-end gap-2">
                            <Button label="Cancelar" text onClick={() => setDesactivarDialog(null)} />
                            <Button label="Desactivar" icon="pi pi-ban" severity="danger" onClick={() => desactivarDialog && aplicarCambioEstado(desactivarDialog, false)} loading={guardando} />
                        </div>
                    </Dialog>

                    {/* Dialog: nuevo acceso */}
                    <Dialog visible={nuevoAccesoDialog} style={{ width: '560px' }} header="Nuevo acceso" modal className="p-fluid" onHide={() => setNuevoAccesoDialog(false)}>
                        <div className="field">
                            <label>Nombre *</label>
                            <InputText value={nuevoAcceso.nombre} onChange={(e) => setNuevoAcceso({ ...nuevoAcceso, nombre: e.target.value })} />
                        </div>
                        <div className="field">
                            <label>Apellido</label>
                            <InputText value={nuevoAcceso.apellido} onChange={(e) => setNuevoAcceso({ ...nuevoAcceso, apellido: e.target.value })} />
                        </div>
                        <div className="field">
                            <label>Email *</label>
                            <InputText type="email" value={nuevoAcceso.email} onChange={(e) => setNuevoAcceso({ ...nuevoAcceso, email: e.target.value })} />
                        </div>
                        <div className="field">
                            <label>Contraseña *</label>
                            <Password value={nuevoAcceso.password} onChange={(e) => setNuevoAcceso({ ...nuevoAcceso, password: e.target.value })} toggleMask feedback={false} />
                        </div>
                        <div className="field">
                            <label className="block mb-2">Módulos que puede ver (Home siempre incluido)</label>
                            {renderChecklistModulos(nuevoAccesoModulos, setNuevoAccesoModulos, 'nuevo-mod')}
                        </div>
                        <div className="flex justify-content-end gap-2 mt-3">
                            <Button label="Cancelar" text onClick={() => setNuevoAccesoDialog(false)} />
                            <Button label="Crear acceso" icon="pi pi-check" onClick={guardarNuevoAcceso} loading={guardando} />
                        </div>
                    </Dialog>
                </div>
            </div>
        </div>
    );
};

export default ControlAccesosPage;
