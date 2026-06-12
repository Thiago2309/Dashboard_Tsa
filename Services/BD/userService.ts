"use client";
import { supabase } from '../superbase.service';

export interface User {
    id: number | null;
    auth_id: string | null;
    nombre: string;
    apellido: string;
    ciudad: string;
    sueldo: number;
    email: string;
    pass: string;
}



export const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error || !data.user) {
        throw error || new Error('No se pudo autenticar al usuario');
      }
  
    
  
      // Guardar datos relevantes en sessionStorage
      sessionStorage.setItem('authId', data.user.id);
      const authId = data.user.id;
      
                // Buscar el usuario en la tabla "user" usando authId
        const { data: user, error: userError } = await supabase
        .from('user')
        .select('id')
        .eq('auth_id', authId)
        .single();

        if (userError || !user) {
            console.error('Error obteniendo datos del usuario:', userError?.message);
            return null;
        }
        const userId = user.id;
        sessionStorage.setItem('userId', userId.toString());
    
        // // Obtener el rol del usuario desde la tabla userroles usando userId
        const { data: userRole, error: roleError } = await supabase
            .from('userroles')
            .select('roleid') // usando el nombre en minúsculas según la tabla
            .eq('userid', userId) // usando el nombre en minúsculas
            .single();
    
        if (roleError || !userRole) {
            console.error('Error obteniendo rol del usuario:', roleError?.message);
            return null;
        }
    
        const roleid = userRole.roleid;
        //const roleid = 1; // Cambiar por el valor real obtenido de la tabla userroles
        // Guardar userId y roleid en una sola key en localStorage ("userData")
        const userData = { userId, roleid };
        localStorage.setItem('userData', JSON.stringify(userData));
      return data.user;
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  };

// export const login = async (email: string, password: string) => {
//     const { data, error } = await supabase.auth.signInWithPassword({ email, password });
//     if (error || !data.user) {
//         console.error('Error en la autenticación:', error?.message);
//         return null;
//     }

//     // Obtener el ID del usuario autenticado (authId)
//     const authId = data.user.id;
//     sessionStorage.setItem('authId', authId);

//     // Buscar el usuario en la tabla "user" usando authId
//     const { data: user, error: userError } = await supabase
//         .from('user')
//         .select('id')
//         .eq('auth_id', authId)
//         .single();

//     if (userError || !user) {
//         console.error('Error obteniendo datos del usuario:', userError?.message);
//         return null;
//     }

//     const userId = user.id;
//     sessionStorage.setItem('userId', userId.toString());

//     // // Obtener el rol del usuario desde la tabla userroles usando userId
//     const { data: userRole, error: roleError } = await supabase
//         .from('userroles')
//         .select('roleid') // usando el nombre en minúsculas según la tabla
//         .eq('userid', userId) // usando el nombre en minúsculas
//         .single();

//     if (roleError || !userRole) {
//         console.error('Error obteniendo rol del usuario:', roleError?.message);
//         return null;
//     }

//     const roleid = userRole.roleid;
//     //const roleid = 1; // Cambiar por el valor real obtenido de la tabla userroles
//     // Guardar userId y roleid en una sola key en localStorage ("userData")
//     const userData = { userId, roleid };
//     localStorage.setItem('userData', JSON.stringify(userData));

//     return data.user;
// };

//elfokingregister
export const register = async (email: string, password: string, userData: Omit<User, 'id' | 'auth_id' | 'email'>) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    
    if (authError || !authData.user) {
        console.error('Error en registro:', authError?.message);
        return null;
    }

    const { data: userDataResponse, error: userError } = await supabase
        .from('user')
        .insert([{ 
            auth_id: authData.user.id,
            email,
            ...userData
        }])
        .single();

    return userError ? null : userDataResponse;
};

export const fetchUserData = async (authId: string) => {
    const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('auth_id', authId)
        .single();

    return error ? null : data;
};

export const getsession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error al obtener la sesión:", error);
      return null;
    }
    console.log("Sesión:", data);
    return data.session; // o data.session si se encuentra la sesión
  };
  


export const getUserRoleIdFromLocalStorage = (): number | null => {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData).roleid as number : null;
};
