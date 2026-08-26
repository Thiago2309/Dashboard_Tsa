'use client';

import React, { useState } from 'react';
import InventarioModule from './vistas/page';
import OrdenesTrabajoModule from './ordenes/OrdenesTrabajoModule';

const TableModule = () => {
    const [activeModule, setActiveModule] = useState('Inventario');

    const renderModule = () => {
        switch (activeModule) {
            case 'Inventario':
                return <InventarioModule />;
            case 'Orden de Trabajo':
                return <OrdenesTrabajoModule />;
            default:
                return <div>Selecciona un módulo</div>;
        }
    };

    return (
        <div className="grid">
            <div className='col-12'>
                <div className="card">
                    <div style={styles.menu}>
                        <div
                            style={activeModule === 'Inventario' ? styles.activeMenuItem : styles.menuItem}
                            onClick={() => setActiveModule('Inventario')}
                        >
                            Inventario
                        </div>
                        <div
                            style={activeModule === 'Orden de Trabajo' ? styles.activeMenuItem : styles.menuItem}
                            onClick={() => setActiveModule('Orden de Trabajo')}
                        >
                            Orden de Trabajo
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
    tableContainer: {
        marginTop: '20px',
    },
};

export default TableModule;
