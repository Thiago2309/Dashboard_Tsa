// Services/BD/Checador/checadorZonaService.ts
import { supabase } from '../../superbase.service';

export interface ZonaChecadorAdmin {
    id?: number;
    nombre: string;
    latitud: number;
    longitud: number;
    radio_metros: number;
    activo: boolean;
}

export const fetchTodasLasZonas = async (): Promise<ZonaChecadorAdmin[]> => {
    const { data, error } = await supabase
        .from('checador_zona')
        .select('id, nombre, latitud, longitud, radio_metros, activo')
        .order('id', { ascending: false });

    if (error) {
        console.error('Error obteniendo zonas del checador:', error);
        throw error;
    }
    return data || [];
};

export const crearZona = async (zona: Omit<ZonaChecadorAdmin, 'id'>): Promise<ZonaChecadorAdmin> => {
    const { data, error } = await supabase.from('checador_zona').insert([zona]).select().single();

    if (error) {
        console.error('Error creando zona del checador:', error);
        throw error;
    }
    return data;
};

export const actualizarZona = async (zona: ZonaChecadorAdmin): Promise<ZonaChecadorAdmin> => {
    const { data, error } = await supabase
        .from('checador_zona')
        .update({
            nombre: zona.nombre,
            latitud: zona.latitud,
            longitud: zona.longitud,
            radio_metros: zona.radio_metros,
            activo: zona.activo
        })
        .eq('id', zona.id)
        .select()
        .single();

    if (error) {
        console.error('Error actualizando zona del checador:', error);
        throw error;
    }
    return data;
};

export const eliminarZona = async (id: number): Promise<void> => {
    const { error } = await supabase.from('checador_zona').delete().eq('id', id);
    if (error) {
        console.error('Error eliminando zona del checador:', error);
        throw error;
    }
};
