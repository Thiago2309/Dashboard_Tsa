// Services/BD/puestoService.ts
import { supabase } from '../superbase.service';

export interface Puesto {
    id?: number;
    nombre: string;
    estatus: boolean;
    total_empleados?: number;
}

export interface EmpleadoResumenPuesto {
    id: number;
    nombre: string;
}

export const fetchPuestos = async (): Promise<Puesto[]> => {
    const { data, error } = await supabase
        .from('puesto')
        .select('*')
        .order('nombre');

    if (error) {
        console.error('Error fetching puestos:', error);
        throw error;
    }

    const puestos: any[] = data || [];

    const { data: operadores, error: operadoresError } = await supabase
        .from('operador')
        .select('id, puesto_id');

    if (operadoresError) {
        console.error('Error contando empleados por puesto:', operadoresError);
    }

    const conteoPorPuesto = new Map<number, number>();
    (operadores || []).forEach((op: any) => {
        if (op.puesto_id) {
            conteoPorPuesto.set(op.puesto_id, (conteoPorPuesto.get(op.puesto_id) || 0) + 1);
        }
    });

    return puestos.map(p => ({ ...p, total_empleados: conteoPorPuesto.get(p.id) || 0 }));
};

// Lista simple para selects (dropdowns)
export const fetchPuestosActivos = async (): Promise<{ id: number; nombre: string }[]> => {
    const { data, error } = await supabase
        .from('puesto')
        .select('id, nombre')
        .eq('estatus', true)
        .order('nombre');

    if (error) {
        console.error('Error fetching puestos activos:', error);
        throw error;
    }

    return data || [];
};

export const createPuesto = async (nombre: string): Promise<Puesto> => {
    const { data, error } = await supabase
        .from('puesto')
        .insert([{ nombre, estatus: true }])
        .select()
        .single();

    if (error) {
        console.error('Error creating puesto:', error);
        throw error;
    }

    return data;
};

export const updatePuesto = async (puesto: Puesto): Promise<Puesto> => {
    const { data, error } = await supabase
        .from('puesto')
        .update({ nombre: puesto.nombre, estatus: puesto.estatus })
        .eq('id', puesto.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating puesto:', error);
        throw error;
    }

    return data;
};

export const deletePuesto = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('puesto')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting puesto:', error);
        throw error;
    }
};

export const fetchEmpleadosPorPuesto = async (puestoId: number): Promise<EmpleadoResumenPuesto[]> => {
    const { data, error } = await supabase
        .from('operador')
        .select('id, nombre')
        .eq('puesto_id', puestoId)
        .order('nombre');

    if (error) {
        console.error('Error fetching empleados del puesto:', error);
        throw error;
    }

    return data || [];
};
