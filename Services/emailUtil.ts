// Services/emailUtil.ts
// Supabase Auth guarda los correos en minúsculas. Si en la tabla 'user' se guardan con
// mayúsculas o espacios, el login (que busca primero en 'user') y Auth dejan de coincidir.
// Por eso el correo se normaliza SIEMPRE: al crear, al editar y al iniciar sesión.
export const normalizarEmail = (email: string | null | undefined): string => (email || '').trim().toLowerCase();

export const emailValido = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Para buscar con .ilike() sin que '%' o '_' del correo funcionen como comodines.
export const escaparLike = (texto: string): string => texto.replace(/[\\%_]/g, (c) => `\\${c}`);
