"use client";
import { useRouter } from 'next/navigation'; // Importar correctamente
import React, { useState, useRef } from 'react';
import { Checkbox } from 'primereact/checkbox';
import { Button } from 'primereact/button';
import { Password } from 'primereact/password';
import { InputText } from 'primereact/inputtext';
import { login, register, fetchUserData } from '../../../../Services/BD/userService';
import { Toast } from 'primereact/toast';

const LoginPage = () => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nombre, setNombre] = useState('');
    const [apellido, setApellido] = useState('');
    const [ciudad, setCiudad] = useState('');
    const [sueldo, setSueldo] = useState('');
    const [checked, setChecked] = useState(false);
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const toast = useRef<Toast | null>(null);

    const validateEmail = (value: string) => {
        const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\\.,;:\s@\"]+\.)+[^<>()[\]\\.,;:\s@\"]{2,})$/i;
        return re.test(String(value).toLowerCase());
    };

    const handleSubmit = async () => {
        if (isLoading) return;

        // reset errors
        setEmailError('');
        setPasswordError('');

        // client-side validation porque no usamos <form>
        let hasError = false;
        if (!email || email.trim() === '') {
            setEmailError('El email es obligatorio');
            hasError = true;
        } else if (!validateEmail(email)) {
            setEmailError('El email no es válido');
            hasError = true;
        }

        if (!password || password.trim() === '') {
            setPasswordError('La contraseña es obligatoria');
            hasError = true;
        }

        if (hasError) {
            toast.current?.show({ severity: 'error', summary: 'Errores en el formulario', detail: 'Corrige los campos marcados', life: 5000 });
            return;
        }

        setIsLoading(true);

        try {
            if (isRegistering) {
                const sueldoNumber = parseFloat(sueldo);
                if (isNaN(sueldoNumber)) {
                    toast.current?.show({ severity: 'error', summary: 'Sueldo inválido', detail: 'El sueldo debe ser un número válido', life: 5000 });
                    return;
                }

                const user = await register(email, password, { nombre, apellido, ciudad, sueldo: sueldoNumber, pass: password });
                if (user) {
                    toast.current?.show({ severity: 'success', summary: 'Registro', detail: '¡Registro exitoso! Por favor inicia sesión', life: 4000 });
                    setIsRegistering(false);
                }
            } else {
                const user = await login(email, password);
                if (user) {
                    const userData = await fetchUserData(user.id);
                    if (userData) {
                        console.log('Datos del usuario:', userData);
                        window.location.href = '/';
                    } else {
                        toast.current?.show({ severity: 'warn', summary: 'Atención', detail: 'No se encontraron datos adicionales del usuario.', life: 5000 });
                    }
                }
            }
        } catch (error: any) {
            if (error.message.includes("over_email_send_rate_limit")) {
                const waitTime = error.message.match(/\d+/)[0];
                toast.current?.show({ severity: 'error', summary: 'Límite alcanzado', detail: `Has enviado demasiadas solicitudes. Espera ${waitTime}s.`, life: 7000 });
            } else {
                toast.current?.show({ severity: 'error', summary: 'Error', detail: error.message || 'Ocurrió un error', life: 7000 });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-column align-items-center justify-content-center min-h-screen bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=2071&auto=format')", backgroundColor: '#0a2b3e' }}>
            {/* Contenedor principal estilo NetApp ONTAP */}
            <div className="w-full max-w-25rem">
                {/* Logo de la empresa de volquetes y materiales */}
                <div className="flex justify-content-center mb-4">
                    {/* <div className="text-center">
                        <div className="text-white text-4xl font-bold tracking-wide">VOLQUETES</div>
                        <div className="text-white text-sm opacity-80">Materiales y Transporte</div>
                    </div> */}
                </div>

                {/* Card de login estilo System Manager */}
                <div className="bg-white bg-opacity-95 border-round-xl shadow-4 overflow-hidden">
                    {/* Barra superior estilo ONTAP */}
                        {/* <div className="bg-primary p-3 flex justify-content-between align-items-center">
                            <span className="text-white font-semibold text-lg">ONTAP System Manager</span>
                            <div className="flex gap-3">
                                <span className="text-white text-sm opacity-80 cursor-pointer hover:opacity-100 transition-opacity">NetApp Support</span>
                                <span className="text-white text-sm opacity-80 cursor-pointer hover:opacity-100 transition-opacity">|</span>
                                <span className="text-white text-sm opacity-80 cursor-pointer hover:opacity-100 transition-opacity">NetApp</span>
                            </div>
                        </div> */}

                    {/* Contenido del login */}
                    <div className="p-5">
                        <Toast ref={toast} />
                        <div className="text-center mb-4">
                                            {/* <div className="text-900 text-2xl font-medium mb-2">
                                                {isRegistering ? 'Crear cuenta' : 'admin'}
                                            </div> */}
                            <div className="text-600 text-sm">
                                {isRegistering ? 'Complete los datos para registrarse' : 'Inicie sesión para continuar'}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="email1" className="block text-700 text-sm font-medium mb-2 required">Email</label>
                            <InputText 
                                id="email1" 
                                type="email" 
                                value={email} 
                                required    
                                onChange={(e) => setEmail(e.target.value)} 
                                placeholder="usuario@empresa.com" 
                                className="w-full mb-4 p-3 border-300 border-round-md"
                            />
                            {emailError && <small className="text-red-600 text-sm mb-3 block">{emailError}</small>}

                            <label htmlFor="password1" className="block text-700 text-sm font-medium mb-2 required">Password</label>
                            <Password 
                                inputId="password1" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                placeholder="Contraseña" 
                                toggleMask 
                                required
                                className="w-full mb-4"
                                inputClassName="w-full p-3"
                                feedback={false}
                            />
                            {passwordError && <small className="text-red-600 text-sm mb-3 block">{passwordError}</small>}

                            {isRegistering && (
                                <>
                                    <label htmlFor="nombre" className="block text-700 text-sm font-medium mb-2">Nombre</label>
                                    <InputText 
                                        id="nombre" 
                                        value={nombre} 
                                        onChange={(e) => setNombre(e.target.value)} 
                                        className="w-full mb-4 p-3 border-300 border-round-md"
                                        placeholder="Ingrese su nombre"
                                    />

                                    <label htmlFor="apellido" className="block text-700 text-sm font-medium mb-2">Apellido</label>
                                    <InputText 
                                        id="apellido" 
                                        value={apellido} 
                                        onChange={(e) => setApellido(e.target.value)} 
                                        className="w-full mb-4 p-3 border-300 border-round-md"
                                        placeholder="Ingrese su apellido"
                                    />

                                    <label htmlFor="ciudad" className="block text-700 text-sm font-medium mb-2">Ciudad</label>
                                    <InputText 
                                        id="ciudad" 
                                        value={ciudad} 
                                        onChange={(e) => setCiudad(e.target.value)} 
                                        className="w-full mb-4 p-3 border-300 border-round-md"
                                        placeholder="Ciudad de operación"
                                    />

                                    <label htmlFor="sueldo" className="block text-700 text-sm font-medium mb-2">Sueldo</label>
                                    <InputText 
                                        id="sueldo" 
                                        type="text"
                                        value={sueldo} 
                                        onChange={(e) => setSueldo(e.target.value)} 
                                        className="w-full mb-4 p-3 border-300 border-round-md"
                                        placeholder="0.00"
                                    />
                                </>
                            )}

                            <div className="flex align-items-center justify-content-between mb-5">
                                <div className="flex align-items-center">
                                    <Checkbox 
                                        inputId="rememberme1" 
                                        checked={checked} 
                                        onChange={(e) => setChecked(e.checked ?? false)} 
                                        className="mr-2"
                                    />
                                    <label htmlFor="rememberme1" className="text-600 text-sm">Recuérdame</label>
                                </div>
                            </div>

                            <Button 
                                label={isRegistering ? "Registrarse" : "Iniciar Sesión"} 
                                className="w-full p-3 text-base font-semibold bg-primary border-none"
                                onClick={handleSubmit}
                                loading={isLoading}
                                disabled={isLoading || !email.trim() || !password.trim()}
                            />

                            {/* Comentado como solicitaste */}
                            {/* <div className="mt-3 text-center">
                                <span className="text-600 cursor-pointer text-sm" onClick={() => setIsRegistering(!isRegistering)}>
                                    {isRegistering 
                                        ? '¿Ya tienes cuenta? Inicia sesión' 
                                        : '¿No tienes cuenta? Regístrate'}
                                </span>
                            </div> */}
                        </div>
                    </div>

                    {/* Footer estilo NetApp */}
                    <div className="bg-gray-50 p-2 text-center border-top-1 border-200">
                        <span className="text-500 text-xs">© 2026 Sistema Tsa</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;