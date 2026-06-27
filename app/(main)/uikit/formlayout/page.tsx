'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import ViajesModule from './viajes';
import GastosModule from './gastos';
import CombustibleModule from './combustible';
import CajaNegraModule from './cajanegra';
import OrigenDestino from './PrecioOriengenDestino';
import ClientesCrud from './clientes';
import OperadoresCrud from './operador';
import InvitadosCrud from './invitados';
import ProvedoresCrud from './provedores';
import MaterialCrud from './material';

import { useSearchParams } from 'next/navigation';

const TableModule = () => {
    const [activeModule, setActiveModule] = useState('Viajes');
    const searchParams = useSearchParams();

    useEffect(() => {
        const moduleParam = searchParams.get('module');
        if (moduleParam) {
            setActiveModule(moduleParam);
        }
    }, [searchParams]);

    const renderModule = () => {
        switch (activeModule) {
            case 'Viajes':
                return <ViajesModule />;
            case 'Gastos':
                return <GastosModule />;
            case 'Combustible':
                return <CombustibleModule />;
            case 'Caja Negra':
                return <CajaNegraModule />;
            case 'Precio Origen - Destino':
                return <OrigenDestino />;
            case 'Clientes':
                return <ClientesCrud />;
            case 'Operadores':
                return <OperadoresCrud />;
            case 'Provedores':
                return <ProvedoresCrud />;
            case 'Material':
                return <MaterialCrud />;
            case 'Invitados':
                return <InvitadosCrud />;
            default:
                return <div>Selecciona un módulo</div>;
        }
    };

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    {/* Menú con scroll horizontal en móvil */}
                    <div className="menu-container">
                        <div className="menu-scroll">
                            <div className="menu">
                                <div
                                    className={`menu-item ${activeModule === 'Viajes' ? 'active' : ''}`}
                                    onClick={() => setActiveModule('Viajes')}
                                >
                                    Viajes
                                </div>
                                <div
                                    className={`menu-item ${activeModule === 'Gastos' ? 'active' : ''}`}
                                    onClick={() => setActiveModule('Gastos')}
                                >
                                    Gastos
                                </div>
                                <div
                                    className={`menu-item ${activeModule === 'Combustible' ? 'active' : ''}`}
                                    onClick={() => setActiveModule('Combustible')}
                                >
                                    Combustible
                                </div>
                                <div
                                    className={`menu-item ${activeModule === 'Caja Negra' ? 'active' : ''}`}
                                    onClick={() => setActiveModule('Caja Negra')}
                                >
                                    Caja Chica
                                </div>
                                <div
                                    className={`menu-item ${activeModule === 'Precio Origen - Destino' ? 'active' : ''}`}
                                    onClick={() => setActiveModule('Precio Origen - Destino')}
                                >
                                    Precio Origen - Destino
                                </div>
                                <div
                                    className={`menu-item ${activeModule === 'Clientes' ? 'active' : ''}`}
                                    onClick={() => setActiveModule('Clientes')}
                                >
                                    Clientes
                                </div>
                                <div
                                    className={`menu-item ${activeModule === 'Operadores' ? 'active' : ''}`}
                                    onClick={() => setActiveModule('Operadores')}
                                >
                                    Operadores
                                </div>
                                <div
                                    className={`menu-item ${activeModule === 'Provedores' ? 'active' : ''}`}
                                    onClick={() => setActiveModule('Provedores')}
                                >
                                    Provedores
                                </div>
                                <div
                                    className={`menu-item ${activeModule === 'Material' ? 'active' : ''}`}
                                    onClick={() => setActiveModule('Material')}
                                >
                                    Material
                                </div>
                                <div
                                    className={`menu-item ${activeModule === 'Invitados' ? 'active' : ''}`}
                                    onClick={() => setActiveModule('Invitados')}
                                >
                                    Invitados
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="table-container">
                        {renderModule()}
                    </div>
                </div>
            </div>

            {/* Estilos CSS */}
            <style jsx>{`
                .menu-container {
                    width: 100%;
                    position: relative;
                    margin-bottom: 20px;
                }

                .menu-scroll {
                    width: 100%;
                    overflow-x: auto;
                    overflow-y: hidden;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none; /* Firefox */
                    -ms-overflow-style: none; /* IE/Edge */
                    padding-bottom: 5px;
                }

                /* Ocultar scrollbar en Chrome/Safari/Edge */
                .menu-scroll::-webkit-scrollbar {
                    display: none;
                }

                .menu {
                    display: flex;
                    border-bottom: 2px solid #ccc;
                    min-width: max-content;
                    padding-bottom: 2px;
                }

                .menu-item {
                    padding: 10px 20px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    white-space: nowrap;
                    font-size: 14px;
                    flex-shrink: 0;
                    transition: all 0.2s ease;
                }

                .menu-item:hover {
                    background-color: #f5f5f5;
                }

                .menu-item.active {
                    border-bottom: 2px solid red;
                    font-weight: bold;
                }

                .table-container {
                    margin-top: 20px;
                }
            `}</style>
        </div>
    );
};

export default TableModule;