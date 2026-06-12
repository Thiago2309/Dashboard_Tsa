import { supabase } from '../../superbase.service';

export interface Prestamo {
  id?: number;
  id_operador: number;
  monto: number;
  saldo_pendiente: number;
  fecha_prestamo: string;
  descripcion?: string;
  tipo: string;
  tasa_interes: number;
  plazo_meses: number;
  estatus: string;
  created_at?: string;
  updated_at?: string;
  
  // Campos relacionales
  operador_nombre?: string;
}

export interface PagoPrestamo {
    id?: number;
    id_prestamo: number;
    id_nomina?: number;
    monto: number;
    fecha_pago: string;
    descripcion?: string;
    created_at?: string;
}

export const fetchPrestamos = async (estatus?: string): Promise<Prestamo[]> => {
  let query = supabase
    .from('prestamos')
    .select(`
      *,
      operador:id_operador(nombre)
    `)
    .order('fecha_prestamo', { ascending: false });

  if (estatus) {
    query = query.eq('estatus', estatus);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data?.map(item => ({
    ...item,
    operador_nombre: item.operador?.nombre
  })) || [];
};

export const fetchPrestamosActivos = async (): Promise<Prestamo[]> => {
  return fetchPrestamos('Pendiente');
};

export const createPrestamo = async (prestamo: Omit<Prestamo, 'id'>): Promise<Prestamo> => {
  const { data, error } = await supabase
    .from('prestamos')
    .insert([{
      ...prestamo,
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

export const updatePrestamo = async (prestamo: Prestamo): Promise<Prestamo> => {
  const { data, error } = await supabase
    .from('prestamos')
    .update({
      ...prestamo,
      updated_at: new Date().toISOString()
    })
    .eq('id', prestamo.id)
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

export const aplicarPagoPrestamo = async (id: number, montoPago: number, idNomina?: number): Promise<void> => {
  const { data: prestamo, error: fetchError } = await supabase
    .from('prestamos')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const nuevoSaldo = prestamo.saldo_pendiente - montoPago;
  const nuevoEstatus = nuevoSaldo <= 0 ? 'Pagado' : prestamo.estatus;

  const { error: updateError } = await supabase
    .from('prestamos')
    .update({
      saldo_pendiente: Math.max(0, nuevoSaldo),
      estatus: nuevoEstatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (updateError) throw updateError;

    // Crear registro en pagos_prestamos
    const { error: pagoError } = await supabase
        .from('pagos_prestamos')
        .insert([{
            id_prestamo: id,
            id_nomina: idNomina || null,
            monto: montoPago,
            fecha_pago: new Date().toISOString().split('T')[0],
            descripcion: `Pago aplicado desde nómina${idNomina ? ` #${idNomina}` : ''}`,
            created_at: new Date().toISOString()
        }]);

    if (pagoError) throw pagoError;
};

export const deletePrestamo = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('prestamos')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const crearPagoPrestamo = async (pago: Omit<PagoPrestamo, 'id'>): Promise<PagoPrestamo> => {
    const { data, error } = await supabase
        .from('pagos_prestamos')
        .insert([{
            ...pago,
            created_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const actualizarPagoPrestamo = async (id: number, montoPago: number, idNomina?: number): Promise<void> => {
    const { data: prestamo, error: fetchError } = await supabase
        .from('prestamos')
        .select('*')
        .eq('id', id)
        .single();

    if (fetchError) throw fetchError;

    const nuevoSaldo = prestamo.saldo_pendiente - montoPago;
    const nuevoEstatus = nuevoSaldo <= 0 ? 'Pagado' : prestamo.estatus;

    // Actualizar préstamo
    const { error: updateError } = await supabase
        .from('prestamos')
        .update({
            saldo_pendiente: Math.max(0, nuevoSaldo),
            estatus: nuevoEstatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (updateError) throw updateError;

    // Crear registro en historial de pagos
    await crearPagoPrestamo({
        id_prestamo: id,
        id_nomina: idNomina,
        monto: montoPago,
        fecha_pago: new Date().toISOString().split('T')[0],
        descripcion: `Pago aplicado desde nómina${idNomina ? ` #${idNomina}` : ''}`
    });
};