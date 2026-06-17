"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import NuevaFactura from './NuevaFactura';
// import ListaFacturas from './ListaFacturas';
import ConfiguracionFiscal from './ConfiguracionFiscal';

const FacturacionPage = () => {
    const [activeModule, setActiveModule] = useState('Nueva Factura');
    const searchParams = useSearchParams();

    useEffect(() => {
        const moduleParam = searchParams.get('module');
        if (moduleParam) {
            setActiveModule(moduleParam);
        }
    }, [searchParams]);

    const renderModule = () => {
        switch (activeModule) {
            case 'Nueva Factura':
                return <NuevaFactura />;
            // case 'Mis Facturas':
            //     return <ListaFacturas />;
            case 'Configuración Fiscal':
                return <ConfiguracionFiscal />;
            default:
                return <div>Selecciona un módulo</div>;
        }
    };

    return (
        <div className="grid">
            <div className="col-12">
                <div className="card">
                    {/* Menú horizontal estilo TableModule */}
                    <div style={styles.menu}>
                        <div
                            style={activeModule === 'Nueva Factura' ? styles.activeMenuItem : styles.menuItem}
                            onClick={() => setActiveModule('Nueva Factura')}
                        >
                            Nueva Factura
                        </div>
                        <div
                            style={activeModule === 'Mis Facturas' ? styles.activeMenuItem : styles.menuItem}
                            onClick={() => setActiveModule('Mis Facturas')}
                        >
                            Mis Facturas
                        </div>
                        <div
                            style={activeModule === 'Configuración Fiscal' ? styles.activeMenuItem : styles.menuItem}
                            onClick={() => setActiveModule('Configuración Fiscal')}
                        >
                            Configuración Fiscal
                        </div>
                    </div>
                    <div style={styles.tableContainer}>
                        {renderModule()}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Estilos idénticos a TableModule
const styles = {
    container: {
        backgroundColor: '#f9f9f9',
    },
    title: {
        marginBottom: '20px',
        fontSize: '24px',
        fontWeight: 'bold',
    },
    whiteContainer: {
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        padding: '20px',
    },
    menu: {
        display: 'flex',
        marginBottom: '20px',
        borderBottom: '2px solid #ccc',
    },
    menuItem: {
        padding: '10px 20px',
        cursor: 'pointer',
        borderBottom: '2px solid transparent',
    },
    activeMenuItem: {
        padding: '10px 20px',
        cursor: 'pointer',
        borderBottom: '2px solid red',
        fontWeight: 'bold',
    },
    actions: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '20px',
    },
    button: {
        marginLeft: '10px',
    },
    tableContainer: {
        marginTop: '20px',
    },
};

export default FacturacionPage;