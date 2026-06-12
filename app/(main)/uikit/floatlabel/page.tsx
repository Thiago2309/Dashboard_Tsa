'use client';

import React, { useState } from 'react';
import { Button } from 'primereact/button';
import NominaModule from './nomina';
import BonoModule from './bono';
import PrestamoModule from './prestamo';

const TableModule = () => {
    const [activeModule, setActiveModule] = useState('Nomina'); // El que renderiza al cargar la pagina

    const renderModule = () => {
        switch (activeModule) {
            case 'Nomina':
                return <NominaModule />;
            case 'bono':
                return <BonoModule />;
            case 'prestamo':
                return <PrestamoModule />;
            default:
                return <div>Selecciona un módulo</div>;
        }
    };

    return (
        <div className="grid">
            <div className='col-12'>
            {/* <h1 style={styles.title}>Tables</h1> */}
                <div className="card">
                    <div style={styles.menu}>
                        <div
                            style={activeModule === 'Nomina' ? styles.activeMenuItem : styles.menuItem}
                            onClick={() => setActiveModule('Nomina')}
                        >
                            Nomina - Operador
                        </div>
                        <div
                            style={activeModule === 'bono' ? styles.activeMenuItem : styles.menuItem}
                            onClick={() => setActiveModule('bono')}
                        >
                            Bono - Operador
                        </div>
                        <div
                            style={activeModule === 'prestamo' ? styles.activeMenuItem : styles.menuItem}
                            onClick={() => setActiveModule('prestamo')}
                        >
                            Prestamo - Operador
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

export default TableModule;