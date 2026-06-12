import { supabase } from '../../superbase.service';

export interface Nomina {
  id?: number;
  id_operador: number;
  empleado_nombre: string; // CAMBIAR DE string? a string
  semana: number;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  total_viajes: number;
  
  // Campos que estaban faltando en tu interfaz
  salario_base: number;
  pago_alcance_meta: number;
  rebaso: boolean;
  cantidad_viajes: number;
  
  pago_bruto: number;
  
  // Descuentos
  descuento_imss: number;
  descuento_isr: number;
  descuento_infonavit: number;
  descuento_fonacot: number;
  otros_descuentos: number;
  
  // Préstamos y deducciones
  prestamos: number;
  pago_neto: number;
  
  // Bonos
  bono: number;
  horas_extra: number;
  otros_bonos: number;
  
  // Información de pago
  metodo_pago?: string;
  referencia_pago?: string;
  fecha_pago?: string;
  
  estatus: string;
  notas?: string;
  created_at?: string;
  updated_at?: string;
}

export const fetchNominas = async (semana?: number, anio?: number): Promise<Nomina[]> => {
  let query = supabase
    .from('nominas')
    .select(`
      *,
      operador:id_operador(nombre)
    `)
    .order('fecha_inicio', { ascending: false });

  if (semana && anio) {
    query = query.eq('semana', semana).eq('anio', anio);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data?.map(item => ({
    ...item,
    operador_nombre: item.operador?.nombre
  })) || [];
};

export const createNomina = async (nomina: Omit<Nomina, 'id'>): Promise<Nomina> => {
  const { data, error } = await supabase
    .from('nominas')
    .insert([{
      ...nomina,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select(`
      *,
      operador:id_operador(nombre)
    `)
    .single();

  if (error) throw error;
  
  return {
    ...data,
    operador_nombre: data.operador?.nombre
  };
};

export const updateNomina = async (nomina: Nomina): Promise<Nomina> => {
  const { data, error } = await supabase
    .from('nominas')
    .update({
      ...nomina,
      updated_at: new Date().toISOString()
    })
    .eq('id', nomina.id)
    .select(`
      *,
      operador:id_operador(nombre)
    `)
    .single();

  if (error) throw error;
  
  return {
    ...data,
    operador_nombre: data.operador?.nombre
  };
};

export const updateNominaEstatus = async (id: number, estatus: string): Promise<void> => {
  const { error } = await supabase
    .from('nominas')
    .update({ 
      estatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
};

export const deleteNomina = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('nominas')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const fetchNominasPorSemana = async (semana: number, anio: number): Promise<Nomina[]> => {
    const { data, error } = await supabase
        .from('nominas')
        .select('*')
        .eq('semana', semana)
        .eq('anio', anio)
        .order('id_operador', { ascending: true });

    if (error) {
        console.error('Error fetching nominas por semana:', error);
        throw error;
    }

    return data || [];
};

export const fetchNominaPorOperadorSemana = async (id_operador: number, semana: number, anio: number): Promise<Nomina | null> => {
    const { data, error } = await supabase
        .from('nominas')
        .select('*')
        .eq('id_operador', id_operador)
        .eq('semana', semana)
        .eq('anio', anio)
        .single();

    if (error) {
        if (error.code === 'PGRST116') { // No se encontraron resultados
            return null;
        }
        console.error('Error fetching nomina por operador:', error);
        throw error;
    }

    return data;
};