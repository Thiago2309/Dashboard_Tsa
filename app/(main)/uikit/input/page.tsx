'use client';

import React, { useState } from 'react';
import { Button } from 'primereact/button';
import CxcModule from './Cxc';
import CxpModule from './Cxp';


const TableModule = () => {
    const [activeModule, setActiveModule] = useState('CxC'); // El que renderiza al cargar la pagina

    const renderModule = () => {
        switch (activeModule) {
            case 'CxC':
                return <CxcModule />;
            case 'CxP':
                return <CxpModule />;
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
                            style={activeModule === 'CxC' ? styles.activeMenuItem : styles.menuItem}
                            onClick={() => setActiveModule('CxC')}
                        >
                            Cuentas x Cobrar
                        </div>
                        <div
                            style={activeModule === 'CxP' ? styles.activeMenuItem : styles.menuItem}
                            onClick={() => setActiveModule('CxP')}
                        >
                            Cuentas x Pagar
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