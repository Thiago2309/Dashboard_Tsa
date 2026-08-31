'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { SelectButton } from 'primereact/selectbutton';
import { Toast } from 'primereact/toast';
import { Tag } from 'primereact/tag';
import { Dialog } from 'primereact/dialog';
import { Calendar } from 'primereact/calendar';
import L from 'leaflet';
// @ts-ignore: importar CSS de leaflet como efecto secundario
import 'leaflet/dist/leaflet.css';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import {
    fetchEquiposConGPS,
    simularSiguienteMovimiento,
    fetchRecorrido,
    detectarParadas,
    EquipoGPS,
    TipoEquipoGPS,
    PuntoRecorrido,
    ParadaRecorrido,
    SeveridadParada
} from '../../../../Services/BD/gpsService';

const iconUrl: string = (icon as any)?.src || (icon as any) || '';
const iconShadowUrl: string = (iconShadow as any)?.src || (iconShadow as any) || '';

let DefaultIcon = L.icon({
    iconUrl: iconUrl,
    shadowUrl: iconShadowUrl,
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const CENTRO_DEFAULT: [number, number] = [21.1619, -86.8515];
const ZOOM_DEFAULT = 13;

const getEstatusColor = (estatus: string): string => {
    switch (estatus) {
        case 'Activo': return '#22c55e';
        case 'Mantenimiento': return '#eab308';
        case 'Inactivo': return '#64748b';
        case 'Dado de Baja': return '#ef4444';
        default: return '#3b82f6';
    }
};

const createEquipoIcon = (equipo: EquipoGPS, seleccionado: boolean) => {
    const color = getEstatusColor(equipo.estatus);
    const pi = equipo.tipo === 'camion' ? 'pi-truck' : 'pi-cog';
    const tamano = seleccionado ? 40 : 32;
    const borde = seleccionado ? 3 : 2;
    return L.divIcon({
        className: 'gps-marker-icon',
        html: `<div style="background: var(--surface-card, #fff); border-radius: 50%; padding: 4px; border: ${borde}px solid ${color}; box-shadow: 0 2px 6px rgba(0,0,0,0.35);">
                <i class="pi ${pi}" style="font-size: ${seleccionado ? 18 : 14}px; color: ${color};"></i>
              </div>`,
        iconSize: [tamano, tamano],
        iconAnchor: [tamano / 2, tamano / 2],
        popupAnchor: [0, -tamano / 2]
    });
};

const tipoOptions = [
    { label: 'Todos', value: 'todos' },
    { label: 'Camiones', value: 'camion' },
    { label: 'Maquinaria', value: 'maquinaria' }
];

const COLOR_SEVERIDAD: Record<SeveridadParada, string> = {
    verde: '#22c55e',
    amarillo: '#eab308',
    rojo: '#ef4444'
};

const ETIQUETA_SEVERIDAD: Record<SeveridadParada, string> = {
    verde: '2 a 5 min',
    amarillo: '5 a 15 min',
    rojo: 'Más de 15 min'
};

const formatearHora = (iso: string): string =>
    new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

// Mapa del recorrido histórico de un equipo en una fecha: dibuja la ruta,
// marca las paradas (verde/amarillo/rojo según duración) y muestra la hora
// del punto más cercano al pasar el cursor sobre la ruta.
const RecorridoMap: React.FC<{ puntos: PuntoRecorrido[]; paradas: ParadaRecorrido[] }> = ({ puntos, paradas }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined' || !containerRef.current) return;

        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }

        const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
        }).addTo(map);

        if (puntos.length === 0) {
            map.setView(CENTRO_DEFAULT, ZOOM_DEFAULT);
            mapInstanceRef.current = map;
            return () => {
                map.remove();
                mapInstanceRef.current = null;
            };
        }

        const latlngs = puntos.map((p) => [p.lat, p.lng] as [number, number]);
        const ruta = L.polyline(latlngs, { color: '#3b82f6', weight: 4, opacity: 0.85 }).addTo(map);
        map.fitBounds(ruta.getBounds(), { padding: [30, 30] });

        // Marcador de origen y destino
        L.circleMarker(latlngs[0], { radius: 6, color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 1 })
            .addTo(map)
            .bindTooltip(`Inicio: ${formatearHora(puntos[0].timestamp)}`);
        L.circleMarker(latlngs[latlngs.length - 1], { radius: 6, color: '#1e293b', fillColor: '#1e293b', fillOpacity: 1 })
            .addTo(map)
            .bindTooltip(`Fin: ${formatearHora(puntos[puntos.length - 1].timestamp)}`);

        // Paradas marcadas por severidad
        paradas.forEach((parada) => {
            const color = COLOR_SEVERIDAD[parada.severidad];
            L.circleMarker([parada.lat, parada.lng], {
                radius: 9,
                color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.85
            })
                .addTo(map)
                .bindPopup(
                    `<div class="p-1">
                        <strong>Parada de ${parada.duracionMinutos} min</strong><br/>
                        ${formatearHora(parada.inicio)} - ${formatearHora(parada.fin)}
                    </div>`
                );
        });

        // Cursor que sigue el punto más cercano de la ruta y muestra su hora
        const cursor = L.circleMarker(latlngs[0], {
            radius: 5,
            color: '#1d4ed8',
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2
        }).bindTooltip('', { direction: 'top', sticky: true, className: 'gps-recorrido-tooltip' });

        ruta.on('mouseover', () => cursor.addTo(map));
        ruta.on('mousemove', (e: L.LeafletMouseEvent) => {
            let masCercano = puntos[0];
            let distanciaMin = Infinity;
            for (const p of puntos) {
                const d = map.distance(e.latlng, [p.lat, p.lng]);
                if (d < distanciaMin) {
                    distanciaMin = d;
                    masCercano = p;
                }
            }
            cursor.setLatLng([masCercano.lat, masCercano.lng]);
            cursor.setTooltipContent(`${formatearHora(masCercano.timestamp)} · ${masCercano.velocidad} km/h`);
            cursor.openTooltip();
        });
        ruta.on('mouseout', () => cursor.remove());

        mapInstanceRef.current = map;

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, [puntos, paradas]);

    return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
};

const GPSModule: React.FC = () => {
    const toast = useRef<Toast | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<Map<string, L.Marker>>(new Map());
    const streetLayerRef = useRef<L.TileLayer | null>(null);
    const satelliteLayerRef = useRef<L.TileLayer | null>(null);

    const [equipos, setEquipos] = useState<EquipoGPS[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isMapReady, setIsMapReady] = useState<boolean>(false);
    const [capaSatelital, setCapaSatelital] = useState<boolean>(true);
    const [searchText, setSearchText] = useState<string>('');
    const [filtroTipo, setFiltroTipo] = useState<TipoEquipoGPS | 'todos'>('todos');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [recorridoDialog, setRecorridoDialog] = useState<boolean>(false);
    const [recorridoEquipo, setRecorridoEquipo] = useState<EquipoGPS | null>(null);
    const [recorridoFecha, setRecorridoFecha] = useState<Date>(new Date());
    const [recorridoPuntos, setRecorridoPuntos] = useState<PuntoRecorrido[]>([]);
    const [recorridoParadas, setRecorridoParadas] = useState<ParadaRecorrido[]>([]);
    const [recorridoLoading, setRecorridoLoading] = useState<boolean>(false);

    // Cargar equipos con GPS activado (camiones + maquinaria)
    const cargarEquipos = async () => {
        setLoading(true);
        try {
            const data = await fetchEquiposConGPS();
            setEquipos(data);
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarEquipos();
    }, []);

    const equiposFiltrados = useMemo(() => {
        return equipos.filter((e) => {
            const coincideTipo = filtroTipo === 'todos' || e.tipo === filtroTipo;
            const coincideBusqueda = e.nombre.toLowerCase().includes(searchText.toLowerCase());
            return coincideTipo && coincideBusqueda;
        });
    }, [equipos, filtroTipo, searchText]);

    // Inicializar mapa
    useEffect(() => {
        if (typeof window === 'undefined' || !mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: CENTRO_DEFAULT,
            zoom: ZOOM_DEFAULT,
            zoomControl: false,
            attributionControl: true
        });

        const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        });

        const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
        });

        satellite.addTo(map);

        streetLayerRef.current = street;
        satelliteLayerRef.current = satellite;
        mapRef.current = map;
        setIsMapReady(true);

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Alternar capa satelital / calles
    useEffect(() => {
        const map = mapRef.current;
        const street = streetLayerRef.current;
        const satellite = satelliteLayerRef.current;
        if (!map || !street || !satellite) return;

        if (capaSatelital) {
            map.removeLayer(street);
            satellite.addTo(map);
        } else {
            map.removeLayer(satellite);
            street.addTo(map);
        }
    }, [capaSatelital]);

    // Sincronizar marcadores con los equipos
    useEffect(() => {
        if (!isMapReady || !mapRef.current) return;
        const map = mapRef.current;
        const idsVisibles = new Set(equiposFiltrados.map((e) => e.id));

        // Quitar marcadores que ya no aplican al filtro
        markersRef.current.forEach((marker, id) => {
            if (!idsVisibles.has(id)) {
                marker.remove();
                markersRef.current.delete(id);
            }
        });

        equiposFiltrados.forEach((equipo) => {
            const seleccionado = equipo.id === selectedId;
            const popupHtml = `
                <div class="p-2">
                    <h4 class="m-0 mb-1">${equipo.nombre}</h4>
                    <p class="m-0"><strong>Tipo:</strong> ${equipo.tipo === 'camion' ? 'Camión' : 'Maquinaria'}</p>
                    <p class="m-0"><strong>Identificador:</strong> ${equipo.identificador || '-'}</p>
                    <p class="m-0"><strong>Estatus:</strong> ${equipo.estatus}</p>
                    ${equipo.tipo === 'camion' ? `<p class="m-0"><strong>Velocidad:</strong> ${equipo.velocidad} km/h</p>` : ''}
                    <p class="m-0 mt-1 text-500" style="font-size: 0.75rem;">Posición simulada</p>
                </div>
            `;

            const existente = markersRef.current.get(equipo.id);
            if (existente) {
                existente.setLatLng([equipo.lat, equipo.lng]);
                existente.setIcon(createEquipoIcon(equipo, seleccionado));
                existente.setPopupContent(popupHtml);
            } else {
                const marker = L.marker([equipo.lat, equipo.lng], { icon: createEquipoIcon(equipo, seleccionado) })
                    .addTo(map)
                    .bindPopup(popupHtml)
                    .on('click', () => setSelectedId(equipo.id));
                markersRef.current.set(equipo.id, marker);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [equiposFiltrados, isMapReady, selectedId]);

    const centrarEnEquipo = (equipo: EquipoGPS) => {
        setSelectedId(equipo.id);
        mapRef.current?.setView([equipo.lat, equipo.lng], 16);
        markersRef.current.get(equipo.id)?.openPopup();
    };

    const actualizarPosiciones = () => {
        setEquipos((prev) => prev.map(simularSiguienteMovimiento));
        toast.current?.show({ severity: 'success', summary: 'Actualizado', detail: 'Posiciones (simuladas) actualizadas', life: 2000 });
    };

    const vistaGeneral = () => {
        mapRef.current?.setView(CENTRO_DEFAULT, ZOOM_DEFAULT);
        setSelectedId(null);
    };

    // Cargar el recorrido (histórico simulado) de un equipo en la fecha seleccionada
    const cargarRecorrido = async (equipo: EquipoGPS, fecha: Date) => {
        setRecorridoLoading(true);
        try {
            const puntos = await fetchRecorrido(equipo.id, fecha);
            setRecorridoPuntos(puntos);
            setRecorridoParadas(detectarParadas(puntos));
        } catch (error: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message, life: 3000 });
        } finally {
            setRecorridoLoading(false);
        }
    };

    const abrirRecorrido = (equipo: EquipoGPS) => {
        setRecorridoEquipo(equipo);
        setRecorridoDialog(true);
        const fecha = new Date();
        setRecorridoFecha(fecha);
        cargarRecorrido(equipo, fecha);
    };

    const cambiarFechaRecorrido = (fecha: Date) => {
        setRecorridoFecha(fecha);
        if (recorridoEquipo) cargarRecorrido(recorridoEquipo, fecha);
    };

    const resumenParadas = useMemo(() => ({
        verde: recorridoParadas.filter((p) => p.severidad === 'verde').length,
        amarillo: recorridoParadas.filter((p) => p.severidad === 'amarillo').length,
        rojo: recorridoParadas.filter((p) => p.severidad === 'rojo').length
    }), [recorridoParadas]);

    if (typeof window === 'undefined') {
        return (
            <div className="flex justify-content-center align-items-center" style={{ height: '400px' }}>
                <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }}></i>
            </div>
        );
    }

    return (
        <div className="gps-shell">
            <Toast ref={toast} />

            <div className="gps-topbar">
                <h2 className="m-0 flex align-items-center gap-2">
                    <i className="pi pi-map text-primary" style={{ fontSize: '1.5rem' }} />
                    Rastreo GPS - Flotilla
                </h2>
                <div className="flex align-items-center flex-wrap gap-2">
                    <Tag severity="warning" icon="pi pi-info-circle" value="Datos simulados: pendiente conectar proveedor de GPS" />
                    <Button icon="pi pi-sync" label="Actualizar" className="p-button-outlined" onClick={actualizarPosiciones} />
                </div>
            </div>

            <div className="gps-map-area">
                <div ref={mapContainerRef} className="gps-map" />

                <div className="gps-map-controls">
                    <Button icon="pi pi-plus" rounded severity="secondary" onClick={() => mapRef.current?.zoomIn()} tooltip="Acercar" />
                    <Button icon="pi pi-minus" rounded severity="secondary" onClick={() => mapRef.current?.zoomOut()} tooltip="Alejar" />
                    <Button icon="pi pi-home" rounded severity="secondary" onClick={vistaGeneral} tooltip="Vista general" />
                    <Button
                        icon={capaSatelital ? 'pi pi-map' : 'pi pi-images'}
                        rounded
                        severity="secondary"
                        onClick={() => setCapaSatelital((v) => !v)}
                        tooltip={capaSatelital ? 'Ver calles' : 'Ver satélite'}
                    />
                </div>

                <div className="gps-floating-panel">
                    <div className="gps-panel-header">
                        <span className="p-input-icon-left w-full">
                            <i className="pi pi-search" />
                            <InputText
                                placeholder="Buscar equipo..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="w-full"
                            />
                        </span>
                        <SelectButton
                            value={filtroTipo}
                            options={tipoOptions}
                            onChange={(e) => e.value && setFiltroTipo(e.value)}
                            className="gps-tipo-filter"
                        />
                    </div>

                    <div className="gps-panel-list">
                        {loading && (
                            <div className="flex justify-content-center p-4">
                                <i className="pi pi-spin pi-spinner text-xl" />
                            </div>
                        )}
                        {!loading && equiposFiltrados.length === 0 && (
                            <div className="text-center text-500 p-4">No hay equipos con GPS activado</div>
                        )}
                        {!loading && equiposFiltrados.map((equipo) => (
                            <div
                                key={equipo.id}
                                className={`gps-list-item ${equipo.id === selectedId ? 'gps-list-item-selected' : ''}`}
                                onClick={() => centrarEnEquipo(equipo)}
                            >
                                <span className="gps-list-dot" style={{ backgroundColor: getEstatusColor(equipo.estatus) }} />
                                <i className={`pi ${equipo.tipo === 'camion' ? 'pi-truck' : 'pi-cog'}`} />
                                <span className="gps-list-name">{equipo.nombre}</span>
                                <Button
                                    icon="pi pi-history"
                                    rounded
                                    text
                                    className="gps-list-history-btn"
                                    tooltip="Ver recorrido"
                                    tooltipOptions={{ position: 'left' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        abrirRecorrido(equipo);
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <Dialog
                visible={recorridoDialog}
                onHide={() => setRecorridoDialog(false)}
                header={`Recorrido - ${recorridoEquipo?.nombre || ''}`}
                style={{ width: '90vw', maxWidth: '1100px' }}
                modal
            >
                <div className="gps-recorrido-toolbar">
                    <div className="flex align-items-center gap-2">
                        <label htmlFor="recorrido-fecha" className="font-bold">Fecha</label>
                        <Calendar
                            id="recorrido-fecha"
                            value={recorridoFecha}
                            onChange={(e) => e.value && cambiarFechaRecorrido(e.value as Date)}
                            dateFormat="yy-mm-dd"
                            maxDate={new Date()}
                            showIcon
                        />
                    </div>
                    <div className="gps-recorrido-legend">
                        {(Object.keys(COLOR_SEVERIDAD) as SeveridadParada[]).map((sev) => (
                            <span key={sev} className="gps-recorrido-legend-item">
                                <span className="gps-list-dot" style={{ backgroundColor: COLOR_SEVERIDAD[sev] }} />
                                {ETIQUETA_SEVERIDAD[sev]} ({resumenParadas[sev]})
                            </span>
                        ))}
                    </div>
                </div>

                <div className="gps-recorrido-map-shell">
                    {recorridoLoading && (
                        <div className="flex justify-content-center align-items-center" style={{ height: '100%' }}>
                            <i className="pi pi-spin pi-spinner text-2xl" />
                        </div>
                    )}
                    {!recorridoLoading && (
                        <RecorridoMap puntos={recorridoPuntos} paradas={recorridoParadas} />
                    )}
                </div>

                <small className="text-500">
                    Recorrido y paradas simulados: pendiente conectar el proveedor de GPS real. Pasa el cursor sobre la ruta para ver la hora de cada punto.
                </small>
            </Dialog>

            <style jsx global>{`
                .gps-shell {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .gps-topbar {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: space-between;
                    align-items: center;
                    gap: 0.75rem;
                }

                .gps-map-area {
                    position: relative;
                    width: 100%;
                    height: calc(100vh - 200px);
                    min-height: 480px;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                }

                .gps-map {
                    position: absolute;
                    inset: 0;
                    background: #f8f9fa;
                }

                .gps-map-controls {
                    position: absolute;
                    bottom: 1rem;
                    left: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    z-index: 1000;
                }

                .gps-floating-panel {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    bottom: 1rem;
                    width: 300px;
                    max-width: calc(100% - 2rem);
                    background: var(--surface-card);
                    backdrop-filter: blur(10px);
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    z-index: 1000;
                    border: 1px solid var(--surface-border);
                }

                .gps-panel-header {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    border-bottom: 1px solid var(--surface-border);
                }

                .gps-tipo-filter .p-button {
                    padding: 0.35rem 0.5rem;
                    font-size: 0.8rem;
                }

                .gps-panel-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0.5rem;
                }

                .gps-list-item {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.6rem 0.5rem;
                    border-radius: 8px;
                    cursor: pointer;
                    color: var(--text-color);
                }

                .gps-list-item:hover {
                    background: var(--surface-hover);
                }

                .gps-list-item-selected {
                    background: var(--primary-50, rgba(59, 130, 246, 0.12));
                    font-weight: 600;
                }

                .gps-list-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }

                .gps-list-name {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .gps-list-history-btn {
                    width: 2rem !important;
                    height: 2rem !important;
                    flex-shrink: 0;
                }

                .gps-recorrido-toolbar {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .gps-recorrido-legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .gps-recorrido-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.85rem;
                }

                .gps-recorrido-map-shell {
                    position: relative;
                    width: 100%;
                    height: 65vh;
                    min-height: 400px;
                    border-radius: 8px;
                    overflow: hidden;
                    margin-bottom: 0.75rem;
                }

                .gps-recorrido-tooltip {
                    font-weight: 600;
                }

                .leaflet-container {
                    background: #f8f9fa;
                }

                .leaflet-popup-content {
                    min-width: 200px;
                }

                .gps-marker-icon {
                    background: none;
                    border: none;
                }

                @media (max-width: 900px) {
                    .gps-map-area {
                        height: auto;
                        min-height: unset;
                        overflow: visible;
                        display: flex;
                        flex-direction: column;
                    }

                    .gps-map {
                        position: relative;
                        inset: auto;
                        height: 55vh;
                        width: 100%;
                        border-radius: 12px;
                        overflow: hidden;
                    }

                    .gps-floating-panel {
                        position: static;
                        width: 100%;
                        max-width: 100%;
                        margin-top: 0.75rem;
                        height: 320px;
                    }
                }
            `}</style>
        </div>
    );
};

export default GPSModule;
