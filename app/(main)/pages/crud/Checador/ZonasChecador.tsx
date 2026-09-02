// app/(main)/pages/crud/Checador/ZonasChecador.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputSwitch } from 'primereact/inputswitch';
import { Slider } from 'primereact/slider';
import { Toast } from 'primereact/toast';
import { Tag } from 'primereact/tag';
import L from 'leaflet';
// @ts-ignore: importar CSS de leaflet como efecto secundario
import 'leaflet/dist/leaflet.css';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import {
    ZonaChecadorAdmin,
    actualizarZona,
    crearZona,
    eliminarZona,
    fetchTodasLasZonas
} from '../../../../../Services/BD/Checador/checadorZonaService';

const iconUrl: string = (icon as any)?.src || (icon as any) || '';
const iconShadowUrl: string = (iconShadow as any)?.src || (iconShadow as any) || '';

let DefaultIcon = L.icon({
    iconUrl,
    shadowUrl: iconShadowUrl,
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const CENTRO_DEFAULT: [number, number] = [21.1619, -86.8515];
const ZOOM_DEFAULT = 14;

type ZonaEnEdicion = Partial<ZonaChecadorAdmin> & { latitud: number; longitud: number; radio_metros: number; nombre: string; activo: boolean };

const ZonasChecador: React.FC = () => {
    const toast = useRef<Toast>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const zonaCirclesRef = useRef<Map<number, L.Circle>>(new Map());
    const editMarkerRef = useRef<L.Marker | null>(null);
    const editCircleRef = useRef<L.Circle | null>(null);
    const modoAgregarRef = useRef(false);

    const [zonas, setZonas] = useState<ZonaChecadorAdmin[]>([]);
    const [cargando, setCargando] = useState(true);
    const [isMapReady, setIsMapReady] = useState(false);
    const [modoAgregar, setModoAgregar] = useState(false);
    const [seleccionada, setSeleccionada] = useState<ZonaEnEdicion | null>(null);
    const [posicionToken, setPosicionToken] = useState(0);
    const [guardando, setGuardando] = useState(false);

    modoAgregarRef.current = modoAgregar;

    const cargarZonas = async () => {
        setCargando(true);
        try {
            const data = await fetchTodasLasZonas();
            setZonas(data);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las zonas', life: 3000 });
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarZonas();
    }, []);

    // Inicializar mapa (una sola vez)
    useEffect(() => {
        if (typeof window === 'undefined' || !mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, { center: CENTRO_DEFAULT, zoom: ZOOM_DEFAULT });
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
        }).addTo(map);
        // Capa de referencia (calles, nombres de lugares) sobrepuesta a la imagen satelital
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri'
        }).addTo(map);

        map.on('click', (e: L.LeafletMouseEvent) => {
            if (!modoAgregarRef.current) return;
            setSeleccionada({
                nombre: '',
                latitud: e.latlng.lat,
                longitud: e.latlng.lng,
                radio_metros: 100,
                activo: true
            });
            setModoAgregar(false);
            setPosicionToken((t) => t + 1);
        });

        mapRef.current = map;
        setIsMapReady(true);

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Dibujar las zonas existentes (excepto la que se está editando, que tiene su propio marcador)
    useEffect(() => {
        if (!isMapReady || !mapRef.current) return;
        const map = mapRef.current;

        zonaCirclesRef.current.forEach((circle) => circle.remove());
        zonaCirclesRef.current.clear();

        zonas.forEach((zona) => {
            if (!zona.id || zona.id === seleccionada?.id) return;
            const circle = L.circle([zona.latitud, zona.longitud], {
                radius: zona.radio_metros,
                color: zona.activo ? '#3b82f6' : '#94a3b8',
                fillColor: zona.activo ? '#3b82f6' : '#94a3b8',
                fillOpacity: 0.15
            })
                .addTo(map)
                .bindTooltip(`${zona.nombre} (${zona.radio_metros}m)`);
            zonaCirclesRef.current.set(zona.id, circle);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zonas, isMapReady, seleccionada?.id]);

    // Colocar / mover el marcador editable cuando se selecciona una zona nueva o distinta
    useEffect(() => {
        if (!isMapReady || !mapRef.current || !seleccionada) {
            editMarkerRef.current?.remove();
            editMarkerRef.current = null;
            editCircleRef.current?.remove();
            editCircleRef.current = null;
            return;
        }
        const map = mapRef.current;

        editMarkerRef.current?.remove();
        editCircleRef.current?.remove();

        const marker = L.marker([seleccionada.latitud, seleccionada.longitud], { draggable: true }).addTo(map);
        const circle = L.circle([seleccionada.latitud, seleccionada.longitud], {
            radius: seleccionada.radio_metros,
            color: '#22c55e',
            fillColor: '#22c55e',
            fillOpacity: 0.2
        }).addTo(map);

        marker.on('drag', (e: any) => {
            const pos = e.target.getLatLng();
            circle.setLatLng(pos);
        });
        marker.on('dragend', (e: any) => {
            const pos = e.target.getLatLng();
            setSeleccionada((prev) => (prev ? { ...prev, latitud: pos.lat, longitud: pos.lng } : prev));
        });

        editMarkerRef.current = marker;
        editCircleRef.current = circle;
        map.setView([seleccionada.latitud, seleccionada.longitud], Math.max(map.getZoom(), 15));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMapReady, seleccionada?.id, posicionToken]);

    // Actualizar el radio del círculo en vivo mientras se mueve el slider
    useEffect(() => {
        if (seleccionada) editCircleRef.current?.setRadius(seleccionada.radio_metros);
    }, [seleccionada?.radio_metros]);

    const iniciarNuevaZona = () => {
        setSeleccionada(null);
        setModoAgregar(true);
    };

    const editarZona = (zona: ZonaChecadorAdmin) => {
        setModoAgregar(false);
        setSeleccionada({ ...zona });
        setPosicionToken((t) => t + 1);
    };

    const usarMiUbicacion = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setSeleccionada((prev) =>
                    prev
                        ? { ...prev, latitud: pos.coords.latitude, longitud: pos.coords.longitude }
                        : { nombre: '', latitud: pos.coords.latitude, longitud: pos.coords.longitude, radio_metros: 100, activo: true }
                );
                setPosicionToken((t) => t + 1);
            },
            (err) => toast.current?.show({ severity: 'error', summary: 'Ubicación', detail: err.message, life: 4000 })
        );
    };

    const cancelarEdicion = () => {
        setSeleccionada(null);
        setModoAgregar(false);
    };

    const guardarZona = async () => {
        if (!seleccionada || !seleccionada.nombre.trim()) {
            toast.current?.show({ severity: 'warn', summary: 'Falta el nombre', detail: 'Ponle un nombre a la zona (ej. Patio Principal)', life: 3000 });
            return;
        }

        setGuardando(true);
        try {
            if (seleccionada.id) {
                await actualizarZona(seleccionada as ZonaChecadorAdmin);
            } else {
                await crearZona({
                    nombre: seleccionada.nombre,
                    latitud: seleccionada.latitud,
                    longitud: seleccionada.longitud,
                    radio_metros: seleccionada.radio_metros,
                    activo: seleccionada.activo
                });
            }
            toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Zona guardada correctamente', life: 2500 });
            setSeleccionada(null);
            await cargarZonas();
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la zona', life: 3000 });
        } finally {
            setGuardando(false);
        }
    };

    const borrarZona = async (zona: ZonaChecadorAdmin) => {
        if (!zona.id) return;
        if (!window.confirm(`¿Eliminar la zona "${zona.nombre}"? Los empleados ya no podrán checar como válidos ahí.`)) return;

        try {
            await eliminarZona(zona.id);
            if (seleccionada?.id === zona.id) setSeleccionada(null);
            toast.current?.show({ severity: 'success', summary: 'Eliminada', detail: 'Zona eliminada', life: 2500 });
            await cargarZonas();
        } catch (error) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar la zona', life: 3000 });
        }
    };

    const listaOrdenada = useMemo(() => [...zonas].sort((a, b) => a.nombre.localeCompare(b.nombre)), [zonas]);

    return (
        <div className="card">
            <Toast ref={toast} />

            <div className="flex justify-content-between align-items-center mb-3">
                <div>
                    <h3 className="m-0">Zonas Permitidas para Checar</h3>
                    <p className="text-500 mt-1 mb-0 text-sm">
                        Haz clic en el mapa para colocar el punto de una zona, arrastra el pin para ajustarlo y usa el control deslizante para el radio.
                    </p>
                </div>
                <Button label="Nueva Zona" icon="pi pi-plus" onClick={iniciarNuevaZona} disabled={modoAgregar} />
            </div>

            {modoAgregar && (
                <div className="bg-blue-50 border-1 border-blue-200 border-round p-2 mb-3 text-blue-700 text-sm">
                    <i className="pi pi-map-marker mr-2" />
                    Haz clic en el mapa donde quieres colocar la nueva zona.
                </div>
            )}

            <div className="grid">
                <div className="col-12 md:col-4">
                    <div className="flex flex-column gap-2" style={{ maxHeight: '520px', overflowY: 'auto' }}>
                        {cargando ? (
                            <div className="text-center text-500 p-3">Cargando...</div>
                        ) : listaOrdenada.length === 0 ? (
                            <div className="text-center text-500 p-3">Aún no hay zonas registradas</div>
                        ) : (
                            listaOrdenada.map((zona) => (
                                <div
                                    key={zona.id}
                                    className={`border-1 border-round p-2 flex justify-content-between align-items-center cursor-pointer ${
                                        seleccionada?.id === zona.id ? 'border-primary surface-100' : 'surface-border'
                                    }`}
                                    onClick={() => editarZona(zona)}
                                >
                                    <div>
                                        <div className="font-medium">{zona.nombre}</div>
                                        <div className="text-500 text-sm">Radio: {zona.radio_metros} m</div>
                                    </div>
                                    <div className="flex align-items-center gap-2">
                                        {!zona.activo && <Tag severity="warning" value="Inactiva" />}
                                        <Button
                                            icon="pi pi-trash"
                                            severity="danger"
                                            text
                                            rounded
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                borrarZona(zona);
                                            }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {seleccionada && (
                        <div className="border-1 surface-border border-round p-3 mt-3">
                            <h5 className="mt-0">{seleccionada.id ? 'Editar zona' : 'Nueva zona'}</h5>

                            <div className="field">
                                <label htmlFor="nombreZona">Nombre</label>
                                <InputText
                                    id="nombreZona"
                                    value={seleccionada.nombre}
                                    onChange={(e) => setSeleccionada({ ...seleccionada, nombre: e.target.value })}
                                    placeholder="Ej. Patio Principal"
                                    className="w-full"
                                />
                            </div>

                            <div className="field">
                                <label>Radio permitido: {seleccionada.radio_metros} m</label>
                                <Slider
                                    value={seleccionada.radio_metros}
                                    min={20}
                                    max={1000}
                                    step={10}
                                    onChange={(e) => setSeleccionada({ ...seleccionada, radio_metros: e.value as number })}
                                />
                            </div>

                            <div className="field flex align-items-center gap-2">
                                <InputSwitch checked={seleccionada.activo} onChange={(e) => setSeleccionada({ ...seleccionada, activo: e.value })} />
                                <label className="m-0">Zona activa</label>
                            </div>

                            <Button label="Usar mi ubicación actual" icon="pi pi-map-marker" text className="w-full mb-2" onClick={usarMiUbicacion} />

                            <div className="flex gap-2">
                                <Button label="Cancelar" severity="secondary" outlined onClick={cancelarEdicion} className="flex-1" disabled={guardando} />
                                <Button label="Guardar" icon="pi pi-check" onClick={guardarZona} loading={guardando} className="flex-1" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="col-12 md:col-8">
                    <div ref={mapContainerRef} style={{ height: '560px', width: '100%', borderRadius: '8px', overflow: 'hidden' }} />
                </div>
            </div>
        </div>
    );
};

export default ZonasChecador;
