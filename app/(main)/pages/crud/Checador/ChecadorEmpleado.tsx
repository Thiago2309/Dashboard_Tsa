// app/(main)/pages/crud/Checador/ChecadorEmpleado.tsx
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import {
    OperadorActual,
    RegistroChecador,
    distanciaMetros,
    fetchRegistrosDeHoy,
    fetchZonasActivas,
    obtenerOperadorActual,
    obtenerUbicacionActual,
    registrarChecada,
    subirFotoChecador
} from '../../../../../Services/BD/Checador/checadorService';

type Paso = 'idle' | 'camara' | 'confirmando' | 'enviando';

const ChecadorEmpleado = () => {
    const [operador, setOperador] = useState<OperadorActual | null>(null);
    const [registrosHoy, setRegistrosHoy] = useState<RegistroChecador[]>([]);
    const [cargando, setCargando] = useState(true);
    const [paso, setPaso] = useState<Paso>('idle');
    const [tipoActivo, setTipoActivo] = useState<'entrada' | 'salida' | null>(null);
    const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
    const [fotoPreview, setFotoPreview] = useState<string | null>(null);
    const [avisoZona, setAvisoZona] = useState<string | null>(null);
    const [horaActual, setHoraActual] = useState<Date>(new Date());
    const [camaraLista, setCamaraLista] = useState(false);

    const toast = useRef<Toast>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const ubicacionRef = useRef<{ latitud: number; longitud: number; precision_metros: number } | null>(null);

    const cargarDatos = useCallback(async () => {
        setCargando(true);
        try {
            const op = await obtenerOperadorActual();
            setOperador(op);
            if (op) {
                const registros = await fetchRegistrosDeHoy(op.id);
                setRegistrosHoy(registros);
            }
        } catch (error) {
            console.error('Error cargando datos del checador:', error);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    useEffect(() => {
        const intervalo = setInterval(() => setHoraActual(new Date()), 1000);
        return () => clearInterval(intervalo);
    }, []);

    const yaMarcoEntrada = registrosHoy.some((r) => r.tipo === 'entrada');
    const yaMarcoSalida = registrosHoy.some((r) => r.tipo === 'salida');
    const registroEntrada = registrosHoy.find((r) => r.tipo === 'entrada');
    const registroSalida = registrosHoy.find((r) => r.tipo === 'salida');

    const detenerCamara = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
    };

    const abrirCamara = async (tipo: 'entrada' | 'salida') => {
        try {
            ubicacionRef.current = await obtenerUbicacionActual();

            const zonas = await fetchZonasActivas();
            if (zonas.length > 0) {
                const dentro = zonas.some(
                    (z) => distanciaMetros(ubicacionRef.current!.latitud, ubicacionRef.current!.longitud, z.latitud, z.longitud) <= z.radio_metros
                );
                setAvisoZona(dentro ? null : 'Pareces estar fuera de una ubicación autorizada. Tu checada se marcará para revisión.');
            }
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Ubicación requerida', detail: error.message, life: 4000 });
            return;
        }

        setTipoActivo(tipo);
        setFotoBlob(null);
        setFotoPreview(null);
        setCamaraLista(false);
        setPaso('camara');
    };

    // Pide la cámara y la conecta al <video> hasta que el Dialog ya está montado en el DOM
    // (hacerlo en el mismo click del botón deja el video en blanco en varios navegadores móviles)
    useEffect(() => {
        if (paso !== 'camara') return;

        let cancelado = false;

        const iniciarStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });

                if (cancelado) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                streamRef.current = stream;
                const video = videoRef.current;
                if (!video) return;

                video.srcObject = stream;
                video.onloadedmetadata = () => {
                    video.play().catch((playError) => console.error('Error reproduciendo video de la cámara:', playError));
                    setCamaraLista(true);
                };
            } catch (error) {
                console.error('Error abriendo cámara:', error);
                if (cancelado) return;
                toast.current?.show({
                    severity: 'error',
                    summary: 'Cámara requerida',
                    detail: 'No se pudo acceder a la cámara. Revisa el permiso de cámara del navegador y vuelve a intentar.',
                    life: 5000
                });
                setPaso('idle');
            }
        };

        iniciarStream();

        return () => {
            cancelado = true;
            detenerCamara();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paso]);

    const capturarFoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        if (!video.videoWidth || !video.videoHeight) {
            toast.current?.show({
                severity: 'warn',
                summary: 'Cámara no lista',
                detail: 'Espera un momento a que se vea la imagen de la cámara antes de capturar.',
                life: 3000
            });
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
            (blob) => {
                if (blob) {
                    setFotoBlob(blob);
                    setFotoPreview(URL.createObjectURL(blob));
                    detenerCamara();
                    setPaso('confirmando');
                }
            },
            'image/jpeg',
            0.85
        );
    };

    const repetirFoto = async () => {
        setFotoBlob(null);
        setFotoPreview(null);
        if (tipoActivo) {
            await abrirCamara(tipoActivo);
        }
    };

    const cancelar = () => {
        detenerCamara();
        setPaso('idle');
        setTipoActivo(null);
        setFotoBlob(null);
        setFotoPreview(null);
        setAvisoZona(null);
        setCamaraLista(false);
    };

    const confirmarChecada = async () => {
        if (!operador || !tipoActivo || !fotoBlob || !ubicacionRef.current) return;

        setPaso('enviando');
        try {
            const fotoPath = await subirFotoChecador(operador.id, fotoBlob);

            await registrarChecada({
                operador_id: operador.id,
                tipo: tipoActivo,
                latitud: ubicacionRef.current.latitud,
                longitud: ubicacionRef.current.longitud,
                precision_metros: ubicacionRef.current.precision_metros,
                foto_url: fotoPath
            });

            toast.current?.show({
                severity: 'success',
                summary: 'Checada registrada',
                detail: tipoActivo === 'entrada' ? 'Entrada registrada correctamente' : 'Salida registrada correctamente',
                life: 3000
            });

            cancelar();
            await cargarDatos();
        } catch (error: any) {
            console.error('Error registrando checada:', error);
            const detalle = error?.code === '23505' ? 'Ya existe una checada de este tipo para hoy.' : 'No se pudo registrar la checada. Intenta de nuevo.';
            toast.current?.show({ severity: 'error', summary: 'Error', detail: detalle, life: 4000 });
            setPaso('confirmando');
        }
    };

    const formatearHora = (iso: string) =>
        new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Cancun' });

    const horaActualStr = horaActual.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Cancun'
    });
    const fechaActualStr = horaActual.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'America/Cancun'
    });

    if (cargando) {
        return (
            <div className="card">
                <div className="text-center py-6 text-500">Cargando...</div>
            </div>
        );
    }

    if (!operador) {
        return (
            <div className="card">
                <div className="text-center py-6 text-500">
                    No se encontró un empleado vinculado a tu usuario. Contacta al administrador.
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <Toast ref={toast} />

            <div className="flex flex-column align-items-center gap-4 py-4">
                <div className="text-center">
                    <h2 className="m-0">Reloj Checador</h2>
                    <p className="text-500 mt-1">
                        {operador.nombre} — {operador.puesto}
                    </p>
                </div>

                <div className="text-center surface-100 border-round py-3 px-5">
                    <div className="text-5xl font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {horaActualStr}
                    </div>
                    <div className="text-500 text-sm mt-1 capitalize">{fechaActualStr} · Hora de Cancún</div>
                </div>

                <div className="flex flex-column sm:flex-row gap-3 w-full sm:w-auto">
                    <div className={`border-round p-3 text-center flex-1 ${yaMarcoEntrada ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <div className="text-500 text-sm">Entrada</div>
                        <div className="font-bold text-lg">{registroEntrada ? formatearHora(registroEntrada.hora_real) : '--:--'}</div>
                        {registroEntrada && (
                            <div className={`text-xs mt-1 ${registroEntrada.estatus === 'a_tiempo' ? 'text-green-700' : 'text-orange-700'}`}>
                                {registroEntrada.estatus === 'a_tiempo' ? 'A tiempo' : 'Tarde'}
                                {!registroEntrada.dentro_de_zona && ' · Fuera de zona'}
                            </div>
                        )}
                    </div>
                    <div className={`border-round p-3 text-center flex-1 ${yaMarcoSalida ? 'bg-green-50' : 'bg-gray-50'}`}>
                        <div className="text-500 text-sm">Salida</div>
                        <div className="font-bold text-lg">{registroSalida ? formatearHora(registroSalida.hora_real) : '--:--'}</div>
                        {registroSalida && (
                            <div className={`text-xs mt-1 ${registroSalida.estatus === 'a_tiempo' ? 'text-green-700' : 'text-orange-700'}`}>
                                {registroSalida.estatus === 'a_tiempo' ? 'A tiempo' : 'Salida anticipada'}
                                {!registroSalida.dentro_de_zona && ' · Fuera de zona'}
                            </div>
                        )}
                    </div>
                </div>

                {!yaMarcoEntrada && (
                    <Button label="Marcar Entrada" icon="pi pi-sign-in" severity="success" size="large" onClick={() => abrirCamara('entrada')} />
                )}
                {yaMarcoEntrada && !yaMarcoSalida && (
                    <Button label="Marcar Salida" icon="pi pi-sign-out" severity="warning" size="large" onClick={() => abrirCamara('salida')} />
                )}
                {yaMarcoEntrada && yaMarcoSalida && <div className="text-center text-500">Ya registraste tu entrada y salida de hoy.</div>}
            </div>

            <Dialog
                header={tipoActivo === 'entrada' ? 'Checar Entrada' : 'Checar Salida'}
                visible={paso === 'camara' || paso === 'confirmando' || paso === 'enviando'}
                onHide={cancelar}
                closable={paso !== 'enviando'}
                style={{ width: '95vw', maxWidth: '420px' }}
            >
                <div className="text-center mb-3">
                    <div className="text-3xl font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {horaActualStr}
                    </div>
                    <div className="text-500 text-xs">Hora de Cancún — la hora que se guarda es la del servidor</div>
                </div>

                {avisoZona && (
                    <div className="bg-orange-50 border-1 border-orange-200 border-round p-2 mb-3 text-orange-700 text-sm">
                        <i className="pi pi-exclamation-triangle mr-2" />
                        {avisoZona}
                    </div>
                )}

                {paso === 'camara' && (
                    <div className="flex flex-column align-items-center gap-3">
                        <div className="w-full relative">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                {...{ 'webkit-playsinline': 'true' }}
                                className="w-full border-round"
                                style={{ transform: 'scaleX(-1)', backgroundColor: '#000', minHeight: '240px' }}
                            />
                            {!camaraLista && (
                                <div className="absolute top-0 left-0 w-full h-full flex align-items-center justify-content-center text-white">
                                    <i className="pi pi-spin pi-spinner mr-2" /> Iniciando cámara...
                                </div>
                            )}
                        </div>
                        <Button label="Capturar Foto" icon="pi pi-camera" onClick={capturarFoto} className="w-full" disabled={!camaraLista} />
                    </div>
                )}

                {(paso === 'confirmando' || paso === 'enviando') && fotoPreview && (
                    <div className="flex flex-column align-items-center gap-3">
                        <img src={fotoPreview} alt="Selfie del checador" className="w-full border-round" style={{ transform: 'scaleX(-1)' }} />
                        <div className="flex gap-2 w-full">
                            <Button label="Repetir" icon="pi pi-replay" severity="secondary" onClick={repetirFoto} disabled={paso === 'enviando'} className="flex-1" />
                            <Button label="Confirmar" icon="pi pi-check" onClick={confirmarChecada} loading={paso === 'enviando'} className="flex-1" />
                        </div>
                    </div>
                )}

                <canvas ref={canvasRef} style={{ display: 'none' }} />
            </Dialog>
        </div>
    );
};

export default ChecadorEmpleado;
