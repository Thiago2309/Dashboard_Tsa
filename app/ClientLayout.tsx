'use client';
import { LayoutProvider } from '../layout/context/layoutcontext';
import { PrimeReactProvider } from 'primereact/api';
import LoginPage from './(full-page)/auth/login/page';
import { useEffect, useState } from 'react';
import { getsession } from '@/Services/BD/userService';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // login() ya guarda 'userData' en localStorage al autenticar (Services/BD/userService.ts),
        // y el resto de la app (AppMenu, etc.) confía en ese dato sin esperar red. Antes, esta
        // pantalla bloqueaba TODA la app detrás de getSession() -una llamada de red a Supabase
        // Auth- incluso para usuarios ya logueados; si ese endpoint se pone lento (se ha visto
        // tardar varios minutos), la app entera se quedaba en el spinner. Ahora, si ya hay sesión
        // guardada localmente se entra de inmediato, y getSession() solo corre en segundo plano
        // para detectar sesiones realmente inválidas y mandar a login en ese caso.
        const sesionLocal = typeof window !== 'undefined' && !!localStorage.getItem('userData');
        if (sesionLocal) {
            setIsAuthenticated(true);
            setIsLoading(false);
        }

        getsession().then((session) => {
            if (!sesionLocal) {
                setIsAuthenticated(!!session);
                setIsLoading(false);
            } else if (!session) {
                localStorage.removeItem('userData');
                setIsAuthenticated(false);
            }
        });
    }, []);

    if (isLoading) {
        return (
            <div className="flex align-items-center justify-content-center" style={{ height: '100vh' }}>
                <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }}></i>
            </div>
        );
    }

    return (
        <PrimeReactProvider>
            <LayoutProvider>{isAuthenticated ? children : <LoginPage />}</LayoutProvider>
        </PrimeReactProvider>
    );
}
