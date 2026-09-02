// app/(main)/pages/crud/Asistencia/AsistenciaSemanal.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Sidebar } from 'primereact/sidebar';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { fetchOperadores, Operador } from '../../../../../Services/BD/operadoresService';
import {
    RegistroChecador,
    fetchRegistrosPorOperadorYFecha,
    fetchRegistrosSemana,
    obtenerUrlFirmadaFoto
} from '../../../../../Services/BD/Checador/checadorService';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const inicioDeSemana = (fecha: Date): Date => {
    const d = new Date(fecha);
    const dia = d.getDay(); // 0 = domingo
    const offset = dia === 0 ? -6 : 1 - dia; // retrocede hasta el lunes
    d.setDate(d.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    return d;
};

const formatearFechaISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type EstadoDia = 'A' | 'FI' | 'T' | '-';

const AsistenciaSemanal = () => {
    const [operadores, setOperadores] = useState<Operador[]>([]);
    const [registros, setRegistros] = useState<RegistroChecador[]>([]);
    const [semanaInicio, setSemanaInicio] = useState<Date>(inicioDeSemana(new Date()));
    const [cargando, setCargando] = useState(true);
    const [filtroDepto, setFiltroDepto] = useState<string | null>(null);
    const [filtroPuesto, setFiltroPuesto] = useState<string | null>(null);
    const [busqueda, setBusqueda] = useState('');

    const [detalle, setDetalle] = useState<{ operador: Operador; fecha: string } | null>(null);
    const [registrosDetalle, setRegistrosDetalle] = useState<RegistroChecador[]>([]);
    const [fotosDetalle, setFotosDetalle] = useState<Record<number, string | null>>({});

    const diasSemana = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(semanaInicio);
            d.setDate(d.getDate() + i);
            return d;
        });
    }, [semanaInicio]);

    const cargarDatos = useCallback(async () => {
        setCargando(true);
        try {
            const [ops, regs] = await Promise.all([fetchOperadores(), fetchRegistrosSemana(formatearFechaISO(semanaInicio))]);
            setOperadores(ops.filter((o) => o.estatus));
            setRegistros(regs);
        } catch (error) {
            console.error('Error cargando listado de asistencia:', error);
        } finally {
            setCargando(false);
        }
    }, [semanaInicio]);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    const departamentos = useMemo(
        () => Array.from(new Set(operadores.map((o) => o.departamento_nombre).filter(Boolean))) as string[],
        [operadores]
    );
    const puestos = useMemo(() => Array.from(new Set(operadores.map((o) => o.puesto).filter(Boolean))), [operadores]);

    const operadoresFiltrados = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        return operadores.filter(
            (o) =>
                (!filtroDepto || o.departamento_nombre === filtroDepto) &&
                (!filtroPuesto || o.puesto === filtroPuesto) &&
                (!texto || o.nombre.toLowerCase().includes(texto))
        );
    }, [operadores, filtroDepto, filtroPuesto, busqueda]);

    const estadoDelDia = (operadorId: number, fecha: Date): EstadoDia => {
        const fechaStr = formatearFechaISO(fecha);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (fecha > hoy) return '-';
        // Domingo se considera no laborable por defecto
        if (fecha.getDay() === 0) return '-';

        const delDia = registros.filter((r) => r.operador_id === operadorId && r.fecha === fechaStr);
        if (delDia.length === 0) return 'FI';

        const tarde = delDia.some((r) => r.estatus === 'tarde');
        return tarde ? 'T' : 'A';
    };

    const claseEstado = (estado: EstadoDia) => {
        switch (estado) {
            case 'A':
                return 'bg-green-100 text-green-800';
            case 'T':
                return 'bg-orange-100 text-orange-800';
            case 'FI':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-50 text-400';
        }
    };

    const abrirDetalle = async (operador: Operador, fecha: Date) => {
        const estado = estadoDelDia(operador.id!, fecha);
        if (estado === '-') return;

        const fechaStr = formatearFechaISO(fecha);
        setDetalle({ operador, fecha: fechaStr });

        const regs = await fetchRegistrosPorOperadorYFecha(operador.id!, fechaStr);
        setRegistrosDetalle(regs);

        const urls: Record<number, string | null> = {};
        await Promise.all(
            regs.map(async (r) => {
                if (r.foto_url && r.id) {
                    urls[r.id] = await obtenerUrlFirmadaFoto(r.foto_url);
                }
            })
        );
        setFotosDetalle(urls);
    };

    const formatearHora = (iso: string) =>
        new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Cancun' });

    const cambiarSemana = (dias: number) => {
        const nueva = new Date(semanaInicio);
        nueva.setDate(nueva.getDate() + dias);
        setSemanaInicio(nueva);
    };

    return (
        <div className="card">
            <div className="flex flex-column md:flex-row justify-content-between md:align-items-center gap-3 mb-4">
                <h3 className="m-0">Listado de Asistencia</h3>
                <div className="flex align-items-center gap-2">
                    <Button icon="pi pi-chevron-left" rounded text onClick={() => cambiarSemana(-7)} />
                    <span className="font-medium">
                        {diasSemana[0].toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} -{' '}
                        {diasSemana[6].toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </span>
                    <Button icon="pi pi-chevron-right" rounded text onClick={() => cambiarSemana(7)} />
                    <Button label="Hoy" size="small" severity="secondary" text onClick={() => setSemanaInicio(inicioDeSemana(new Date()))} />
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                <span className="p-input-icon-left w-full sm:w-auto">
                    <i className="pi pi-search" />
                    <InputText
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar por nombre..."
                        className="w-full sm:w-auto"
                    />
                </span>
                <Dropdown
                    value={filtroDepto}
                    options={departamentos}
                    onChange={(e) => setFiltroDepto(e.value)}
                    placeholder="Departamento"
                    showClear
                    className="w-full sm:w-auto"
                />
                <Dropdown
                    value={filtroPuesto}
                    options={puestos}
                    onChange={(e) => setFiltroPuesto(e.value)}
                    placeholder="Puesto"
                    showClear
                    className="w-full sm:w-auto"
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: '900px' }}>
                    <thead>
                        <tr>
                            <th className="text-left p-2 border-bottom-1 surface-border" style={{ minWidth: '220px' }}>
                                Empleado
                            </th>
                            <th className="text-left p-2 border-bottom-1 surface-border">Puesto</th>
                            <th className="text-left p-2 border-bottom-1 surface-border">Departamento</th>
                            {diasSemana.map((d, i) => (
                                <th key={i} className="text-center p-2 border-bottom-1 surface-border" style={{ minWidth: '70px' }}>
                                    <div>{DIAS_SEMANA[i]}</div>
                                    <div className="text-500 text-sm font-normal">{d.getDate()}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {cargando ? (
                            <tr>
                                <td colSpan={10} className="text-center p-4 text-500">
                                    Cargando...
                                </td>
                            </tr>
                        ) : operadoresFiltrados.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="text-center p-4 text-500">
                                    No hay empleados que coincidan con el filtro
                                </td>
                            </tr>
                        ) : (
                            operadoresFiltrados.map((op) => (
                                <tr key={op.id}>
                                    <td className="p-2 border-bottom-1 surface-border font-medium">{op.nombre}</td>
                                    <td className="p-2 border-bottom-1 surface-border">{op.puesto}</td>
                                    <td className="p-2 border-bottom-1 surface-border">{op.departamento_nombre || '-'}</td>
                                    {diasSemana.map((d, i) => {
                                        const estado = estadoDelDia(op.id!, d);
                                        return (
                                            <td key={i} className="p-2 border-bottom-1 surface-border text-center">
                                                <span
                                                    className={`inline-flex align-items-center justify-content-center border-round font-bold text-sm ${claseEstado(estado)}`}
                                                    style={{ width: '32px', height: '32px', cursor: estado !== '-' ? 'pointer' : 'default' }}
                                                    onClick={() => abrirDetalle(op, d)}
                                                >
                                                    {estado}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex gap-4 mt-4 text-sm">
                <span>
                    <span className="inline-block bg-green-100 text-green-800 border-round px-2 py-1 mr-1">A</span> Asistió
                </span>
                <span>
                    <span className="inline-block bg-orange-100 text-orange-800 border-round px-2 py-1 mr-1">T</span> Tarde
                </span>
                <span>
                    <span className="inline-block bg-red-100 text-red-800 border-round px-2 py-1 mr-1">FI</span> Falta injustificada
                </span>
            </div>

            <Sidebar visible={!!detalle} onHide={() => setDetalle(null)} position="right" style={{ width: '380px' }}>
                {detalle && (
                    <div>
                        <h4 className="mt-0">{detalle.operador.nombre}</h4>
                        <p className="text-500 mt-0">
                            {new Date(detalle.fecha + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>

                        {registrosDetalle.length === 0 ? (
                            <p className="text-500">Sin registros para este día.</p>
                        ) : (
                            registrosDetalle.map((r) => (
                                <div key={r.id} className="border-1 surface-border border-round p-3 mb-3">
                                    <div className="flex justify-content-between align-items-center mb-2">
                                        <span className="font-bold">{r.tipo === 'entrada' ? 'Entrada' : 'Salida'}</span>
                                        <span className={`text-sm px-2 py-1 border-round ${r.estatus === 'a_tiempo' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                            {r.estatus === 'a_tiempo' ? 'A tiempo' : r.estatus === 'tarde' ? 'Tarde' : 'Salida anticipada'}
                                        </span>
                                    </div>
                                    <div className="text-sm text-500 mb-1">Hora real: {formatearHora(r.hora_real)}</div>
                                    <div className="text-sm text-500 mb-1">
                                        Ubicación: {r.latitud.toFixed(5)}, {r.longitud.toFixed(5)}{' '}
                                        {!r.dentro_de_zona && <span className="text-red-600 font-medium">(fuera de zona)</span>}
                                    </div>
                                    <a
                                        href={`https://www.google.com/maps?q=${r.latitud},${r.longitud}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm text-primary block mb-2"
                                    >
                                        Ver en mapa
                                    </a>
                                    {r.id && fotosDetalle[r.id] ? (
                                        <img src={fotosDetalle[r.id]!} alt="Selfie del checador" className="w-full border-round" />
                                    ) : (
                                        <div className="text-sm text-500">
                                            {r.foto_url ? 'Sin foto' : 'Foto no disponible (se elimina automáticamente después de 7 días)'}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </Sidebar>
        </div>
    );
};

export default AsistenciaSemanal;
