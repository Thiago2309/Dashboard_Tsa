import { supabase } from '../superbase.service';
import { crearCuentaPorPagar } from './CxPService';

export interface Invitado {
    id?: number;
    empresa: string;
    contacto: string;
    telefono?: string;
    tipo_cliente?: string;
    rfc?: string;
    direccion?: string;
    metodo_pago?: string;
    uso_cfdi?: string;
    regimen_fiscal?: string;
    obra?: string;
    porcentaje_participacion?: number;
    estatus?: number;
    created_at?: string;
    updated_at?: string;
}

export const fetchInvitados = async (): Promise<Invitado[]> => {
    const { data, error } = await supabase
        .from('invitados')
        .select('*')
        .order('empresa', { ascending: true });

    if (error) throw error;
    return data || [];
};

export const createInvitado = async (invitado: Omit<Invitado, 'id'>): Promise<Invitado> => {
    const { data, error } = await supabase
        .from('invitados')
        .insert([{ 
            ...invitado,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) throw error;

    await crearCuentaPorPagar({
        id_entidad: data.id,
        tipo_entidad: 'Invitado',
        id_compra: null,
        fecha: new Date().toISOString().split('T')[0],
        monto: 0,
        saldo: 0,
        estatus: 'Pendiente',
        fecha_pago_esperado: null,
        notas: `Cuenta generada automáticamente al registrar el invitado: ${data.empresa}`
    });

    return data;
};

export const updateInvitado = async (invitado: Invitado): Promise<Invitado> => {
    const { data, error } = await supabase
        .from('invitados')
        .update({ 
            ...invitado,
            updated_at: new Date().toISOString()
        })
        .eq('id', invitado.id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteInvitado = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('invitados')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const toggleEstatusInvitado = async (id: number, estatus: number): Promise<number> => {
    const newEstatus = estatus === 1 ? 0 : 1;
    const { error } = await supabase
        .from('invitados')
        .update({ 
            estatus: newEstatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) throw error;
    return newEstatus;
};