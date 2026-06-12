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
        getsession().then((session) => {
            setIsAuthenticated(!!session);
            setIsLoading(false);
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
