"use client";

import React, { useState, useEffect, useRef } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Password } from 'primereact/password';
import { Button } from 'primereact/button';
import { InputSwitch } from 'primereact/inputswitch';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import {
    getConfiguracionFiscal,
    actualizarConfiguracionFiscal,
    hashPasswordFacturador,
    probarConexionFacturador
} from '../../../../Services/BD/facturacion/fiscalApiService';
import { REGIMENES_FISCALES_SAT } from '../../../../Services/BD/facturacion/catalogosSat';

const ambienteOptions = [
    { label: 'Pruebas (sandbox)', value: 'pruebas' },
    { label: 'Producción', value: 'produccion' }
];

// Identidad del contribuyente de pruebas que Facturador.com trae dado de
// alta en su ambiente sandbox (ver /docs/emision/o9kpke3rxn79c-autenticacion).
// Mientras se autentique con las credenciales demo, el Emisor de cada CFDI
// tiene que ser exactamente esta identidad — el SAT de certificación rechaza
// cualquier otra.
const DATOS_EMISOR_PRUEBA = {
    empresa_nombre: 'EMPRESA DEMOSTRACIÓN',
    rfc: 'GOYA780416GM0',
    regimen_fiscal: '612',
    calle: '',
    no_exterior: '',
    no_interior: '',
    colonia: '',
    localidad: '',
    municipio: 'Cancún',
    estado: '',
    pais: 'MEX',
    codigo_postal: '77500'
};

const emptyEmisor = {
    empresa_nombre: '',
    rfc: '',
    regimen_fiscal: '',
    calle: '',
    no_exterior: '',
    no_interior: '',
    colonia: '',
    localidad: '',
    municipio: '',
    estado: '',
    pais: 'MEX',
    codigo_postal: '',
    serie: '',
    folio_actual: 1
};

const ConfiguracionFiscal = () => {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [probando, setProbando] = useState(false);
    const [resultadoPrueba, setResultadoPrueba] = useState<{ success: boolean; mensaje: string } | null>(null);
    const [modoSimulacion, setModoSimulacion] = useState(true);
    const [emisor, setEmisor] = useState(emptyEmisor);
    const [rfcFacturador, setRfcFacturador] = useState('');
    const [passwordNuevo, setPasswordNuevo] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [ambiente, setAmbiente] = useState<'pruebas' | 'produccion'>('pruebas');
    const toast = useRef<Toast>(null);

    useEffect(() => {
        cargarConfiguracion();
    }, []);

    const cargarConfiguracion = async () => {
        try {
            const data = await getConfiguracionFiscal();
            setConfig(data);
            setModoSimulacion(data.modo_simulacion ?? true);
            setEmisor({
                empresa_nombre: data.empresa_nombre || '',
                rfc: data.rfc || '',
                regimen_fiscal: data.regimen_fiscal || '',
                calle: data.calle || '',
                no_exterior: data.no_exterior || '',
                no_interior: data.no_interior || '',
                colonia: data.colonia || '',
                localidad: data.localidad || '',
                municipio: data.municipio || '',
                estado: data.estado || '',
                pais: data.pais || 'MEX',
                codigo_postal: data.codigo_postal || '',
                serie: data.serie || '',
                folio_actual: data.folio_actual ?? 1
            });
            setRfcFacturador(data.facturador_rfc || '');
            setClientId(data.facturador_client_id || '');
            setClientSecret(data.facturador_client_secret || '');
            setAmbiente(data.facturador_ambiente || 'pruebas');
        } catch (error: any) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error',
                detail: error.message,
                life: 3000
            });
        }
    };

    const usarDatosDePrueba = () => {
        setEmisor((prev) => ({ ...prev, ...DATOS_EMISOR_PRUEBA }));
        setRfcFacturador(DATOS_EMISOR_PRUEBA.rfc);
        toast.current?.show({
            severity: 'info',
            summary: 'Datos de prueba cargados',
            detail: 'Revisa y da clic en "Guardar Configuración" para aplicarlos.',
            life: 4000
        });
    };

    const guardarConfiguracion = async () => {
        setLoading(true);
        setResultadoPrueba(null);
        try {
            await actualizarConfiguracionFiscal({
                empresa_nombre: emisor.empresa_nombre.trim(),
                rfc: emisor.rfc.trim().toUpperCase(),
                regimen_fiscal: emisor.regimen_fiscal,
                calle: emisor.calle.trim(),
                no_exterior: emisor.no_exterior.trim(),
                no_interior: emisor.no_interior.trim(),
                colonia: emisor.colonia.trim(),
                localidad: emisor.localidad.trim(),
                municipio: emisor.municipio.trim(),
                estado: emisor.estado.trim(),
                pais: emisor.pais.trim() || 'MEX',
                codigo_postal: emisor.codigo_postal.trim(),
                serie: emisor.serie.trim(),
                folio_actual: emisor.folio_actual,
                modo_simulacion: modoSimulacion,
                facturador_rfc: rfcFacturador.trim().toUpperCase(),
                // Solo se sobrescribe el password si se capturó uno nuevo, para
                // no perder el ya guardado con solo entrar a esta pantalla.
                ...(passwordNuevo ? { facturador_password_md5: hashPasswordFacturador(passwordNuevo) } : {}),
                facturador_client_id: clientId.trim(),
                facturador_client_secret: clientSecret.trim(),
                facturador_ambiente: ambiente,
                // Si cambia cualquier credencial, hay que volver a resolver el
                // emisorId (puede corresponder a otra cuenta).
                facturador_emisor_id: null
            });
            setPasswordNuevo('');
            toast.current?.show({
                severity: 'success',
                summary: 'Configuración guardada',
                detail: 'Datos del emisor y credenciales de Facturador.com actualizados',
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

    const probarConexion = async () => {
        setProbando(true);
        setResultadoPrueba(null);
        try {
            const resultado = await probarConexionFacturador();
            if (resultado.success) {
                setResultadoPrueba({ success: true, mensaje: `Conexión exitosa. EmisorId: ${resultado.emisorId}` });
            } else {
                setResultadoPrueba({ success: false, mensaje: resultado.error || 'Error desconocido' });
            }
        } finally {
            setProbando(false);
        }
    };

    if (!config) return <div>Cargando configuración...</div>;

    return (
        <div>
            <Toast ref={toast} />
            <div className="flex justify-content-between align-items-center flex-wrap gap-2">
                <h3 className="m-0">Configuración Fiscal</h3>
                {ambiente === 'pruebas' && (
                    <Button label="Usar datos del emisor de prueba (demo SAT)" icon="pi pi-bolt" size="small" outlined onClick={usarDatosDePrueba} />
                )}
            </div>

            <div className="grid">
                <div className="col-12">
                    <h4 className="mb-0">Datos del Emisor</h4>
                    <small className="text-gray-500">
                        En ambiente de <strong>pruebas</strong> con credenciales demo, deben coincidir exactamente con el contribuyente de prueba de
                        Facturador.com (usa el botón de arriba). En <strong>producción</strong>, deben ser los datos reales de tu empresa.
                    </small>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>Empresa</label>
                        <InputText value={emisor.empresa_nombre} onChange={(e) => setEmisor({ ...emisor, empresa_nombre: e.target.value })} className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>RFC</label>
                        <InputText value={emisor.rfc} onChange={(e) => setEmisor({ ...emisor, rfc: e.target.value })} className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>Régimen Fiscal</label>
                        <Dropdown
                            value={emisor.regimen_fiscal}
                            options={REGIMENES_FISCALES_SAT}
                            onChange={(e) => setEmisor({ ...emisor, regimen_fiscal: e.value })}
                            placeholder="Seleccione régimen fiscal"
                            filter
                            className="w-full"
                        />
                    </div>
                </div>
                <div className="col-12 md:col-3">
                    <div className="field">
                        <label>Serie</label>
                        <InputText value={emisor.serie} onChange={(e) => setEmisor({ ...emisor, serie: e.target.value })} className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-3">
                    <div className="field">
                        <label>Folio Actual</label>
                        <InputNumber value={emisor.folio_actual} onValueChange={(e) => setEmisor({ ...emisor, folio_actual: e.value ?? 1 })} useGrouping={false} className="w-full" />
                    </div>
                </div>

                <div className="col-12">
                    <h5 className="mb-0">Domicilio Fiscal (LugarExpedicion)</h5>
                </div>
                <div className="col-12 md:col-4">
                    <div className="field">
                        <label>Calle</label>
                        <InputText value={emisor.calle} onChange={(e) => setEmisor({ ...emisor, calle: e.target.value })} className="w-full" />
                    </div>
                </div>
                <div className="col-6 md:col-2">
                    <div className="field">
                        <label>No. Exterior</label>
                        <InputText value={emisor.no_exterior} onChange={(e) => setEmisor({ ...emisor, no_exterior: e.target.value })} className="w-full" />
                    </div>
                </div>
                <div className="col-6 md:col-2">
                    <div className="field">
                        <label>No. Interior</label>
                        <InputText value={emisor.no_interior} onChange={(e) => setEmisor({ ...emisor, no_interior: e.target.value })} className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-4">
                    <div className="field">
                        <label>Colonia</label>
                        <InputText value={emisor.colonia} onChange={(e) => setEmisor({ ...emisor, colonia: e.target.value })} className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-3">
                    <div className="field">
                        <label>Municipio</label>
                        <InputText value={emisor.municipio} onChange={(e) => setEmisor({ ...emisor, municipio: e.target.value })} className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-3">
                    <div className="field">
                        <label>Estado</label>
                        <InputText value={emisor.estado} onChange={(e) => setEmisor({ ...emisor, estado: e.target.value })} className="w-full" />
                    </div>
                </div>
                <div className="col-6 md:col-3">
                    <div className="field">
                        <label>País</label>
                        <InputText value={emisor.pais} onChange={(e) => setEmisor({ ...emisor, pais: e.target.value })} className="w-full" />
                    </div>
                </div>
                <div className="col-6 md:col-3">
                    <div className="field">
                        <label>Código Postal</label>
                        <InputText value={emisor.codigo_postal} maxLength={5} keyfilter="pnum" onChange={(e) => setEmisor({ ...emisor, codigo_postal: e.target.value })} className="w-full" />
                        <small className="text-500">Debe ser un CP real y válido del catálogo del SAT (c_CodigoPostal).</small>
                    </div>
                </div>

                <div className="col-12">
                    <hr />
                    <h4 className="mt-0">Credenciales de Facturador.com</h4>
                    <small className="text-gray-500">
                        Datos de tu cuenta en apidocs.facturador.com. El password nunca se guarda en texto plano, solo su hash.
                    </small>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>RFC (usuario de Facturador.com)</label>
                        <InputText
                            value={rfcFacturador}
                            onChange={(e) => setRfcFacturador(e.target.value)}
                            placeholder="Ej. GOYA780416GM0"
                            className="w-full"
                        />
                    </div>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>Password</label>
                        <Password
                            value={passwordNuevo}
                            onChange={(e) => setPasswordNuevo(e.target.value)}
                            placeholder={config.facturador_password_md5 ? 'Ya configurado (dejar vacío para no cambiar)' : 'Ingresa tu password'}
                            toggleMask
                            feedback={false}
                            className="w-full"
                            inputClassName="w-full"
                        />
                    </div>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>Client ID</label>
                        <InputText value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>Client Secret</label>
                        <InputText value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>Ambiente</label>
                        <Dropdown value={ambiente} options={ambienteOptions} onChange={(e) => setAmbiente(e.value)} className="w-full" />
                    </div>
                </div>
                <div className="col-12 md:col-6">
                    <div className="field">
                        <label>Emisor ID (se obtiene automático)</label>
                        <InputText value={config.facturador_emisor_id?.toString() || 'Aún no resuelto'} disabled className="w-full" />
                    </div>
                </div>
                <div className="col-12">
                    <div className="field flex align-items-center gap-3">
                        <InputSwitch checked={modoSimulacion} onChange={(e) => setModoSimulacion(e.value)} />
                        <div>
                            <label className="block font-medium">Modo simulación</label>
                            <small className="text-gray-500">
                                Activado: aprobar una factura genera un timbrado simulado (sin llamar a Facturador.com).
                                Desactívalo cuando quieras timbrar de verdad con las credenciales de arriba.
                            </small>
                        </div>
                    </div>
                </div>
                <div className="col-12">
                    <div className="flex align-items-center gap-3">
                        <Button label="Probar conexión" icon="pi pi-bolt" outlined onClick={probarConexion} loading={probando} />
                        {resultadoPrueba && (
                            <Tag severity={resultadoPrueba.success ? 'success' : 'danger'} value={resultadoPrueba.mensaje} />
                        )}
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
