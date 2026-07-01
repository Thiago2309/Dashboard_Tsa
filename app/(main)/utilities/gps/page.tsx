'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { Tag } from 'primereact/tag';
import L from 'leaflet';
// @ts-ignore: importar CSS de leaflet como efecto secundario
import 'leaflet/dist/leaflet.css';

// Importar iconos de Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Configurar iconos
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

// Icono personalizado para camiones
const createTruckIcon = (status: string) => {
    const color = status === 'En Ruta' ? '#22c55e' : status === 'Detenido' ? '#eab308' : '#ef4444';
    return L.divIcon({
        className: 'custom-truck-icon',
        html: `<div style="background: white; border-radius: 50%; padding: 4px; border: 2px solid ${color};">
                <i class="pi pi-truck" style="font-size: 20px; color: ${color};"></i>
              </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
};

interface Vehicle {
    id: number;
    placa: string;
    modelo: string;
    conductor: string;
    status: string;
    ultima_actualizacion: string;
    lat: number;
    lng: number;
    velocidad: number;
    temperatura: number;
    combustible: number;
    direccion: string;
    ruta?: [number, number][];
}

const GPSModule: React.FC = () => {
    const toast = useRef<Toast | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const polylinesRef = useRef<L.Polyline[]>([]);
    const circleRef = useRef<L.Circle | null>(null);

    // Estados
    const [vehicles, setVehicles] = useState<Vehicle[]>([
        {
            id: 1,
            placa: 'ABC-1234',
            modelo: 'Scania R500',
            conductor: 'Juan Pérez',
            status: 'En Ruta',
            ultima_actualizacion: '2024-01-15 14:30',
            lat: 21.1619, // Cambiado
            lng: -86.8515, // Cambiado
            velocidad: 65,
            temperatura: 22,
            combustible: 75,
            direccion: 'Av. Bonampak, Cancún',
            ruta: [
                [21.1619, -86.8515],
                [21.1625, -86.8520],
                [21.1630, -86.8525],
                [21.1635, -86.8530]
            ]
        },
        {
            id: 2,
            placa: 'XYZ-5678',
            modelo: 'Kenworth T680',
            conductor: 'María López',
            status: 'Detenido',
            ultima_actualizacion: '2024-01-15 14:15',
            lat: 21.1580, // Cambiado
            lng: -86.8450, // Cambiado
            velocidad: 0,
            temperatura: 18,
            combustible: 45,
            direccion: 'Boulevard Kukulcán, Cancún',
            ruta: [
                [21.1580, -86.8450],
                [21.1585, -86.8440],
                [21.1590, -86.8430]
            ]
        },
        {
            id: 3,
            placa: 'MNO-9012',
            modelo: 'Volvo FH16',
            conductor: 'Carlos Ramírez',
            status: 'En Ruta',
            ultima_actualizacion: '2024-01-15 14:45',
            lat: 21.1700, // Cambiado
            lng: -86.8600, // Cambiado
            velocidad: 80,
            temperatura: 20,
            combustible: 30,
            direccion: 'Zona Hotelera, Cancún',
            ruta: [
                [21.1700, -86.8600],
                [21.1710, -86.8610],
                [21.1720, -86.8620],
                [21.1730, -86.8630],
                [21.1740, -86.8640]
            ]
        }
    ]);

    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [center, setCenter] = useState<[number, number]>([21.1619, -86.8515]);
    const [zoom, setZoom] = useState<number>(13);
    const [historyDialog, setHistoryDialog] = useState<boolean>(false);
    const [selectedHistory, setSelectedHistory] = useState<Vehicle | null>(null);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [searchText, setSearchText] = useState<string>('');
    const [isMapReady, setIsMapReady] = useState<boolean>(false);

    // Opciones para filtros
    const statusOptions = [
        { label: 'Todos', value: null },
        { label: 'En Ruta', value: 'En Ruta' },
        { label: 'Detenido', value: 'Detenido' },
        { label: 'En Taller', value: 'En Taller' },
        { label: 'Disponible', value: 'Disponible' }
    ];

    // Filtrar vehículos - MOVIDO AQUÍ (antes de los useEffect)
    const filteredVehicles = vehicles.filter((vehicle: Vehicle) => {
        const matchesStatus = !filterStatus || vehicle.status === filterStatus;
        const matchesSearch = vehicle.placa.toLowerCase().includes(searchText.toLowerCase()) ||
                            vehicle.conductor.toLowerCase().includes(searchText.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    // Inicializar mapa
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Si ya existe el mapa, limpiarlo
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }

        // Crear el mapa
        if (mapContainerRef.current && !mapRef.current) {
            const map = L.map(mapContainerRef.current, {
                center: center,
                zoom: zoom,
                zoomControl: false,
                attributionControl: true
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(map);

            mapRef.current = map;
            setIsMapReady(true);
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Actualizar marcadores cuando cambian los vehículos
    useEffect(() => {
        if (!isMapReady || !mapRef.current) return;

        const map = mapRef.current;

        // Limpiar marcadores antiguos
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        // Limpiar polilíneas antiguas
        polylinesRef.current.forEach(polyline => polyline.remove());
        polylinesRef.current = [];

        // Limpiar círculo antiguo
        if (circleRef.current) {
            circleRef.current.remove();
            circleRef.current = null;
        }

        // Agregar marcadores para cada vehículo
        filteredVehicles.forEach(vehicle => {
            const icon = createTruckIcon(vehicle.status);
            
            const marker = L.marker([vehicle.lat, vehicle.lng], { icon })
                .addTo(map)
                .bindPopup(`
                    <div class="p-2">
                        <h4 class="m-0">${vehicle.placa}</h4>
                        <p class="m-0"><strong>Conductor:</strong> ${vehicle.conductor}</p>
                        <p class="m-0"><strong>Estado:</strong> ${vehicle.status}</p>
                        <p class="m-0"><strong>Velocidad:</strong> ${vehicle.velocidad} km/h</p>
                        <p class="m-0"><strong>Combustible:</strong> ${vehicle.combustible}%</p>
                    </div>
                `);

            markersRef.current.push(marker);

            // Agregar ruta si existe
            if (vehicle.ruta && vehicle.ruta.length > 1) {
                const color = vehicle.status === 'En Ruta' ? '#22c55e' : '#eab308';
                const polyline = L.polyline(vehicle.ruta, {
                    color: color,
                    weight: 3,
                    opacity: 0.8,
                    dashArray: '10, 10'
                }).addTo(map);
                
                polylinesRef.current.push(polyline);
            }
        });

        // Agregar círculo para vehículo seleccionado
        if (selectedVehicle) {
            const circle = L.circle([selectedVehicle.lat, selectedVehicle.lng], {
                radius: 100,
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1
            }).addTo(map);
            
            circleRef.current = circle;
        }

        // Centrar mapa en el vehículo seleccionado
        if (selectedVehicle) {
            map.setView([selectedVehicle.lat, selectedVehicle.lng], 15);
        }

    }, [filteredVehicles, selectedVehicle, isMapReady]);

    // Actualizar centro y zoom
    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.setView(center, zoom);
        }
    }, [center, zoom]);

    // Centrar mapa en un vehículo
    const centerMapOnVehicle = (vehicle: Vehicle) => {
        setSelectedVehicle(vehicle);
        setCenter([vehicle.lat, vehicle.lng]);
        setZoom(15);

        toast.current?.show({
            severity: 'info',
            summary: 'Vehículo seleccionado',
            detail: `${vehicle.placa} - ${vehicle.conductor}`,
            life: 3000
        });
    };

    // Ver historial de ruta
    const viewHistory = (vehicle: Vehicle) => {
        setSelectedHistory(vehicle);
        setHistoryDialog(true);
    };

    // Obtener color según estado
    const getStatusColor = (status: string): 'success' | 'info' | 'danger' | 'warning' | undefined => {
        switch(status) {
            case 'En Ruta': return 'success';
            case 'Detenido': return 'warning';
            case 'En Taller': return 'danger';
            case 'Disponible': return 'info';
            default: return undefined;
        }
    };

    // Obtener icono según estado
    const getStatusIcon = (status: string): string => {
        switch(status) {
            case 'En Ruta': return 'pi pi-play-circle';
            case 'Detenido': return 'pi pi-stop-circle';
            case 'En Taller': return 'pi pi-wrench';
            case 'Disponible': return 'pi pi-check-circle';
            default: return 'pi pi-circle';
        }
    };

    // Componentes para la tabla
    const statusBodyTemplate = (rowData: Vehicle) => {
        return (
            <Tag 
                icon={getStatusIcon(rowData.status)} 
                severity={getStatusColor(rowData.status)} 
                value={rowData.status}
                rounded
            />
        );
    };

    const ubicacionBodyTemplate = (rowData: Vehicle) => {
        return (
            <Button 
                icon="pi pi-map-marker" 
                className="p-button-rounded p-button-text p-button-sm"
                onClick={() => centerMapOnVehicle(rowData)}
                tooltip="Centrar en mapa"
                tooltipOptions={{ position: 'top' }}
            />
        );
    };

    const actionBodyTemplate = (rowData: Vehicle) => {
        return (
            <div className="flex gap-2">
                <Button 
                    icon="pi pi-history" 
                    className="p-button-rounded p-button-info p-button-sm"
                    onClick={() => viewHistory(rowData)}
                    tooltip="Ver historial"
                    tooltipOptions={{ position: 'top' }}
                />
                <Button 
                    icon="pi pi-refresh" 
                    className="p-button-rounded p-button-success p-button-sm"
                    onClick={() => {
                        toast.current?.show({
                            severity: 'success',
                            summary: 'Actualizado',
                            detail: `Ubicación de ${rowData.placa} actualizada`,
                            life: 2000
                        });
                    }}
                    tooltip="Actualizar ubicación"
                    tooltipOptions={{ position: 'top' }}
                />
            </div>
        );
    };

    // Tarjeta de estadísticas
    const StatsCard: React.FC<{ icon: string; label: string; value: string | number; color: string }> = ({ icon, label, value, color }) => (
        <div className="col-12 sm:col-6 lg:col-3">
            <Card className="mb-0">
                <div className="flex justify-content-between align-items-center">
                    <div>
                        <span className="block text-500 font-medium mb-2">{label}</span>
                        <span className="text-900 font-bold text-xl">{value}</span>
                    </div>
                    <div className={`flex align-items-center justify-content-center bg-${color}-100 border-round`} 
                         style={{ width: '3rem', height: '3rem' }}>
                        <i className={`${icon} text-${color}-500 text-xl`} />
                    </div>
                </div>
            </Card>
        </div>
    );

    // Componente del mapa de historial
    const HistoryMap: React.FC<{ vehicle: Vehicle }> = ({ vehicle }) => {
        const historyMapRef = useRef<HTMLDivElement>(null);
        const historyMapInstance = useRef<L.Map | null>(null);

        useEffect(() => {
            if (typeof window === 'undefined' || !historyMapRef.current) return;

            // Limpiar mapa anterior
            if (historyMapInstance.current) {
                historyMapInstance.current.remove();
                historyMapInstance.current = null;
            }

            // Crear nuevo mapa
            const map = L.map(historyMapRef.current, {
                center: [vehicle.lat, vehicle.lng],
                zoom: 14,
                zoomControl: false
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(map);

            // Agregar marcadores de la ruta
            if (vehicle.ruta) {
                vehicle.ruta.forEach((point, index) => {
                    L.marker(point)
                        .addTo(map)
                        .bindPopup(`Punto ${index + 1}`);
                });

                // Agregar línea de ruta
                if (vehicle.ruta.length > 1) {
                    L.polyline(vehicle.ruta, {
                        color: '#3b82f6',
                        weight: 3
                    }).addTo(map);
                }
            }

            historyMapInstance.current = map;

            return () => {
                if (historyMapInstance.current) {
                    historyMapInstance.current.remove();
                    historyMapInstance.current = null;
                }
            };
        }, [vehicle]);

        return <div ref={historyMapRef} style={{ height: '100%', width: '100%' }} />;
    };

    // Verificar si estamos en cliente
    if (typeof window === 'undefined') {
        return <div className="flex justify-content-center align-items-center" style={{ height: '400px' }}>
            <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }}></i>
        </div>;
    }

    return (
        <div className="grid">
            <Toast ref={toast} />
            
            {/* Título y controles */}
            <div className="col-12">
                <div className="flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <h2 className="m-0 flex align-items-center gap-2">
                        <i className="pi pi-map text-primary" style={{ fontSize: '1.5rem' }} />
                        Monitoreo GPS - Flotilla
                    </h2>
                    <div className="flex gap-2">
                        <Button 
                            icon="pi pi-sync" 
                            label="Actualizar" 
                            className="p-button-outlined"
                            onClick={() => {
                                toast.current?.show({
                                    severity: 'success',
                                    summary: 'Actualizado',
                                    detail: 'Mapa actualizado correctamente',
                                    life: 2000
                                });
                            }}
                        />
                        <Button 
                            icon="pi pi-download" 
                            label="Exportar" 
                            className="p-button-outlined"
                        />
                    </div>
                </div>
            </div>

            {/* Tarjetas de estadísticas */}
            <div className="col-12">
                <div className="grid">
                    <StatsCard 
                        icon="pi pi-truck" 
                        label="Total Vehículos" 
                        value={vehicles.length} 
                        color="primary"
                    />
                    <StatsCard 
                        icon="pi pi-play-circle" 
                        label="En Ruta" 
                        value={vehicles.filter(v => v.status === 'En Ruta').length} 
                        color="success"
                    />
                    <StatsCard 
                        icon="pi pi-stop-circle" 
                        label="Detenidos" 
                        value={vehicles.filter(v => v.status === 'Detenido').length} 
                        color="warning"
                    />
                    <StatsCard 
                        icon="pi pi-wrench" 
                        label="En Taller" 
                        value={vehicles.filter(v => v.status === 'En Taller').length} 
                        color="danger"
                    />
                </div>
            </div>

            {/* Mapa y lista de vehículos */}
            <div className="col-12 lg:col-8">
                <Card className="h-full">
                    <div style={{ height: '600px', width: '100%', position: 'relative' }}>
                        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
                        
                        {/* Botones de control del mapa */}
                        <div className="absolute top-3 right-3 flex flex-column gap-2" style={{ zIndex: 1000 }}>
                            <Button 
                                icon="pi pi-plus" 
                                className="p-button-rounded p-button-secondary" 
                                onClick={() => setZoom(zoom + 1)}
                                tooltip="Acercar"
                            />
                            <Button 
                                icon="pi pi-minus" 
                                className="p-button-rounded p-button-secondary" 
                                onClick={() => setZoom(zoom - 1)}
                                tooltip="Alejar"
                            />
                            <Button 
                                icon="pi pi-home" 
                                className="p-button-rounded p-button-secondary" 
                                onClick={() => {
                                    setCenter([21.1619, -86.8515]);
                                    setZoom(13);
                                    setSelectedVehicle(null);
                                }}
                                tooltip="Vista general"
                            />
                        </div>

                        {/* Leyenda del mapa */}
                        {/* <div className="absolute bottom-3 left-3 bg-white p-2 border-round shadow-2" style={{ zIndex: 1000 }}>
                            <div className="flex flex-column gap-1">
                                <div className="flex align-items-center gap-2">
                                    <span className="w-2rem h-0.1rem bg-green-500"></span>
                                    <span className="text-sm">Ruta activa</span>
                                </div>
                                <div className="flex align-items-center gap-2">
                                    <span className="w-2rem h-0.1rem bg-yellow-500"></span>
                                    <span className="text-sm">Ruta detenida</span>
                                </div>
                                <div className="flex align-items-center gap-2">
                                    <i className="pi pi-truck text-primary"></i>
                                    <span className="text-sm">Vehículo</span>
                                </div>
                            </div>
                        </div> */}
                    </div>
                </Card>
            </div>

            {/* Lista de vehículos */}
            <div className="col-12 lg:col-4">
                <Card className="h-full">
                    <div className="flex flex-column gap-3">
                        {/* Filtros */}
                        <div className="flex flex-column gap-2">
                            <div className="p-inputgroup">
                                <span className="p-inputgroup-addon">
                                    <i className="pi pi-search" />
                                </span>
                                <InputText
                                    placeholder="Buscar por placa o conductor..."
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                />
                            </div>
                            <Dropdown
                                value={filterStatus}
                                options={statusOptions}
                                onChange={(e) => setFilterStatus(e.value)}
                                placeholder="Filtrar por estado"
                                className="w-full"
                            />
                        </div>

                        {/* Tabla de vehículos */}
                        <DataTable
                            value={filteredVehicles}
                            className="p-datatable-sm"
                            scrollable
                            scrollHeight="400px"
                            emptyMessage="No se encontraron vehículos"
                        >
                            <Column field="placa" header="Placa" style={{ minWidth: '100px' }} />
                            <Column field="conductor" header="Conductor" style={{ minWidth: '130px' }} />
                            <Column 
                                field="status" 
                                header="Estado" 
                                body={statusBodyTemplate}
                                style={{ minWidth: '120px' }} 
                            />
                            <Column 
                                field="velocidad" 
                                header="Vel." 
                                body={(rowData) => `${rowData.velocidad} km/h`}
                                style={{ width: '70px' }} 
                            />
                            <Column 
                                header="Ubicación" 
                                body={ubicacionBodyTemplate}
                                style={{ width: '60px' }} 
                            />
                            <Column 
                                header="Acciones" 
                                body={actionBodyTemplate}
                                style={{ width: '100px' }} 
                            />
                        </DataTable>
                    </div>
                </Card>
            </div>

            {/* Diálogo de historial */}
            <Dialog
                visible={historyDialog}
                style={{ width: '80vw', maxWidth: '800px' }}
                header={`Historial de Ruta - ${selectedHistory?.placa || ''}`}
                modal
                onHide={() => setHistoryDialog(false)}
            >
                {selectedHistory && (
                    <div className="p-3">
                        <div className="grid">
                            <div className="col-12">
                                <div className="flex flex-wrap gap-3 mb-3">
                                    <div className="flex-1">
                                        <label className="font-bold">Conductor:</label>
                                        <span className="ml-2">{selectedHistory.conductor}</span>
                                    </div>
                                    <div className="flex-1">
                                        <label className="font-bold">Modelo:</label>
                                        <span className="ml-2">{selectedHistory.modelo}</span>
                                    </div>
                                    <div className="flex-1">
                                        <label className="font-bold">Estado:</label>
                                        <span className="ml-2">
                                            <Tag 
                                                severity={getStatusColor(selectedHistory.status)} 
                                                value={selectedHistory.status}
                                            />
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <div className="flex-1">
                                        <label className="font-bold">Velocidad:</label>
                                        <span className="ml-2">{selectedHistory.velocidad} km/h</span>
                                    </div>
                                    <div className="flex-1">
                                        <label className="font-bold">Combustible:</label>
                                        <span className="ml-2">{selectedHistory.combustible}%</span>
                                    </div>
                                    <div className="flex-1">
                                        <label className="font-bold">Temperatura:</label>
                                        <span className="ml-2">{selectedHistory.temperatura}°C</span>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label className="font-bold">Dirección:</label>
                                    <span className="ml-2">{selectedHistory.direccion}</span>
                                </div>
                            </div>
                            <div className="col-12 mt-3">
                                <h4>Puntos de la ruta</h4>
                                <div style={{ height: '300px' }}>
                                    <HistoryMap vehicle={selectedHistory} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* Estilos adicionales */}
            <style jsx global>{`
                .leaflet-container {
                    border-radius: 8px;
                    background: #f8f9fa;
                }

                .leaflet-popup-content {
                    min-width: 200px;
                }

                .leaflet-control-zoom {
                    border: none !important;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
                }

                .leaflet-control-zoom a {
                    background: white !important;
                    color: #495057 !important;
                }

                .leaflet-control-zoom a:hover {
                    background: #f8f9fa !important;
                }

                .p-datatable-sm .p-datatable-tbody > tr > td {
                    padding: 0.5rem 0.5rem;
                }

                .custom-truck-icon {
                    background: none;
                    border: none;
                }

                /* Mejoras responsive */
                @media (max-width: 768px) {
                    .leaflet-container {
                        height: 400px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default GPSModule;