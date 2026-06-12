import { supabase } from '../../superbase.service';

export interface Bono {
  id?: number;
  id_operador: number;
  monto: number;
  tipo: 'fijo' | 'variable';
  descripcion: string;
  fecha_inicio: string;
  fecha_fin?: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
  
  // Campos relacionales
  operador_nombre?: string;
}

export const fetchBonos = async (): Promise<Bono[]> => {
  const { data, error } = await supabase
    .from('bonos')
    .select(`
      *,
      operador:id_operador(nombre)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data?.map(item => ({
    ...item,
    operador_nombre: item.operador?.nombre
  })) || [];
};

export const fetchBonosActivos = async (): Promise<Bono[]> => {
  const { data, error } = await supabase
    .from('bonos')
    .select(`
      *,
      operador:id_operador(nombre)
    `)
    .eq('activo', true)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data?.map(item => ({
    ...item,
    operador_nombre: item.operador?.nombre
  })) || [];
};

export const fetchBonoById = async (id: number): Promise<Bono | null> => {
  const { data, error } = await supabase
    .from('bonos')
    .select(`
      *,
      operador:id_operador(nombre)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return {
    ...data,
    operador_nombre: data.operador?.nombre
  };
};

export const createBono = async (bono: Omit<Bono, 'id'>): Promise<Bono> => {
  // Insertar sin esperar retorno del ID
  const { error } = await supabase
    .from('bonos')
    .insert([{
      ...bono,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]);

  if (error) throw error;

  // Buscar el bono recién creado por otros campos
  const { data, error: fetchError } = await supabase
    .from('bonos')
    .select(`
      *,
      operador:id_operador(nombre)
    `)
    .eq('id_operador', bono.id_operador)
    .eq('monto', bono.monto)
    .eq('descripcion', bono.descripcion)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError) throw fetchError;

  return {
    ...data,
    operador_nombre: data.operador?.nombre
  };
};

export const updateBono = async (bono: Bono): Promise<Bono> => {
  const { data, error } = await supabase
    .from('bonos')
    .update({
      ...bono,
      updated_at: new Date().toISOString()
    })
    .eq('id', bono.id)
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

export const deleteBono = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('bonos')
    .delete()
    .eq('id', id);

  if (error) throw error;
};