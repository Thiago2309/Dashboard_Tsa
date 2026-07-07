/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { classNames } from 'primereact/utils';
import React, { forwardRef, useContext, useImperativeHandle, useRef, useEffect, useState } from 'react';
import { AppTopbarRef } from '@/types';
import { LayoutContext } from './context/layoutcontext';
import { fetchUserData } from '../Services/BD/userService';
import { supabase } from '../Services/superbase.service';

const AppTopbar = forwardRef<AppTopbarRef>((props, ref) => {
    const { layoutConfig, layoutState, onMenuToggle, showProfileSidebar } = useContext(LayoutContext);
    const menubuttonRef = useRef(null);
    const topbarmenuRef = useRef(null);
    const topbarmenubuttonRef = useRef(null);
    
    const [user, setUser] = useState<{ nombre: string; apellido: string } | null>(null);

    useImperativeHandle(ref, () => ({
        menubutton: menubuttonRef.current,
        topbarmenu: topbarmenuRef.current,
        topbarmenubutton: topbarmenubuttonRef.current
    }));

    useEffect(() => {
        const authId = sessionStorage.getItem('authId');
        if (authId) {
            fetchUserData(authId).then((userData) => {
                if (userData) {
                    setUser({ nombre: userData.nombre, apellido: userData.apellido });
                }
            });
        }
    }, []);

    function logoutUser() {
        sessionStorage.clear(); // Borra sessionStorage
        localStorage.clear();   // Borra localStorage
        console.log("Sesión cerrada y almacenamiento limpiado.");
    }    

    const handleLogout = () => {
        logoutUser();
        window.location.href = '/'; // Redirigir al login
    };

    return (
        <div className="layout-topbar">
            <Link href="/" className="layout-topbar-logo layout-topbar-brand">
                <img src="/demo/images/blocks/logos/hyper.svg" alt="logo" height={50} className="mb-3" />
                <span className="layout-topbar-brand-text">Sistema TSA</span>
            </Link>

            <button ref={menubuttonRef} type="button" className="p-link layout-menu-button layout-topbar-button" onClick={onMenuToggle}>
                <i className="pi pi-bars" />
            </button>

            <button ref={topbarmenubuttonRef} type="button" className="p-link layout-topbar-menu-button layout-topbar-button" onClick={showProfileSidebar}>
                <i className="pi pi-ellipsis-v" />
            </button>

            <div className="layout-topbar-user">
                <span className="layout-topbar-user-text">Bienvenido {user ? `${user.nombre} ${user.apellido}` : ''}</span>
            </div>

            <div ref={topbarmenuRef} className={classNames('layout-topbar-menu', { 'layout-topbar-menu-mobile-active': layoutState.profileSidebarVisible })}>
                
                <button type="button" className="p-link layout-topbar-button">
                    <i className="pi pi-calendar"></i>
                    <span>Calendar</span>
                </button>
                {/* <button type="button" className="p-link layout-topbar-button">
                    <i className="pi pi-user"></i>
                    <span>Profile</span>
                </button> */}
                <button type="button" className="p-link layout-topbar-button" onClick={handleLogout}>
                    <i className="pi pi-sign-out"></i>
                    <span>Logout</span>
                </button>
                <Link href="/">
                    <button type="button" className="p-link layout-topbar-button">
                        <i className="pi pi-cog"></i>
                        <span>Settings</span>
                    </button>
                </Link>
            </div>
        </div>
    );
});

AppTopbar.displayName = 'AppTopbar';

export default AppTopbar;