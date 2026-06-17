"use client";

import React, { useState, useEffect, useRef } from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { getConfiguracionFiscal, actualizarConfiguracionFiscal } from '../../../../Services/BD/facturacion/fiscalApiService';

const ConfiguracionFiscal = () => {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const toast = useRef<Toast>(null);

    useEffect(() => {
        cargarConfiguracion();
    }, []);

    const cargarConfiguracion = async () => {
        try {
            const data = await getConfiguracionFiscal();
            setConfig(data);
            setApiKey(data.api_key || '');
        } catch (error: any) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: error.message,
                life: 3000
            });
        }
    };

    const guardarConfiguracion = async () => {
        setLoading(true);
        try {
            await actualizarConfiguracionFiscal({ api_key: apiKey });
            toast.current?.show({
                severity: 'success',
                summary: 'Configuración guardada',
                detail: 'API Key actualizada correctamente',
                life: 3000
            });
            await cargarConfiguracion();
        } catch (error: any) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: error.message,
                life: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    if (!config) return <div>Cargando configuración...</div>;

    return (
        <div>
            <Toast ref={toast} />
            <h3>Configuración Fiscal</h3>
            
            <div className="grid">
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>Empresa</label>
                        <InputText value={config.empresa_nombre} disabled className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>RFC</label>
                        <InputText value={config.rfc} disabled className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>Régimen Fiscal</label>
                        <InputText value={config.regimen_fiscal} disabled className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>Serie</label>
                        <InputText value={config.serie} disabled className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>Folio Actual</label>
                        <InputText value={config.folio_actual?.toString()} disabled className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>API Key (FiscalAPI)</label>
                        <InputText 
                            value={apiKey} 
                            onChange={(e) => setApiKey(e.target.value)} 
                            placeholder="Ingresa tu API Key de FiscalAPI"
                            className="w-full"
                        />
                        <small className="text-gray-500">
                            Obtén tu API Key en https://fiscalapi.com/dashboard
                        </small>
                    </div>
                </div>
                <div className="col-12">
                    <Button 
                        label="Guardar Configuración" 
                        icon="pi pi-save" 
                        onClick={guardarConfiguracion}
                        loading={loading}
                    />
                </div>
            </div>
        </div>
    );
};

export default ConfiguracionFiscal;