'use client';

import React, { useState, useEffect } from 'react';
import RentaMaquinariaModule from './rentaMaquinaria';
import { useSearchParams } from 'next/navigation';

const MaquinariaModule = () => {
    const [activeModule, setActiveModule] = useState('Maquinaria');
    const searchParams = useSearchParams();

    useEffect(() => {
        const moduleParam = searchParams.get('module');
        if (moduleParam) {
            setActiveModule(moduleParam);
        }
    }, [searchParams]);

    const renderModule = () => {
        switch (activeModule) {
            case 'Maquinaria':
                return <RentaMaquinariaModule />;
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
                                    className={`menu-item ${activeModule === 'Maquinaria' ? 'active' : ''}`}
                                    onClick={() => setActiveModule('Maquinaria')}
                                >
                                    Maquinaria
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

export default MaquinariaModule;
