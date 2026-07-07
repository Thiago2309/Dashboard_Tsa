// Services/BD/operadoresService.ts
import { supabase } from '../superbase.service';
import { register, asignarRol } from './userService';

export interface Operador {
    id?: number;
    nombre: string;
    puesto: string;
    salario_base: number;
    estatus: boolean;
    descripcion?: string;
    telefono?: string;
    direccion?: string;
    fecha_contratacion?: string;
    acceso_sistema?: boolean;
    email?: string;
    pass?: string;
    user_id?: number | null;
    rol_id?: number | null;
    camion_full?: boolean;
}

export const fetchOperadores = async (): Promise<Operador[]> => {
    const { data, error } = await supabase
        .from('operador')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        console.error('Error fetching operadores:', error);
        throw error;
    }

    const operadores: any[] = data || [];

    // Si hay operadores vinculados a user_id, traer email y password desde la tabla 'user'
    const userIds = Array.from(new Set(operadores.map(o => o.user_id).filter(Boolean)));

    if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
            .from('user')
            .select('id, email, pass')
            .in('id', userIds as any[]);

        if (usersError) {
            console.error('Error fetching users for operadores:', usersError);
        }

        const usersMap = new Map<number, any>();
        (users || []).forEach((u: any) => usersMap.set(u.id, u));

        return operadores.map(op => ({
            ...op,
            email: op.user_id ? usersMap.get(op.user_id)?.email ?? op.email : op.email,
            password: op.user_id ? usersMap.get(op.user_id)?.pass ?? op.pass ?? op.password : op.password
        }));
    }

    return operadores;
};


export const fetchRoles = async (): Promise<{ id: number; nombre: string; descripcion: string }[]> => {
    const { data, error } = await supabase
        .from('rol')
        .select('id, nombre, descripcion')
        .order('nombre');

    if (error) {
        console.error('Error fetching roles:', error);
        throw error;
    }

    return data || [];
};

export const createOperador = async (operador: Omit<Operador, 'id'>): Promise<Operador> => {
    try {
        // 1. Crear el operador en la tabla operador
        const { data: operadorData, error: operadorError } = await supabase
            .from('operador')
            .insert([{
                nombre: operador.nombre,
                puesto: operador.puesto,
                salario_base: operador.salario_base,
                estatus: operador.estatus,
                descripcion: operador.descripcion,
                telefono: operador.telefono,
                direccion: operador.direccion,
                fecha_contratacion: operador.fecha_contratacion,
                acceso_sistema: operador.acceso_sistema || false,
                rol_id: operador.rol_id || null,
                camion_full: operador.camion_full || false
            }])
            .select()
            .single();

        if (operadorError) {
            console.error('Error creating operador:', operadorError);
            throw operadorError;
        }

        // 2. Si el operador tiene acceso al sistema, crear usuario
        if (operador.acceso_sistema && operador.email && operador.pass) {
            try {
                const userData = {
                    nombre: operador.nombre.split(' ')[0] || '',
                    apellido: operador.nombre.split(' ').slice(1).join(' ') || '',
                    ciudad: operador.direccion || '-',
                    sueldo: operador.salario_base || 0
                };

                const result = await register(operador.email, operador.pass, userData, operador.rol_id || undefined);
                
                if (result) {
                    console.log(`✅ Usuario creado/vinculado con email: ${operador.email}`);
                    
                    // 3. Obtener el user_id del usuario recién creado
                    const { data: userDataResult, error: userError } = await supabase
                        .from('user')
                        .select('id')
                        .eq('email', operador.email)
                        .maybeSingle();

                    if (userError) {
                        console.error('Error obteniendo user_id:', userError);
                    } else if (userDataResult) {
                        // 4. Actualizar el operador con el user_id
                        const { error: updateError } = await supabase
                            .from('operador')
                            .update({ user_id: userDataResult.id })
                            .eq('id', operadorData.id);

                        if (updateError) {
                            console.error('Error actualizando operador con user_id:', updateError);
                        } else {
                            console.log(`✅ Operador vinculado con user_id: ${userDataResult.id}`);
                            // Actualizar el objeto operadorData con el user_id
                            operadorData.user_id = userDataResult.id;
                        }
                    }
                } else {
                    console.warn('⚠️ Operador creado pero falló la creación del usuario');
                }
            } catch (authError) {
                console.error('❌ Error creating user for operador:', authError);
            }
        }

        return operadorData;
    } catch (error) {
        console.error('❌ Error in createOperador:', error);
        throw error;
    }
};

export const updateOperador = async (operador: Operador): Promise<Operador> => {
    // 1. Obtener el operador actual (sin su email, email está en la tabla 'user')
    const { data: operadorActual, error: fetchError } = await supabase
        .from('operador')
        .select('acceso_sistema, user_id')
        .eq('id', operador.id)
        .single();

    if (fetchError) {
        console.error('Error obteniendo operador actual:', fetchError);
        throw fetchError;
    }

    let userId: number | undefined | null = operadorActual?.user_id;

    // 2. Si se proporcionó email y el operador debe tener acceso, actualizar/crear el user correspondiente
    if (operador.acceso_sistema && operador.email) {
        try {
            // Si no hay user_id, intentar buscar por email existente
            if (!userId) {
                const { data: foundUser } = await supabase
                    .from('user')
                    .select('id')
                    .eq('email', operador.email)
                    .maybeSingle();

                if (foundUser) {
                    userId = foundUser.id;
                    // vincularlo al operador
                    const { error: linkError } = await supabase
                        .from('operador')
                        .update({ user_id: userId })
                        .eq('id', operador.id);

                    if (linkError) console.error('Error vinculando user_id:', linkError);
                } else if (operador.pass) {
                    // Si no existe el usuario, podemos crear uno usando register
                    const userData = {
                        nombre: operador.nombre.split(' ')[0] || '',
                        apellido: operador.nombre.split(' ').slice(1).join(' ') || '',
                        ciudad: operador.direccion || 'Ciudad de México',
                        sueldo: operador.salario_base || 0
                    };

                    const result = await register(operador.email, operador.pass, userData, operador.rol_id || undefined);
                    if (result) {
                        const { data: newUser, error: newUserError } = await supabase
                            .from('user')
                            .select('id')
                            .eq('email', operador.email)
                            .maybeSingle();

                        if (newUserError) console.error('Error obteniendo nuevo user:', newUserError);
                        if (newUser) {
                            userId = newUser.id;
                            const { error: linkError } = await supabase
                                .from('operador')
                                .update({ user_id: userId })
                                .eq('id', operador.id);
                            if (linkError) console.error('Error vinculando user_id:', linkError);
                        }
                    }
                }
            } else {
                // Si ya existe userId y el email cambió, actualizar en 'user'
                const { data: currentUser } = await supabase
                    .from('user')
                    .select('email')
                    .eq('id', userId)
                    .maybeSingle();

                if (currentUser && currentUser.email !== operador.email) {
                    const { error: updateUserError } = await supabase
                        .from('user')
                        .update({ email: operador.email })
                        .eq('id', userId);

                    if (updateUserError) console.error('Error actualizando email en user:', updateUserError);
                }
            }

            // Si se proporcionó contraseña, actualizarla en la tabla 'user' (siempre que tengamos userId)
            if (operador.pass && userId) {
                const { error: updatePassError } = await supabase
                    .from('user')
                    .update({ pass: operador.pass })
                    .eq('id', userId);

                if (updatePassError) console.error('Error actualizando pass en user:', updatePassError);
            }

            // Si tenemos un usuario vinculado y acceso al sistema, actualizar su rol en userroles.
            if (userId && operador.acceso_sistema) {
                const { error: deleteRolesError } = await supabase
                    .from('userroles')
                    .delete()
                    .eq('userid', userId);

                if (deleteRolesError) {
                    console.error('Error eliminando roles previos del usuario:', deleteRolesError);
                }

                if (operador.rol_id) {
                    const rolAsignado = await asignarRol(userId, operador.rol_id);
                    if (!rolAsignado) {
                        console.error('Error asignando el rol al usuario existente.');
                    }
                }
            }
        } catch (error) {
            console.error('Error actualizando/creando usuario:', error);
        }
    }

    // 3. Actualizar el operador (no escribimos email en la tabla operador, se mantiene en 'user')
    const { data, error } = await supabase
        .from('operador')
        .update({
            nombre: operador.nombre,
            puesto: operador.puesto,
            salario_base: operador.salario_base,
            estatus: operador.estatus,
            descripcion: operador.descripcion,
            telefono: operador.telefono,
            direccion: operador.direccion,
            fecha_contratacion: operador.fecha_contratacion,
            acceso_sistema: operador.acceso_sistema || false,
            rol_id: operador.rol_id || null,
            camion_full: operador.camion_full || false
        })
        .eq('id', operador.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating operador:', error);
        throw error;
    }

    return data;
};

export const deleteOperador = async (id: number): Promise<void> => {
    try {
        // 1. Obtener el operador para saber si tiene acceso al sistema y su user_id
        const { data: operador, error: fetchError } = await supabase
            .from('operador')
            .select('acceso_sistema, user_id') // ← Quitamos 'email'
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error('Error obteniendo operador:', fetchError);
            throw fetchError;
        }

        // 2. Si tiene acceso al sistema y tiene user_id, eliminar el usuario y sus roles
        if (operador.acceso_sistema && operador.user_id) {
            try {
                // Buscar el usuario por user_id
                const { data: userData, error: userError } = await supabase
                    .from('user')
                    .select('id, auth_id')
                    .eq('id', operador.user_id) // ← Usamos user_id en lugar de email
                    .maybeSingle();

                if (userError) {
                    console.error('Error obteniendo usuario:', userError);
                }

                if (userData) {
                    // Eliminar userroles primero
                    const { error: roleError } = await supabase
                        .from('userroles')
                        .delete()
                        .eq('userid', userData.id);

                    if (roleError) {
                        console.error('Error eliminando userroles:', roleError);
                    } else {
                        console.log(`✅ Userroles eliminados para user_id: ${userData.id}`);
                    }

                    // Eliminar el usuario de la tabla 'user'
                    const { error: deleteUserError } = await supabase
                        .from('user')
                        .delete()
                        .eq('id', userData.id);

                    if (deleteUserError) {
                        console.error('Error eliminando usuario:', deleteUserError);
                    } else {
                        console.log(`✅ Usuario eliminado: ${userData.id}`);
                    }

                    // Opcional: Eliminar también de auth.users (requiere clave de servicio)
                    if (userData.auth_id) {
                        try {
                            // Solo si tienes la clave de servicio configurada
                            // const { error: authError } = await supabase.auth.admin.deleteUser(
                            //     userData.auth_id
                            // );
                            // if (authError) {
                            //     console.error('Error eliminando auth user:', authError);
                            // }
                            console.log(`ℹ️ Auth user pendiente de eliminar: ${userData.auth_id}`);
                        } catch (authError) {
                            console.error('Error eliminando auth user:', authError);
                        }
                    }
                } else {
                    console.warn(`⚠️ No se encontró usuario con ID: ${operador.user_id}`);
                }
            } catch (authError) {
                console.error('Error eliminando usuario/auth:', authError);
                // Continuamos con la eliminación del operador
            }
        } else {
            console.log(`ℹ️ Operador ${id} no tiene acceso al sistema o no tiene user_id vinculado`);
        }

        // 3. Eliminar el operador
        const { error } = await supabase
            .from('operador')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting operador:', error);
            throw error;
        }

        console.log(`✅ Operador ${id} eliminado correctamente`);
    } catch (error) {
        console.error('❌ Error in deleteOperador:', error);
        throw error;
    }
};

export const toggleEstatusOperador = async (id: number, currentEstatus: boolean): Promise<boolean> => {
    const newEstatus = !currentEstatus;
    
    try {
        // 1. Actualizar el estatus en la tabla operador
        const { error } = await supabase
            .from('operador')
            .update({ estatus: newEstatus })
            .eq('id', id);

        if (error) {
            console.error('Error toggling estatus:', error);
            throw error;
        }

        console.log(`Estatus del operador ${id} actualizado a: ${newEstatus ? 'Activo' : 'Inactivo'}`);
        return newEstatus;
    } catch (error) {
        console.error('Error en toggleEstatusOperador:', error);
        throw error;
    }
};