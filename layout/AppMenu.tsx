/* eslint-disable @next/next/no-img-element */

import React, { useContext } from 'react';
import AppMenuitem from './AppMenuitem';
import { LayoutContext } from './context/layoutcontext';
import { MenuProvider } from './context/menucontext';
import Link from 'next/link';
import { AppMenuItem } from '@/types';
import { getUserRoleIdFromLocalStorage } from '@/Services/BD/userService';

// Definición de roles para mejor legibilidad
const ROLES = {
    ADMIN: 1,
    EMPLEADO: 2,
    ALMACEN: 4,
    LOGISTICA: 5
} as const;

const AppMenu = () => {
    const { layoutConfig } = useContext(LayoutContext);
    const userRoleId = getUserRoleIdFromLocalStorage();
    console.log('userRoleId', userRoleId);
    
    // Definir permisos basados en roles
    const esAdmin = userRoleId === ROLES.ADMIN;
    const isAlmacen = userRoleId === ROLES.ALMACEN;
    const isEmpleado = userRoleId === ROLES.EMPLEADO;
    const isLogistica = userRoleId === ROLES.LOGISTICA;
    
    // ADMIN ve TODO, los demás roles solo lo que les corresponde
    const puedeVerTodo = esAdmin;
    console.log('esAdmin', esAdmin);

    // Determinar qué secciones mostrar según el rol (Admin ve todo)
    const puedeVerGestion = puedeVerTodo || (!isEmpleado && !isLogistica);
    const puedeVerMantenimiento = puedeVerTodo || (isAlmacen || (esAdmin && !isLogistica));
    const puedeVerAdminViajes = puedeVerTodo || esAdmin;
    const puedeVerLogistica = puedeVerTodo || isLogistica;

    const model: AppMenuItem[] = [
        // ========== SECCIÓN HOME ==========
        // Visible para: TODOS
        {
            label: 'Home',
            items: [{ label: 'Dashboard', icon: 'pi pi-fw pi-home', to: '/' }]
        },

        // ========== SECCIÓN GESTION ==========
        // Visible para: Admin, Almacen (NO para Empleado ni Logistica)
        ...(puedeVerGestion ? [
            {
                label: 'Gestion',
                items: [
                    { label: 'Rastreo GPS', icon: 'pi pi-fw pi-map-marker', to: '/utilities/gps' },
                    { label: 'Notas', icon: 'pi pi-book', to: '/utilities/icons' },
                ]
            },
            {
                label: 'RRHH',
                items: [
                    { label: 'Empleados', icon: 'pi pi-users', to: '/uikit/RH' },
                    { label: 'Vacaciones', icon: 'pi pi-calendar', to: '/uikit/RH/Vacaciones' },
                ]
            },
        ] : []),

        // ========== SECCIÓN MANTENIMIENTO ==========
        // Visible para: Admin, Almacen (NO para Logistica)
        ...(puedeVerMantenimiento ? [
            {
                label: 'Mantenimiento',
                items: [
                    { label: 'Inventario', icon: 'pi pi-fw pi-box', to: '/inventario' },
                    { label: 'Taller', icon: 'pi pi-fw pi-wrench', to: '/pages/empty' }
                ]
            },
        ] : []),

        // ========== SECCIÓN ADMINISTRACIÓN ==========
        // Visible para: Admin (viajes y administración), Logistica (solo su sección)
        {
            label: 'Administración',
            items: [
                // Sub-sección Admin de Viajes - Solo para ADMIN
                ...(puedeVerAdminViajes ? [
                    {
                        label: 'Admin. de Viajes',
                        icon: 'pi pi-fw pi-truck',
                        items: [
                            { label: 'Viajes', icon: 'pi pi-fw pi-truck', to: '/uikit/formlayout' },
                            { label: 'Resumen', icon: 'pi pi-fw pi-file', to: '/uikit/input' },
                            { label: 'Nomina', icon: 'pi pi-fw pi-user', to: '/uikit/floatlabel' },
                            { label: 'Facturación', icon: 'pi pi-fw pi-mobile', to: '/uikit/facturacion', class: 'rotated-icon' },
                            { label: 'Estimaciones', icon: 'pi pi-fw pi-calculator', to: '/uikit/formlayout/estimaciones' },
                        ]
                    },
                ] : []),

                // Sub-sección Admin de Logistica - Solo para LOGISTICA
                ...(puedeVerLogistica ? [
                    { 
                        label: 'Admin. de Logistica', 
                        icon: 'pi pi-fw pi-pencil', 
                        to: '/uikit/logistica' 
                    },
                ] : []),

                // NOTA: Las siguientes opciones están comentadas para referencia futura
                // { label: 'Table', icon: 'pi pi-fw pi-table', to: '/uikit/table' },
                // { label: 'List', icon: 'pi pi-fw pi-list', to: '/uikit/list' },
                // { label: 'Tree', icon: 'pi pi-fw pi-share-alt', to: '/uikit/tree' },
                // { label: 'Panel', icon: 'pi pi-fw pi-tablet', to: '/uikit/panel' },
                // { label: 'Overlay', icon: 'pi pi-fw pi-clone', to: '/uikit/overlay' },
                // { label: 'Media', icon: 'pi pi-fw pi-image', to: '/uikit/media' },
                // { label: 'Menu', icon: 'pi pi-fw pi-bars', to: '/uikit/menu', preventExact: true },
                // { label: 'Message', icon: 'pi pi-fw pi-comment', to: '/uikit/message' },
                // { label: 'File', icon: 'pi pi-fw pi-file', to: '/uikit/file' },
                // { label: 'Chart', icon: 'pi pi-fw pi-chart-bar', to: '/uikit/charts' },
                // { label: 'Misc', icon: 'pi pi-fw pi-circle', to: '/uikit/misc' }
            ]
        }

        // ========== OTRAS SECCIONES COMENTADAS ==========
        // {
        //     label: 'Utilities',
        //     items: [
        //         { label: 'PrimeIcons', icon: 'pi pi-fw pi-prime', to: '/utilities/icons' },
        //         { label: 'PrimeFlex', icon: 'pi pi-fw pi-desktop', url: 'https://primeflex.org/', target: '_blank' }
        //     ]
        // },
        // {
        //     label: 'Pages',
        //     icon: 'pi pi-fw pi-briefcase',
        //     to: '/pages',
        //     items: [
        //         {
        //             label: 'Landing',
        //             icon: 'pi pi-fw pi-globe',
        //             to: '/landing'
        //         },
        //         {
        //             label: 'Auth',
        //             icon: 'pi pi-fw pi-user',
        //             items: [
        //                 {
        //                     label: 'Login',
        //                     icon: 'pi pi-fw pi-sign-in',
        //                     to: '/auth/login'
        //                 },
        //                 {
        //                     label: 'Error',
        //                     icon: 'pi pi-fw pi-times-circle',
        //                     to: '/auth/error'
        //                 },
        //                 {
        //                     label: 'Access Denied',
        //                     icon: 'pi pi-fw pi-lock',
        //                     to: '/auth/access'
        //                 }
        //             ]
        //         },
        //         {
        //             label: 'Crud',
        //             icon: 'pi pi-fw pi-pencil',
        //             to: '/pages/crud'
        //         },
        //         {
        //             label: 'Timeline',
        //             icon: 'pi pi-fw pi-calendar',
        //             to: '/pages/timeline'
        //         },
        //         {
        //             label: 'Not Found',
        //             icon: 'pi pi-fw pi-exclamation-circle',
        //             to: '/pages/notfound'
        //         },
        //         {
        //             label: 'Empty',
        //             icon: 'pi pi-fw pi-circle-off',
        //             to: '/pages/empty'
        //         }
        //     ]
        // },
        // {
        //     label: 'Hierarchy',
        //     items: [
        //         {
        //             label: 'Submenu 1',
        //             icon: 'pi pi-fw pi-bookmark',
        //             items: [
        //                 {
        //                     label: 'Submenu 1.1',
        //                     icon: 'pi pi-fw pi-bookmark',
        //                     items: [
        //                         { label: 'Submenu 1.1.1', icon: 'pi pi-fw pi-bookmark' },
        //                         { label: 'Submenu 1.1.2', icon: 'pi pi-fw pi-bookmark' },
        //                         { label: 'Submenu 1.1.3', icon: 'pi pi-fw pi-bookmark' }
        //                     ]
        //                 },
        //                 {
        //                     label: 'Submenu 1.2',
        //                     icon: 'pi pi-fw pi-bookmark',
        //                     items: [{ label: 'Submenu 1.2.1', icon: 'pi pi-fw pi-bookmark' }]
        //                 }
        //             ]
        //         },
        //         {
        //             label: 'Submenu 2',
        //             icon: 'pi pi-fw pi-bookmark',
        //             items: [
        //                 {
        //                     label: 'Submenu 2.1',
        //                     icon: 'pi pi-fw pi-bookmark',
        //                     items: [
        //                         { label: 'Submenu 2.1.1', icon: 'pi pi-fw pi-bookmark' },
        //                         { label: 'Submenu 2.1.2', icon: 'pi pi-fw pi-bookmark' }
        //                     ]
        //                 },
        //                 {
        //                     label: 'Submenu 2.2',
        //                     icon: 'pi pi-fw pi-bookmark',
        //                     items: [{ label: 'Submenu 2.2.1', icon: 'pi pi-fw pi-bookmark' }]
        //                 }
        //             ]
        //         }
        //     ]
        // },
        // {
        //     label: 'Get Started',
        //     items: [
        //         {
        //             label: 'Documentation',
        //             icon: 'pi pi-fw pi-question',
        //             to: '/documentation'
        //         },
        //         {
        //             label: 'Figma',
        //             url: 'https://www.dropbox.com/scl/fi/bhfwymnk8wu0g5530ceas/sakai-2023.fig?rlkey=u0c8n6xgn44db9t4zkd1brr3l&dl=0',
        //             icon: 'pi pi-fw pi-pencil',
        //             target: '_blank'
        //         },
        //         {
        //             label: 'View Source',
        //             icon: 'pi pi-fw pi-search',
        //             url: 'https://github.com/primefaces/sakai-react',
        //             target: '_blank'
        //         }
        //     ]
        // }
    ];

    return (
        <MenuProvider>
            <ul className="layout-menu">
                {model.map((item, i) => {
                    return !item?.seperator ? <AppMenuitem item={item} root={true} index={i} key={item.label} /> : <li className="menu-separator"></li>;
                })}

                {/* <Link href="https://blocks.primereact.org" target="_blank" style={{ cursor: 'pointer' }}>
                    <img alt="Prime Blocks" className="w-full mt-3" src={`/layout/images/banner-primeblocks${layoutConfig.colorScheme === 'light' ? '' : '-dark'}.png`} />
                </Link> */}
            </ul>
        </MenuProvider>
    );
};

export default AppMenu;