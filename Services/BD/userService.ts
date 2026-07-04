// Services/BD/userService.ts
import { supabase } from '../superbase.service';

export interface User {
    id: number | null;
    auth_id: string | null;
    nombre: string;
    apellido: string;
    ciudad: string;
    sueldo: number;
    email: string;
    pass?: string;
}

// Función para verificar si el usuario existe en la tabla 'user'
export const verificarUsuarioEnTabla = async (email: string) => {
    const { data, error } = await supabase
        .from('user')
        .select('id, auth_id')
        .eq('email', email)
        .maybeSingle();

    if (error) {
        console.error('Error verificando usuario en tabla:', error);
        return null;
    }

    return data;
};

// Función para asignar rol a un usuario existente
export const asignarRol = async (userId: number, roleId: number) => {
    // Verificar si ya tiene el rol
    const { data: existingRole } = await supabase
        .from('userroles')
        .select('id')
        .eq('userid', userId)
        .eq('roleid', roleId)
        .maybeSingle();

    if (existingRole) {
        console.log('El usuario ya tiene este rol asignado');
        return true;
    }

    // IMPORTANTE: No enviar el campo 'id', dejar que la base de datos lo genere
    const { error } = await supabase
        .from('userroles')
        .insert([{ 
            userid: userId, 
            roleid: roleId 
        }]); // ← Sin el campo 'id'

    if (error) {
        console.error('Error asignando rol:', error);
        return false;
    }

    console.log('Rol asignado correctamente');
    return true;
};

// Función mejorada de registro
export const register = async (email: string, password: string, userData: Omit<User, 'id' | 'auth_id' | 'email'>, roleId?: number) => {
    try {
        // 1. Verificar si el email ya está registrado en auth
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const userExists = existingUsers?.users?.find(u => u.email === email);

        let authUser = null;
        let authId = '';

        if (userExists) {
            console.log('Usuario ya existe en auth, intentando vincular...');
            authId = userExists.id;
            authUser = userExists;
        } else {
            // 2. Crear usuario en auth
            const { data: authData, error: authError } = await supabase.auth.signUp({ 
                email, 
                password 
            });
            
            if (authError || !authData.user) {
                console.error('Error en registro:', authError?.message);
                return null;
            }
            
            authId = authData.user.id;
            authUser = authData.user;
        }

        // 3. Verificar si el usuario ya existe en la tabla 'user'
        const usuarioExistente = await verificarUsuarioEnTabla(email);
        
        let userId = usuarioExistente?.id;

        if (!usuarioExistente) {
            // 4. Insertar en la tabla user
            const { data: userDataResponse, error: userError } = await supabase
                .from('user')
                .insert([{ 
                    auth_id: authId,
                    email,
                    pass: password, // Guardar la contraseña
                    nombre: userData.nombre || '',
                    apellido: userData.apellido || '',
                    ciudad: userData.ciudad || 'Ciudad de México',
                    sueldo: userData.sueldo || 0
                }])
                .select()
                .single();

            if (userError) {
                console.error('Error insertando usuario en tabla user:', userError.message);
                return null;
            }

            userId = userDataResponse.id;
            console.log('Usuario creado en tabla user con ID:', userId);
        } else {
            console.log('ℹUsuario ya existe en tabla user con ID:', userId);
        }

        // 5. Asignar rol si se proporcionó
        if (roleId && userId) {
            const rolAsignado = await asignarRol(userId, roleId);
            if (!rolAsignado) {
                console.warn('⚠️ No se pudo asignar el rol, pero el usuario fue creado');
            }
        }

        return { userId, authId, authUser };
        
    } catch (error) {
        console.error('Error en register:', error);
        return null;
    }
};

export const login = async (email: string, password: string) => {
    try {
        // 1. Buscar el usuario en la tabla 'user' por email (para obtener su auth_id y relación)
        const { data: userData, error: userError } = await supabase
            .from('user')
            .select('id, nombre, apellido, auth_id')
            .eq('email', email)
            .maybeSingle();

        if (userError) {
            console.error('Error verificando usuario:', userError);
            throw new Error('Error al verificar el usuario');
        }

        if (!userData) {
            throw new Error('Usuario no encontrado');
        }

        // 2. Buscar el operador usando el nombre del usuario (asumiendo que coinciden)
        const { data: operador, error: operadorError } = await supabase
            .from('operador')
            .select('estatus, id, nombre')
            .eq('nombre', userData.nombre) // Buscar por nombre (o por id si tienes relación)
            .maybeSingle();

        if (operadorError) {
            console.error('Error verificando operador:', operadorError);
            throw new Error('Error al verificar el estado del operador');
        }

        // 3. Si el operador existe y está desactivado, NO permite login
        if (operador && !operador.estatus) {
            throw new Error('⚠️ Usuario desactivado. Contacte al administrador.');
        }

        // 4. Si está activo o no existe (operador sin acceso), proceder con el login normal
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error || !data.user) {
            console.error('Error en autenticación:', error?.message);
            throw error || new Error('No se pudo autenticar al usuario');
        }

        // 5. Verificar que el auth_id coincida con el usuario en la tabla 'user'
        if (data.user.id !== userData.auth_id) {
            console.warn('⚠️ El auth_id no coincide, actualizando...');
            // Actualizar auth_id en la tabla 'user'
            await supabase
                .from('user')
                .update({ auth_id: data.user.id })
                .eq('id', userData.id);
        }

        // 6. Guardar datos de sesión
        const authId = data.user.id;
        sessionStorage.setItem('authId', authId);

        const userId = userData.id;
        sessionStorage.setItem('userId', userId.toString());

        // 7. Obtener el rol del usuario
        const { data: userRole, error: roleError } = await supabase
            .from('userroles')
            .select('roleid')
            .eq('userid', userId)
            .maybeSingle();

        if (roleError) {
            console.error('Error obteniendo rol:', roleError.message);
            // Continuar aunque no tenga rol
        }

        const roleid = userRole?.roleid || null;
        localStorage.setItem('userData', JSON.stringify({ 
            userId, 
            roleid,
            nombre: userData.nombre,
            apellido: userData.apellido
        }));

        // Guardar estatus del operador para verificaciones rápidas
        localStorage.setItem('userEstatus', operador?.estatus ? 'activo' : 'inactivo');

        console.log(`✅ Login exitoso: ${email}`);
        return data.user;

    } catch (error: any) {
        console.error('Error en login:', error);
        throw new Error(error.message || 'Error al iniciar sesión');
    }
};

export const fetchUserData = async (authId: string) => {
    const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('auth_id', authId)
        .maybeSingle();

    return error ? null : data;
};

export const getsession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        console.error("Error al obtener la sesión:", error);
        return null;
    }
    return data.session;
};

export const getUserRoleIdFromLocalStorage = (): number | null => {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData).roleid as number : null;
};