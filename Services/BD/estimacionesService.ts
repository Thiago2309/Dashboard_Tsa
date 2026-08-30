// Services/BD/estimacionesService.ts

import { supabase } from '@/Services/superbase.service';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { RentaMaquinaria } from './inventario/maquinaria/rentaMaquinariaService';

export interface EstimacionCliente {
  id_cliente: number;
  cliente_nombre: string;
  contacto?: string;
  obra?: string;
  total_viajes: number;
  total_m3: number;
  total_cobrar: number;
  etiquetas: string[]; // 'camion' y/o 'maquinaria'
}

export interface ViajeEstimacion {
  id: number;
  fecha: string;
  folio: string;
  folio_bco?: string;
  material: string;
  m3: number;
  precio: number;
  operador: string;
  total_viaje: number;
  numero_viaje?: number;
  origen?: string;
  destino?: string;
  horas_renta?: number;
  estatus?: string | null;
}

// Interfaces para las relaciones
interface OperadorRelation {
  nombre: string;
}

interface MaterialRelation {
  nombre: string;
}

interface M3Relation {
  metros_cubicos: number;
}

interface PrecioOrigenDestinoRelation {
  nombreorigen: string;
  nombredestino: string;
  precio_unidad: number;
}

interface ViajeWithRelations {
  id: number;
  fecha: string;
  folio: string;
  folio_bco: string;
  caphrsviajes: number;
  id_operador: number;
  id_material: number;
  id_m3: number;
  id_precio_origen_destino: number;
  operador: OperadorRelation[];
  material: MaterialRelation[];
  m3: M3Relation[];
  precio_origen_destino: PrecioOrigenDestinoRelation[];
}

export interface FiltrosEstimacion {
  fechaInicio: Date | null;
  fechaFin: Date | null;
  clienteId: number | null;
  operador: string | null;
  material: string | null;
  origen: string | null;
  destino: string | null;
  estatus: string | null;
}

// export const fetchClientesConViajes = async (): Promise<EstimacionCliente[]> => {
//   const { data: clientes, error } = await supabase
//     .from('clientes')
//     .select('id, empresa, contacto, obra')
//     .order('empresa');

//   if (error) throw error;

//   const clientesConViajes = await Promise.all(
//     clientes.map(async (cliente) => {
//       const { data: viajes } = await supabase
//         .from('viajes')
//         .select('id_m3, caphrsviajes')
//         .eq('id_cliente', cliente.id);

//       const total_viajes = viajes?.length || 0;
      
//       // Obtener los metros cúbicos de la tabla m3
//       const m3Data = await Promise.all(
//         viajes?.map(async (viaje) => {
//           if (viaje.id_m3) {
//             const { data: m3 } = await supabase
//               .from('m3')
//               .select('metros_cubicos')
//               .eq('id', viaje.id_m3)
//               .single();
//             return m3?.metros_cubicos || 0;
//           }
//           return 0;
//         }) || []
//       );

//       const total_m3 = m3Data.reduce((sum, m3) => sum + m3, 0);
//       const total_cobrar = viajes?.reduce((sum, viaje) => sum + (viaje.caphrsviajes || 0), 0) || 0;

//       return {
//         id_cliente: cliente.id,
//         cliente_nombre: cliente.empresa,
//         contacto: cliente.contacto,
//         obra: cliente.obra,
//         total_viajes,
//         total_m3,
//         total_cobrar
//       };
//     })
//   );

//   return clientesConViajes;
// };

export const fetchClientesConViajesUltraRapido = async (): Promise<EstimacionCliente[]> => {
  try {
    // 1. Una sola consulta con JOIN para obtener todos los datos necesarios
    const { data, error } = await supabase
      .from('clientes')
      .select(`
        id,
        empresa,
        contacto,
        obra,
        etiquetas,
        viajes!left(
          id,
          caphrsviajes,
          m3:m3!left(metros_cubicos)
        )
      `)
      .order('empresa');

    if (error) throw error;
    if (!data) return [];

    // 2. Procesar los datos localmente (muy rápido)
    return data.map(cliente => {
      const viajes = cliente.viajes || [];
      const total_viajes = viajes.length;

      const total_m3 = viajes.reduce((sum, viaje) => {
        return sum + (viaje.m3?.[0]?.metros_cubicos || 0);
      }, 0);

      const total_cobrar = viajes.reduce((sum, viaje) => sum + (viaje.caphrsviajes || 0), 0);

      return {
        id_cliente: cliente.id,
        cliente_nombre: cliente.empresa,
        contacto: cliente.contacto,
        obra: cliente.obra,
        total_viajes,
        total_m3,
        total_cobrar,
        etiquetas: (cliente as any).etiquetas || []
      };
    });
  } catch (error) {
    console.error('Error en fetchClientesConViajes:', error);
    throw error;
  }
};

export const fetchViajesConFiltros = async (filtros: FiltrosEstimacion): Promise<ViajeEstimacion[]> => {
  let query = supabase
    .from('viajes')
    .select(`
      id,
      fecha,
      folio,
      folio_bco,
      caphrsviajes,
      id_operador,
      id_material,
      id_m3,
      id_precio_origen_destino,
      operador:operador!id_operador(nombre),
      material:material!id_material(nombre),
      m3:m3!id_m3(metros_cubicos),
      precio_origen_destino:precio_origen_destino!id_precio_origen_destino(nombreorigen, nombredestino, precio_unidad)
    `);

  // Aplicar filtros existentes...
  if (filtros.fechaInicio) {
    query = query.gte('fecha', filtros.fechaInicio.toISOString().split('T')[0]);
  }
  if (filtros.fechaFin) {
    query = query.lte('fecha', filtros.fechaFin.toISOString().split('T')[0]);
  }
  if (filtros.clienteId) {
    query = query.eq('id_cliente', filtros.clienteId);
  }
  if (filtros.operador) {
    query = query.ilike('operador.nombre', `%${filtros.operador}%`);
  }
  if (filtros.material) {
    query = query.ilike('material.nombre', `%${filtros.material}%`);
  }

  // AGREGAR NUEVOS FILTROS
  if (filtros.origen) {
    query = query.ilike('precio_origen_destino.nombreorigen', `%${filtros.origen}%`);
  }
  if (filtros.destino) {
    query = query.ilike('precio_origen_destino.nombredestino', `%${filtros.destino}%`);
  }

  const { data, error } = await query.order('fecha', { ascending: false });

  if (error) {
    console.error('Error en fetchViajesConFiltros:', error);
    throw error;
  }

  // Procesar los datos para obtener la estructura correcta
  return (data as ViajeWithRelations[]).map((viaje, index) => {
    // Acceder al primer elemento del array de relaciones
    const operadorNombre = viaje.operador?.[0]?.nombre || 'No asignado';
    const materialNombre = viaje.material?.[0]?.nombre || 'No especificado';
    const m3Value = viaje.m3?.[0]?.metros_cubicos || 0;
    const precioValue = viaje.precio_origen_destino?.[0]?.precio_unidad || 0;
    const origen = viaje.precio_origen_destino?.[0]?.nombreorigen || '';
    const destino = viaje.precio_origen_destino?.[0]?.nombredestino || '';
    
    const totalViaje = viaje.caphrsviajes || (m3Value * precioValue);

    return {
      id: viaje.id,
      fecha: viaje.fecha,
      folio: viaje.folio || '',
      folio_bco: viaje.folio_bco || '',
      material: materialNombre,
      m3: m3Value,
      precio: precioValue,
      operador: operadorNombre,
      total_viaje: totalViaje,
      numero_viaje: index + 1,
      origen: origen,
      destino: destino
    };
  });
};

// Función corregida para obtener opciones de filtros
export const fetchOpcionesFiltros = async () => {
  try {
    // Obtener operadores únicos
    const { data: operadoresData } = await supabase
      .from('operador')
      .select('nombre')
      .not('nombre', 'is', null)
      .order('nombre');

    // Obtener materiales únicos
    const { data: materialesData } = await supabase
      .from('material')
      .select('nombre')
      .not('nombre', 'is', null)
      .order('nombre');

    // Obtener orígenes únicos
    const { data: origenesData } = await supabase
      .from('precio_origen_destino')
      .select('nombreorigen')
      .not('nombreorigen', 'is', null)
      .order('nombreorigen');

    // Obtener destinos únicos
    const { data: destinosData } = await supabase
      .from('precio_origen_destino')
      .select('nombredestino')
      .not('nombredestino', 'is', null)
      .order('nombredestino');

    const operadoresUnicos = operadoresData
      ?.map(op => op.nombre)
      .filter((nombre): nombre is string => !!nombre && nombre.trim() !== '') 
      || [];

    const materialesUnicos = materialesData
      ?.map(mat => mat.nombre)
      .filter((nombre): nombre is string => !!nombre && nombre.trim() !== '')
      || [];

    const origenesUnicos = origenesData
      ?.map(origen => origen.nombreorigen)
      .filter((nombre): nombre is string => !!nombre && nombre.trim() !== '')
      || [];

    const destinosUnicos = destinosData
      ?.map(destino => destino.nombredestino)
      .filter((nombre): nombre is string => !!nombre && nombre.trim() !== '')
      || [];

    return {
      operadores: operadoresUnicos,
      materiales: materialesUnicos,
      origenes: origenesUnicos,   
      destinos: destinosUnicos     
    };
  } catch (error) {
    console.error('Error en fetchOpcionesFiltros:', error);
    return {
      operadores: [],
      materiales: [],
      origenes: [],    
      destinos: []     
    };
  }
};

// Versión alternativa si las relaciones no funcionan
// export const fetchViajesConFiltrosSimple = async (filtros: FiltrosEstimacion): Promise<ViajeEstimacion[]> => {
//   let query = supabase
//     .from('viajes')
//     .select(`
//       id,
//       fecha,
//       folio,
//       folio_bco,
//       caphrsviajes,
//       id_operador,
//       id_material,
//       id_m3,
//       id_precio_origen_destino
//     `);

//   // Aplicar filtros
//   if (filtros.fechaInicio) {
//     query = query.gte('fecha', filtros.fechaInicio.toISOString().split('T')[0]);
//   }
//   if (filtros.fechaFin) {
//     query = query.lte('fecha', filtros.fechaFin.toISOString().split('T')[0]);
//   }
//   if (filtros.clienteId) {
//     query = query.eq('id_cliente', filtros.clienteId);
//   }

//   const { data, error } = await query.order('fecha', { ascending: false });

//   if (error) {
//     console.error('Error en fetchViajesConFiltros:', error);
//     throw error;
//   }

//   // Obtener datos de las relaciones por separado
//   const viajesConRelaciones = await Promise.all(
//     (data || []).map(async (viaje) => {
//       // Obtener operador
//       let operadorNombre = 'No asignado';
//       if (viaje.id_operador) {
//         const { data: operador } = await supabase
//           .from('operador')
//           .select('nombre')
//           .eq('id', viaje.id_operador)
//           .single();
//         operadorNombre = operador?.nombre || 'No asignado';
//       }

//       // Obtener material
//       let materialNombre = 'No especificado';
//       if (viaje.id_material) {
//         const { data: material } = await supabase
//           .from('material')
//           .select('nombre')
//           .eq('id', viaje.id_material)
//           .single();
//         materialNombre = material?.nombre || 'No especificado';
//       }

//       // Obtener m3
//       let m3Value = 0;
//       if (viaje.id_m3) {
//         const { data: m3 } = await supabase
//           .from('m3')
//           .select('metros_cubicos')
//           .eq('id', viaje.id_m3)
//           .single();
//         m3Value = m3?.metros_cubicos || 0;
//       }

//       // Obtener precio, origen y destino
//       let precioValue = 0;
//       let origen = '';
//       let destino = '';
//       if (viaje.id_precio_origen_destino) {
//         const { data: precio } = await supabase
//           .from('precio_origen_destino')
//           .select('precio_unidad, nombreorigen, nombredestino')
//           .eq('id', viaje.id_precio_origen_destino)
//           .single();
//         precioValue = precio?.precio_unidad || 0;
//         origen = precio?.nombreorigen || '';
//         destino = precio?.nombredestino || '';
//       }

//       return {
//         id: viaje.id,
//         fecha: viaje.fecha,
//         folio: viaje.folio || '',
//         folio_bco: viaje.folio_bco || '',
//         material: materialNombre,
//         m3: m3Value,
//         precio: precioValue,
//         operador: operadorNombre,
//         total_viaje: viaje.caphrsviajes || (m3Value * precioValue),
//         origen: origen,
//         destino: destino
//       };
//     })
//   );

//   // Agregar números de viaje
//   return viajesConRelaciones.map((viaje, index) => ({
//     ...viaje,
//     numero_viaje: index + 1
//   }));
// };

// export const fetchViajesConFiltrosOptimizado = async (filtros: FiltrosEstimacion): Promise<ViajeEstimacion[]> => {
//   // 1. Obtener todos los viajes de una sola vez
//   let query = supabase
//     .from('viajes')
//     .select(`
//       id,
//       fecha,
//       folio,
//       folio_bco,
//       caphrsviajes,
//       id_operador,
//       id_material,
//       id_m3,
//       id_precio_origen_destino
//     `);

//   // Aplicar filtros
//   if (filtros.fechaInicio) {
//     query = query.gte('fecha', filtros.fechaInicio.toISOString().split('T')[0]);
//   }
//   if (filtros.fechaFin) {
//     query = query.lte('fecha', filtros.fechaFin.toISOString().split('T')[0]);
//   }
//   if (filtros.clienteId) {
//     query = query.eq('id_cliente', filtros.clienteId);
//   }

//   const { data: viajes, error } = await query.order('fecha', { ascending: false });

//   if (error) {
//     console.error('Error en fetchViajesConFiltros:', error);
//     throw error;
//   }

//   if (!viajes || viajes.length === 0) {
//     return [];
//   }

//   // 2. Obtener TODOS los IDs únicos de las relaciones (sin usar Set con spread)
//   const operadoresIds = viajes.map(v => v.id_operador).filter(Boolean);
//   const materialesIds = viajes.map(v => v.id_material).filter(Boolean);
//   const m3Ids = viajes.map(v => v.id_m3).filter(Boolean);
//   const precioIds = viajes.map(v => v.id_precio_origen_destino).filter(Boolean);

//   // Función auxiliar para obtener valores únicos sin usar Set
//   const getUniqueIds = (ids: number[]): number[] => {
//     return ids.filter((id, index, array) => array.indexOf(id) === index);
//   };

//   const operadoresIdsUnicos = getUniqueIds(operadoresIds);
//   const materialesIdsUnicos = getUniqueIds(materialesIds);
//   const m3IdsUnicos = getUniqueIds(m3Ids);
//   const precioIdsUnicos = getUniqueIds(precioIds);

//   // 3. Hacer solo 4 consultas masivas en lugar de cientos individuales
//   const promises = [];

//   if (operadoresIdsUnicos.length > 0) {
//     promises.push(supabase.from('operador').select('id, nombre').in('id', operadoresIdsUnicos));
//   } else {
//     promises.push(Promise.resolve({ data: [] }));
//   }

//   if (materialesIdsUnicos.length > 0) {
//     promises.push(supabase.from('material').select('id, nombre').in('id', materialesIdsUnicos));
//   } else {
//     promises.push(Promise.resolve({ data: [] }));
//   }

//   if (m3IdsUnicos.length > 0) {
//     promises.push(supabase.from('m3').select('id, metros_cubicos').in('id', m3IdsUnicos));
//   } else {
//     promises.push(Promise.resolve({ data: [] }));
//   }

//   if (precioIdsUnicos.length > 0) {
//     promises.push(supabase.from('precio_origen_destino').select('id, precio_unidad, nombreorigen, nombredestino').in('id', precioIdsUnicos));
//   } else {
//     promises.push(Promise.resolve({ data: [] }));
//   }

//   const results = await Promise.all(promises);

//   const operadoresData = results[0].data || [];
//   const materialesData = results[1].data || [];
//   const m3Data = results[2].data || [];
//   const preciosData = results[3].data || [];

//   // 4. Crear mapas para búsqueda rápida
//   const operadoresMap = new Map();
//   operadoresData.forEach(op => {
//     if ('nombre' in op) {
//       operadoresMap.set(op.id, op.nombre);
//     }
//   });

//   const materialesMap = new Map();
//   materialesData.forEach(mat => {
//     if ('nombre' in mat) {
//       materialesMap.set(mat.id, mat.nombre);
//     }
//   });

//   const m3Map = new Map();
//   m3Data.forEach(m3 => {
//     if ('metros_cubicos' in m3) {
//       m3Map.set(m3.id, m3.metros_cubicos);
//     }
//   });

//   const preciosMap = new Map();
//   preciosData.forEach(precio => {
//     if ('precio_unidad' in precio && 'nombreorigen' in precio && 'nombredestino' in precio) {
//       preciosMap.set(precio.id, {
//         precio_unidad: precio.precio_unidad,
//         nombreorigen: precio.nombreorigen,
//         nombredestino: precio.nombredestino
//       });
//     }
//   });

//   // 5. Procesar todos los viajes usando los mapas (operación local súper rápida)
//   return viajes.map((viaje, index) => {
//     const operadorNombre = viaje.id_operador ? operadoresMap.get(viaje.id_operador) || 'No asignado' : 'No asignado';
//     const materialNombre = viaje.id_material ? materialesMap.get(viaje.id_material) || 'No especificado' : 'No especificado';
//     const m3Value = viaje.id_m3 ? m3Map.get(viaje.id_m3) || 0 : 0;
    
//     const precioInfo = viaje.id_precio_origen_destino ? preciosMap.get(viaje.id_precio_origen_destino) : null;
//     const precioValue = precioInfo?.precio_unidad || 0;
//     const origen = precioInfo?.nombreorigen || '';
//     const destino = precioInfo?.nombredestino || '';

//     const totalViaje = viaje.caphrsviajes || (m3Value * precioValue);

//     return {
//       id: viaje.id,
//       fecha: viaje.fecha,
//       folio: viaje.folio || '',
//       folio_bco: viaje.folio_bco || '',
//       material: materialNombre,
//       m3: m3Value,
//       precio: precioValue,
//       operador: operadorNombre,
//       total_viaje: totalViaje,
//       numero_viaje: index + 1,
//       origen: origen,
//       destino: destino
//     };
//   });
// };

export const fetchViajesConFiltrosOptimizado = async (filtros: FiltrosEstimacion): Promise<ViajeEstimacion[]> => {
  // 1. Obtener todos los viajes de una sola vez
  let query = supabase
    .from('viajes')
    .select(`
      id,
      fecha,
      folio,
      folio_bco,
      caphrsviajes,
      id_operador,
      id_material,
      id_m3,
      id_precio_origen_destino,
      estatus
    `);

  // Aplicar filtros
  if (filtros.fechaInicio) {
    query = query.gte('fecha', filtros.fechaInicio.toISOString().split('T')[0]);
  }
  if (filtros.fechaFin) {
    query = query.lte('fecha', filtros.fechaFin.toISOString().split('T')[0]);
  }
  if (filtros.clienteId) {
    query = query.eq('id_cliente', filtros.clienteId);
  }
  // "__sin_estatus__" es el valor especial para filtrar los viajes sin estatus asignado (null)
  if (filtros.estatus === '__sin_estatus__') {
    query = query.is('estatus', null);
  } else if (filtros.estatus) {
    query = query.eq('estatus', filtros.estatus);
  }

  const { data: viajes, error } = await query.order('fecha', { ascending: false });

  if (error) {
    console.error('Error en fetchViajesConFiltros:', error);
    throw error;
  }

  if (!viajes || viajes.length === 0) {
    return [];
  }

  // 2. Obtener TODOS los IDs únicos de las relaciones
  const operadoresIds: number[] = [];
  const materialesIds: number[] = [];
  const m3Ids: number[] = [];
  const precioIds: number[] = [];

  viajes.forEach(v => {
    if (v.id_operador) operadoresIds.push(v.id_operador);
    if (v.id_material) materialesIds.push(v.id_material);
    if (v.id_m3) m3Ids.push(v.id_m3);
    if (v.id_precio_origen_destino) precioIds.push(v.id_precio_origen_destino);
  });

  // Función auxiliar para obtener IDs únicos
  const getUniqueIds = (ids: number[]): number[] => {
    const unique: number[] = [];
    ids.forEach(id => {
      if (!unique.includes(id)) {
        unique.push(id);
      }
    });
    return unique;
  };

  const operadoresIdsUnicos = getUniqueIds(operadoresIds);
  const materialesIdsUnicos = getUniqueIds(materialesIds);
  const m3IdsUnicos = getUniqueIds(m3Ids);
  const precioIdsUnicos = getUniqueIds(precioIds);

  // 3. Hacer consultas separadas en lugar de Promise.all
  let operadoresData: any[] = [];
  let materialesData: any[] = [];
  let m3Data: any[] = [];
  let preciosData: any[] = [];

  try {
    // Consulta de operadores
    if (operadoresIdsUnicos.length > 0) {
      const { data, error } = await supabase
        .from('operador')
        .select('id, nombre')
        .in('id', operadoresIdsUnicos);
      
      if (!error) {
        operadoresData = data || [];
      }
    }

    // Consulta de materiales
    if (materialesIdsUnicos.length > 0) {
      const { data, error } = await supabase
        .from('material')
        .select('id, nombre')
        .in('id', materialesIdsUnicos);
      
      if (!error) {
        materialesData = data || [];
      }
    }

    // Consulta de m3
    if (m3IdsUnicos.length > 0) {
      const { data, error } = await supabase
        .from('m3')
        .select('id, metros_cubicos')
        .in('id', m3IdsUnicos);
      
      if (!error) {
        m3Data = data || [];
      }
    }

    // Consulta de precios
    if (precioIdsUnicos.length > 0) {
      const { data, error } = await supabase
        .from('precio_origen_destino')
        .select('id, precio_unidad, nombreorigen, nombredestino')
        .in('id', precioIdsUnicos);
      
      if (!error) {
        preciosData = data || [];
      }
    }
  } catch (error) {
    console.error('Error obteniendo datos relacionados:', error);
  }

  // 4. Crear mapas para búsqueda rápida
  const operadoresMap = new Map();
  const materialesMap = new Map();
  const m3Map = new Map();
  const preciosMap = new Map();

  operadoresData.forEach(op => {
    if (op && op.id && op.nombre) {
      operadoresMap.set(op.id, op.nombre);
    }
  });

  materialesData.forEach(mat => {
    if (mat && mat.id && mat.nombre) {
      materialesMap.set(mat.id, mat.nombre);
    }
  });

  m3Data.forEach(m3 => {
    if (m3 && m3.id && m3.metros_cubicos !== undefined) {
      m3Map.set(m3.id, m3.metros_cubicos);
    }
  });

  preciosData.forEach(precio => {
    if (precio && precio.id && precio.precio_unidad !== undefined) {
      preciosMap.set(precio.id, {
        precio_unidad: precio.precio_unidad,
        nombreorigen: precio.nombreorigen || '',
        nombredestino: precio.nombredestino || ''
      });
    }
  });

  // 5. Procesar todos los viajes usando los mapas
  return viajes.map((viaje, index) => {
    const operadorNombre = viaje.id_operador ? operadoresMap.get(viaje.id_operador) || 'No asignado' : 'No asignado';
    const materialNombre = viaje.id_material ? materialesMap.get(viaje.id_material) || 'No especificado' : 'No especificado';
    const m3Value = viaje.id_m3 ? m3Map.get(viaje.id_m3) || 0 : 0;
    
    const precioInfo = viaje.id_precio_origen_destino ? preciosMap.get(viaje.id_precio_origen_destino) : null;
    const precioValue = precioInfo?.precio_unidad || 0;
    const origen = precioInfo?.nombreorigen || '';
    const destino = precioInfo?.nombredestino || '';

    const totalViaje = viaje.caphrsviajes || (m3Value * precioValue);

    return {
      id: viaje.id,
      fecha: viaje.fecha,
      folio: viaje.folio || '',
      folio_bco: viaje.folio_bco || '',
      material: materialNombre,
      m3: m3Value,
      precio: precioValue,
      operador: operadorNombre,
      total_viaje: totalViaje,
      numero_viaje: index + 1,
      origen: origen,
      destino: destino,
      estatus: (viaje as any).estatus ?? null
    };
  });
};

// export const exportarEstimacionExcel = async (
//   viajes: ViajeEstimacion[], 
//   cliente: EstimacionCliente, 
//   filtros: FiltrosEstimacion
// ) => {
//   try {
//     const wb = XLSX.utils.book_new();
    
//     // ===== HOJA 1: RESUMEN PROFESIONAL =====
//     const datosResumen = [
//       // Fila 1: Logo (vacío) y Nombre de la empresa
//       ['', '', 'TRANSPORTES, TERRACERÍAS Y AGREGADOS', '', '', '', '', ''],
//       // Fila 2: Nombre legal de la empresa
//       ['', '', 'FC S.A. DE C.V.', '', '', '', '', ''],
//       // Fila 3: Línea separadora
//       ['', '', '', '', '', '', '', ''],
//       // Fila 4: Dirección y contactos (primera línea)
//       ['DIR SM 60 MZA 8 LOTE 14  TEL. CEL 9981 269 999 Y  9982 270 461', '', '', '', '', 'OFICINA (998) 3106877', '', ''],
//       // Fila 5: Correos electrónicos
//       ['isfloca@hotmail.com, t_flores2010@hotmail.com', '', '', '', '', '', '', ''],
//       // Fila 6: Línea separadora
//       ['', '', '', '', '', '', '', ''],
//       // Fila 7: Encabezado de estimación
//       ['ESTIMACION NO:', '', '', 'CLIENTE:', cliente.cliente_nombre, '', '', ''],
//       // Fila 8: Obra y fecha
//       ['OBRA:', cliente.obra || 'No especificada', '', 'FECHA:', new Date().toLocaleDateString('es-MX'), '', '', ''],
//       // Fila 9: Responsable y ubicación
//       ['RESPONSABLE:', cliente.contacto || 'No especificado', '', 'UBICACIÓN:', '', '', '', ''],
//       // Fila 10: Concepto
//       ['CONCEPTO:', '', '', '', '', '', '', ''],
//       // Fila 11: Espacio
//       ['', '', '', '', '', '', '', ''],
//       // Fila 12: Encabezados de tabla de conceptos
//       ['No', 'CONCEPTO', 'UNIDAD', 'CANTIDAD', 'X HORA', '$ P.U', 'IMPORTE', ''],
//     ];

//     // Calcular totales
//     const totalViajes = viajes.length;
//     const totalM3 = viajes.reduce((sum, viaje) => sum + viaje.m3, 0);
//     const totalCobrar = viajes.reduce((sum, viaje) => sum + viaje.total_viaje, 0);
//     const iva = totalCobrar * 0.16; // 16% de IVA
//     const totalConIva = totalCobrar + iva;

//     // Agregar datos de viajes como conceptos
//     viajes.forEach((viaje, index) => {
//       datosResumen.push([
//         (index + 1).toString(),
//         `VIAJE ${viaje.folio || viaje.id} - ${viaje.material || 'Material'} de ${viaje.origen || ''} a ${viaje.destino || ''}`,
//         'VIAJE',
//         '1',
//         '',
//         viaje.precio.toString(),
//         viaje.total_viaje.toString(),
//         ''
//       ]);
//     });

//     // Agregar línea de total M3 si aplica
//     if (totalM3 > 0) {
//       datosResumen.push([
//         (totalViajes + 1).toString(),
//         `TOTAL METROS CÚBICOS (${totalViajes} viajes)`,
//         'M3',
//         totalM3.toFixed(2),
//         '',
//         '',
//         totalCobrar.toString(),
//         ''
//       ]);
//     }

//     // Agregar espacio antes de totales
//     datosResumen.push(['', '', '', '', '', '', '', '']);
    
//     // Agregar subtotal, IVA y TOTAL
//     datosResumen.push(['', '', '', '', '', 'SUB TOTAL', totalCobrar.toString(), '']);
//     datosResumen.push(['', '', '', '', '', 'IVA', iva.toString(), '']);
//     datosResumen.push(['', '', '', '', '', 'TOTAL', totalConIva.toString(), '']);

//     // Crear hoja con los datos
//     const wsResumen = XLSX.utils.aoa_to_sheet(datosResumen);
    
//     // ===== APLICAR FORMATOS Y ESTILOS =====
    
//     // 1. Combinar celdas para encabezados
//     if (wsResumen['!merges'] === undefined) wsResumen['!merges'] = [];
    
//     // Nombre de empresa (combinar horizontalmente)
//     wsResumen['!merges'].push({ s: { r: 0, c: 2 }, e: { r: 0, c: 7 } }); // Línea 1: TRANSPORTES...
//     wsResumen['!merges'].push({ s: { r: 1, c: 2 }, e: { r: 1, c: 7 } }); // Línea 2: FC S.A. DE C.V.
    
//     // Dirección y contactos
//     wsResumen['!merges'].push({ s: { r: 3, c: 0 }, e: { r: 3, c: 4 } }); // Dirección y teléfonos
//     wsResumen['!merges'].push({ s: { r: 3, c: 5 }, e: { r: 3, c: 7 } }); // Oficina
//     wsResumen['!merges'].push({ s: { r: 4, c: 0 }, e: { r: 4, c: 7 } }); // Correos
    
//     // Información del cliente
//     wsResumen['!merges'].push({ s: { r: 6, c: 4 }, e: { r: 6, c: 7 } }); // Cliente
//     wsResumen['!merges'].push({ s: { r: 7, c: 4 }, e: { r: 7, c: 7 } }); // Fecha
//     wsResumen['!merges'].push({ s: { r: 8, c: 4 }, e: { r: 8, c: 7 } }); // Ubicación
//     wsResumen['!merges'].push({ s: { r: 9, c: 1 }, e: { r: 9, c: 7 } }); // Concepto
    
//     // 2. Definir anchos de columna (en caracteres)
//     wsResumen['!cols'] = [
//       { wch: 5 },   // Columna A: No (5 caracteres)
//       { wch: 40 },  // Columna B: CONCEPTO (40 caracteres)
//       { wch: 10 },  // Columna C: UNIDAD (10 caracteres)
//       { wch: 10 },  // Columna D: CANTIDAD (10 caracteres)
//       { wch: 10 },  // Columna E: X HORA (10 caracteres)
//       { wch: 12 },  // Columna F: $ P.U (12 caracteres)
//       { wch: 15 },  // Columna G: IMPORTE (15 caracteres)
//       { wch: 2 }    // Columna H: Espacio (2 caracteres)
//     ];
    
//     XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
    
//     // ===== HOJA 2: DETALLE DE VIAJES (se mantiene igual) =====
//     const datosViajes = [
//       ['No. Viaje', 'Fecha', 'Folio', 'Folio BCO', 'Origen', 'Destino', 'Material', 'Operador', 'M3', 'Precio Unitario', 'Total Viaje']
//     ];
    
//     viajes.forEach(viaje => {
//       datosViajes.push([
//         viaje.numero_viaje !== undefined ? viaje.numero_viaje.toString() : '',
//         viaje.fecha ? new Date(viaje.fecha).toLocaleDateString('es-MX') : '',
//         viaje.folio || '',
//         viaje.folio_bco || '',
//         viaje.origen || '',
//         viaje.destino || '',
//         viaje.material || '',
//         viaje.operador || '',
//         viaje.m3 ? viaje.m3.toFixed(2) : '',
//         formatCurrencyForExport(viaje.precio),
//         formatCurrencyForExport(viaje.total_viaje)
//       ]);
//     });
    
//     // Totales
//     datosViajes.push([
//       'TOTALES',
//       '', '', '', '', '', '', '',
//       totalM3.toFixed(2),
//       '',
//       formatCurrencyForExport(totalCobrar)
//     ]);
    
//     const wsViajes = XLSX.utils.aoa_to_sheet(datosViajes);
//     XLSX.utils.book_append_sheet(wb, wsViajes, 'Viajes Detallados');
    
//     // ===== HOJA 3: RESUMEN POR MATERIAL (se mantiene igual) =====
//     const materialesMap = new Map();
//     viajes.forEach(viaje => {
//       const material = viaje.material || 'No especificado';
//       if (materialesMap.has(material)) {
//         const current = materialesMap.get(material);
//         materialesMap.set(material, {
//           viajes: current.viajes + 1,
//           m3: current.m3 + viaje.m3,
//           total: current.total + viaje.total_viaje
//         });
//       } else {
//         materialesMap.set(material, {
//           viajes: 1,
//           m3: viaje.m3,
//           total: viaje.total_viaje
//         });
//       }
//     });
    
//     const datosMateriales = [
//       ['RESUMEN POR MATERIAL'],
//       [''],
//       ['Material', 'Cantidad de Viajes', 'Total M3', 'Total a Cobrar']
//     ];
    
//     Array.from(materialesMap.entries()).forEach(([material, datos]) => {
//       datosMateriales.push([
//         material,
//         datos.viajes,
//         datos.m3.toFixed(2),
//         formatCurrencyForExport(datos.total)
//       ]);
//     });
    
//     // Total general
//     datosMateriales.push([
//       'TOTAL GENERAL',
//       totalViajes.toString(),
//       totalM3.toFixed(2),
//       formatCurrencyForExport(totalCobrar)
//     ]);
    
//     const wsMateriales = XLSX.utils.aoa_to_sheet(datosMateriales);
//     XLSX.utils.book_append_sheet(wb, wsMateriales, 'Resumen por Material');
    
//     // Generar nombre de archivo
//     const fileName = `Estimacion_${cliente.cliente_nombre.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
//     // Descargar archivo
//     XLSX.writeFile(wb, fileName);
    
//     return true;
//   } catch (error) {
//     console.error('Error al exportar estimación a Excel:', error);
//     throw error;
//   }
// };

// =============================================
// COLUMNAS PERSONALIZABLES DE LA HOJA "VIAJES DETALLADOS"
// =============================================
interface DefinicionColumnaExportacion {
  header: string;
  width: number;
  getValue: (viaje: ViajeEstimacion, index: number) => string | number;
}

const DEFINICIONES_COLUMNAS: Record<string, DefinicionColumnaExportacion> = {
  numero_viaje: { header: 'No. Viaje', width: 10, getValue: (v, i) => v.numero_viaje || i + 1 },
  fecha: { header: 'Fecha', width: 12, getValue: (v) => v.fecha ? new Date(v.fecha).toLocaleDateString('es-MX') : '' },
  folio: { header: 'Folio', width: 12, getValue: (v) => v.folio || '' },
  folio_bco: { header: 'Folio BCO', width: 12, getValue: (v) => v.folio_bco || '' },
  origen: { header: 'Origen', width: 20, getValue: (v) => v.origen || '' },
  destino: { header: 'Destino', width: 20, getValue: (v) => v.destino || '' },
  material: { header: 'Material', width: 15, getValue: (v) => v.material || '' },
  operador: { header: 'Operador', width: 20, getValue: (v) => v.operador || '' },
  horas_renta: { header: 'Hrs Renta', width: 12, getValue: (v) => v.horas_renta || 0 },
  m3: { header: 'M3', width: 10, getValue: (v) => Number(v.m3.toFixed(2)) },
  precio: { header: 'Precio Unitario', width: 15, getValue: (v) => formatCurrencyForExport(v.precio) },
  total_viaje: { header: 'Total Viaje', width: 15, getValue: (v) => formatCurrencyForExport(v.total_viaje) }
};

// Orden y selección de columnas que se usa cuando no se personaliza la exportación
export const COLUMNAS_EXPORTACION_ESTANDAR = [
  'numero_viaje', 'fecha', 'folio', 'folio_bco', 'origen', 'destino', 'material', 'operador', 'm3', 'precio', 'total_viaje'
];

// Catálogo de columnas disponibles para que el usuario elija/ordene en el diálogo de exportación
export const COLUMNAS_DISPONIBLES_EXPORTACION = Object.entries(DEFINICIONES_COLUMNAS).map(([key, def]) => ({
  key,
  label: def.header
}));

export interface OpcionesExportacionExcel {
  columnas?: string[]; // claves de DEFINICIONES_COLUMNAS, en el orden en que deben aparecer
  incluirResumen?: boolean;
  incluirDetalle?: boolean;
  incluirResumenPorMaterial?: boolean;
}

// =============================================
// CONFIGURACIONES DE EXPORTACIÓN GUARDADAS (por cliente, ej. "Exportación CEMEX")
// =============================================
export interface ConfiguracionExportacion {
  id?: number;
  nombre: string;
  columnas: string[];
  incluir_resumen: boolean;
  incluir_detalle: boolean;
  incluir_resumen_material: boolean;
  created_at?: string;
}

const transformConfiguracionExportacionData = (row: any): ConfiguracionExportacion => ({
  id: row.id,
  nombre: row.nombre,
  columnas: row.columnas ?? COLUMNAS_EXPORTACION_ESTANDAR,
  incluir_resumen: row.incluir_resumen,
  incluir_detalle: row.incluir_detalle,
  incluir_resumen_material: row.incluir_resumen_material,
  created_at: row.created_at
});

export const fetchConfiguracionesExportacion = async (): Promise<ConfiguracionExportacion[]> => {
  const { data, error } = await supabase
    .from('estimaciones_config_exportacion')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) throw error;
  return (data || []).map(transformConfiguracionExportacionData);
};

export const guardarConfiguracionExportacion = async (
  config: Omit<ConfiguracionExportacion, 'id' | 'created_at'>
): Promise<ConfiguracionExportacion> => {
  const { data, error } = await supabase
    .from('estimaciones_config_exportacion')
    .insert([config])
    .select()
    .single();

  if (error) throw error;
  return transformConfiguracionExportacionData(data);
};

export const eliminarConfiguracionExportacion = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('estimaciones_config_exportacion')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// =============================================
// FUNCIÓN PRINCIPAL DE EXPORTACIÓN CON EXCELJS
// =============================================
// Variable global para el número consecutivo de estimación
let contadorEstimacion = 1;

export const exportarEstimacionExcel = async (
  viajes: ViajeEstimacion[],
  cliente: EstimacionCliente,
  filtros: FiltrosEstimacion,
  logoBase64?: string, // Opcional: logo en base64
  opcionesExportacion?: OpcionesExportacionExcel
) => {
  const incluirResumen = opcionesExportacion?.incluirResumen ?? true;
  const incluirDetalle = opcionesExportacion?.incluirDetalle ?? true;
  const incluirResumenPorMaterial = opcionesExportacion?.incluirResumenPorMaterial ?? true;
  const columnasSeleccionadas = (opcionesExportacion?.columnas && opcionesExportacion.columnas.length > 0)
    ? opcionesExportacion.columnas
    : COLUMNAS_EXPORTACION_ESTANDAR;
  try {
    // Crear nuevo libro de Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Estimaciones - Tsa';
    workbook.created = new Date();
    
    // Calcular totales (se usan en varias hojas)
    const totalViajes = viajes.length;
    const totalM3 = viajes.reduce((sum, viaje) => sum + viaje.m3, 0);
    const totalCobrar = viajes.reduce((sum, viaje) => sum + viaje.total_viaje, 0);
    const iva = totalCobrar * 0.16; // 16% de IVA
    const totalConIva = totalCobrar + iva;

    // Agrupar viajes por material (se usa en Resumen y Resumen por Material)
    const materialesMap = new Map<string, { viajes: number, m3: number, precioPromedio: number, total: number }>();
    viajes.forEach(viaje => {
      const material = viaje.material || 'No especificado';
      if (materialesMap.has(material)) {
        const current = materialesMap.get(material)!;
        materialesMap.set(material, {
          viajes: current.viajes + 1,
          m3: current.m3 + viaje.m3,
          precioPromedio: ((current.precioPromedio * current.viajes) + viaje.precio) / (current.viajes + 1),
          total: current.total + viaje.total_viaje
        });
      } else {
        materialesMap.set(material, {
          viajes: 1,
          m3: viaje.m3,
          precioPromedio: viaje.precio,
          total: viaje.total_viaje
        });
      }
    });

    // ===== HOJA 1: RESUMEN PROFESIONAL =====
    if (incluirResumen) {
    const worksheet = workbook.addWorksheet('Resumen');

    // 1. AGREGAR LOGO (si se proporciona)
    let startRow = 1; // Fila inicial (1-based en ExcelJS)
    
    if (logoBase64) {
      try {
        // Determinar extensión del archivo
        let extension: 'png' | 'jpeg' | 'gif' = 'png';
        if (logoBase64.includes('image/jpeg') || logoBase64.includes('image/jpg')) {
          extension = 'jpeg';
        }
        
        const logoId = workbook.addImage({
          base64: logoBase64.split(',')[1], // Remover el data:image/...;base64,
          extension: extension,
        });
        
        // Agregar imagen con coordenadas simples
        worksheet.addImage(logoId, 'A1:C4');
        startRow = 6; // Dejar espacio después del logo
      } catch (error) {
        console.warn('No se pudo agregar el logo:', error);
        // Continuar sin logo
      }
    }

    // 2. ENCABEZADO DE LA EMPRESA (SIN BORDES)
    // Fila 1: Nombre principal
    const row1 = worksheet.getRow(startRow);
    row1.getCell(3).value = 'TRANSPORTES, TERRACERÍAS Y AGREGADOS';
    row1.getCell(3).font = { 
      bold: true, 
      size: 14, 
      color: { argb: 'FF0000' } // Rojo
    };
    row1.getCell(3).alignment = { horizontal: 'center' };
    worksheet.mergeCells(startRow, 3, startRow, 8); // Combinar C a H
    
    // Fila 2: Nombre legal
    const row2 = worksheet.getRow(startRow + 1);
    row2.getCell(3).value = 'FC S.A. DE C.V.';
    row2.getCell(3).font = { 
      bold: true, 
      size: 12, 
      color: { argb: 'FF0000' } // Rojo
    };
    row2.getCell(3).alignment = { horizontal: 'center' };
    worksheet.mergeCells(startRow + 1, 3, startRow + 1, 8);
    
    // Fila 4: Dirección y teléfonos
    const row4 = worksheet.getRow(startRow + 3);
    row4.getCell(1).value = 'DIR: SM 60 MZA 8 LOTE 14  TEL. CEL 9981 269 999 Y  9982 270 461';
    row4.getCell(6).value = 'OFICINA TEL: (998) 3106877';
    row4.getCell(1).font = { size: 10 };
    row4.getCell(6).font = { size: 10 };
    worksheet.mergeCells(startRow + 3, 1, startRow + 3, 5); // Combinar A-E
    worksheet.mergeCells(startRow + 3, 6, startRow + 3, 8); // Combinar F-H
    
    // Fila 5: Correos
    const row5 = worksheet.getRow(startRow + 4);
    row5.getCell(1).value = 'isfloca@hotmail.com, t_flores2010@hotmail.com';
    row5.getCell(1).font = { size: 10 };
    worksheet.mergeCells(startRow + 4, 1, startRow + 4, 8);
    
    // 3. INFORMACIÓN DE LA ESTIMACIÓN (CON BORDES)
    const infoStartRow = startRow + 6;
    
    // ESTIMACION NO (NÚMERO CONSECUTIVO) y CLIENTE
    const rowEst = worksheet.getRow(infoStartRow);
    rowEst.getCell(1).value = 'ESTIMACION NO:';
    rowEst.getCell(4).value = 'CLIENTE:';
    rowEst.getCell(5).value = cliente.cliente_nombre;
    rowEst.getCell(3).value = contadorEstimacion++; // Número consecutivo
    rowEst.getCell(3).font = { bold: true };
    rowEst.getCell(1).font = { bold: true };
    rowEst.getCell(4).font = { bold: true };
    worksheet.mergeCells(infoStartRow, 5, infoStartRow, 8); // Cliente combinado
    
    // OBRA y FECHA
    const rowObra = worksheet.getRow(infoStartRow + 1);
    rowObra.getCell(1).value = 'OBRA:';
    rowObra.getCell(3).value = cliente.obra || 'No especificada';
    rowObra.getCell(4).value = 'FECHA:';
    rowObra.getCell(5).value = new Date().toLocaleDateString('es-MX');
    rowObra.getCell(1).font = { bold: true };
    rowObra.getCell(4).font = { bold: true };
    worksheet.mergeCells(infoStartRow + 1, 3, infoStartRow + 1, 3); // Obra
    worksheet.mergeCells(infoStartRow + 1, 5, infoStartRow + 1, 8); // Fecha
    
    // RESPONSABLE y UBICACIÓN
    const rowRes = worksheet.getRow(infoStartRow + 2);
    rowRes.getCell(1).value = 'RESPONSABLE:';
    rowRes.getCell(3).value = cliente.contacto || 'No especificado';
    rowRes.getCell(4).value = 'UBICACIÓN:';
    rowRes.getCell(5).value = '';
    rowRes.getCell(1).font = { bold: true };
    rowRes.getCell(4).font = { bold: true };
    worksheet.mergeCells(infoStartRow + 2, 3, infoStartRow + 2, 3); // Responsable
    worksheet.mergeCells(infoStartRow + 2, 5, infoStartRow + 2, 8); // Ubicación
    
    // CONCEPTO
    const rowConc = worksheet.getRow(infoStartRow + 3);
    rowConc.getCell(1).value = 'CONCEPTO:';
    rowConc.getCell(2).value = 'RESUMEN DE MATERIALES POR TIPO';
    rowConc.getCell(1).font = { bold: true };
    worksheet.mergeCells(infoStartRow + 3, 2, infoStartRow + 3, 8); // Concepto combinado
    
    // 4. TABLA DE CONCEPTOS - RESUMEN POR MATERIAL (CON BORDES COMPLETOS)
    const tableStartRow = infoStartRow + 5;
    
    // Encabezados de la tabla - MODIFICADO: Sin X HORA
    const headersRow = worksheet.getRow(tableStartRow);
    const headers = ['No', 'CONCEPTO', 'UNIDAD', 'CANTIDAD', '$ P.U', 'IMPORTE', '']; // Quitamos X HORA
    headers.forEach((header, index) => {
      const cell = headersRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F2F2F2' } // Gris claro
      };
    });
    
    // Datos del resumen por material
    let rowIndex = 0;
    Array.from(materialesMap.entries()).forEach(([material, datos], index) => {
      const dataRow = worksheet.getRow(tableStartRow + index + 1);
      
      // No (consecutivo)
      dataRow.getCell(1).value = index + 1;
      dataRow.getCell(1).alignment = { horizontal: 'center' };
      
      // CONCEPTO (nombre del material)
      dataRow.getCell(2).value = material;
      
      // UNIDAD (siempre M3)
      dataRow.getCell(3).value = 'M3';
      dataRow.getCell(3).alignment = { horizontal: 'center' };
      
      // CANTIDAD (total M3 de ese material)
      dataRow.getCell(4).value = datos.m3;
      dataRow.getCell(4).numFmt = '#,##0.00';
      dataRow.getCell(4).alignment = { horizontal: 'center' };
      
      // $ P.U (precio promedio)
      dataRow.getCell(5).value = datos.precioPromedio;
      dataRow.getCell(5).numFmt = '"$"#,##0.00';
      
      // IMPORTE (total de ese material)
      dataRow.getCell(6).value = datos.total;
      dataRow.getCell(6).numFmt = '"$"#,##0.00';
      
      // Espacio
      dataRow.getCell(7).value = '';
      
      rowIndex = index;
    });
    
    // Fila de TOTAL GENERAL (en negrita)
    const totalRowIndex = tableStartRow + rowIndex + 2;
    const totalGeneralRow = worksheet.getRow(totalRowIndex);
    
    // No (vacío para total)
    totalGeneralRow.getCell(1).value = '';
    
    // CONCEPTO (TOTAL GENERAL en negrita)
    totalGeneralRow.getCell(2).value = 'TOTAL GENERAL';
    totalGeneralRow.getCell(2).font = { bold: true };
    
    // UNIDAD (M3)
    totalGeneralRow.getCell(3).value = 'M3';
    totalGeneralRow.getCell(3).alignment = { horizontal: 'center' };
    totalGeneralRow.getCell(3).font = { bold: true };
    
    // CANTIDAD (total M3 de todos los materiales)
    totalGeneralRow.getCell(4).value = totalM3;
    totalGeneralRow.getCell(4).numFmt = '#,##0.00';
    totalGeneralRow.getCell(4).alignment = { horizontal: 'center' };
    totalGeneralRow.getCell(4).font = { bold: true };
    
    // $ P.U (vacío o promedio general si quieres)
    totalGeneralRow.getCell(5).value = '';
    
    // IMPORTE (total a cobrar)
    totalGeneralRow.getCell(6).value = totalCobrar;
    totalGeneralRow.getCell(6).numFmt = '"$"#,##0.00';
    totalGeneralRow.getCell(6).font = { bold: true };
    
    // Espacio
    totalGeneralRow.getCell(7).value = '';
    
    // 5. TOTALES (CON BORDES) - IVA y TOTAL FINAL
    const totalStartRow = totalRowIndex + 2;
    
    // SUBTOTAL
    const subRow = worksheet.getRow(totalStartRow);
    subRow.getCell(5).value = 'SUB TOTAL';
    subRow.getCell(6).value = totalCobrar;
    subRow.getCell(5).font = { bold: true };
    subRow.getCell(5).alignment = { horizontal: 'right' };
    subRow.getCell(6).font = { bold: true };
    subRow.getCell(6).numFmt = '"$"#,##0.00';
    
    // IVA
    const ivaRow = worksheet.getRow(totalStartRow + 1);
    ivaRow.getCell(5).value = 'IVA 16%';
    ivaRow.getCell(6).value = iva;
    ivaRow.getCell(5).font = { bold: true };
    ivaRow.getCell(5).alignment = { horizontal: 'right' };
    ivaRow.getCell(6).font = { bold: true };
    ivaRow.getCell(6).numFmt = '"$"#,##0.00';
    
    // TOTAL
    const totalFinalRow = worksheet.getRow(totalStartRow + 2);
    totalFinalRow.getCell(5).value = 'TOTAL';
    totalFinalRow.getCell(6).value = totalConIva;
    totalFinalRow.getCell(5).font = { bold: true, size: 12 };
    totalFinalRow.getCell(5).alignment = { horizontal: 'right' };
    totalFinalRow.getCell(6).font = { bold: true, size: 12 };
    totalFinalRow.getCell(6).numFmt = '"$"#,##0.00';
    
    // 6. APLICAR BORDES A TODA LA TABLA (desde infoStartRow hasta totalFinalRow)
    // Definir rango con bordes
    const borderStartRow = infoStartRow;
    const borderEndRow = totalStartRow + 2;
    const borderStartCol = 1; // A
    const borderEndCol = 7;   // G (ahora son 7 columnas)
    
    for (let row = borderStartRow; row <= borderEndRow; row++) {
      const worksheetRow = worksheet.getRow(row);
      
      for (let col = borderStartCol; col <= borderEndCol; col++) {
        const cell = worksheetRow.getCell(col);
        
        // Aplicar bordes negros a TODAS las celdas en este rango
        cell.border = {
          top: { style: 'thin', color: { argb: '000000' } },
          left: { style: 'thin', color: { argb: '000000' } },
          bottom: { style: 'thin', color: { argb: '000000' } },
          right: { style: 'thin', color: { argb: '000000' } }
        };
      }
    }
    
    // 7. QUITAR BORDES del encabezado de la empresa (primeras filas)
    for (let row = startRow; row < infoStartRow; row++) {
      const worksheetRow = worksheet.getRow(row);
      for (let col = 1; col <= 8; col++) {
        const cell = worksheetRow.getCell(col);
        cell.border = {}; // Sin bordes
      }
    }
    
    // 8. AJUSTAR ANCHOS DE COLUMNA (ahora 7 columnas)
    worksheet.columns = [
      { width: 8 },   // A: No (más estrecho)
      { width: 25 },  // B: CONCEPTO
      { width: 10 },  // C: UNIDAD
      { width: 12 },  // D: CANTIDAD (M3)
      { width: 12 },  // E: $ P.U
      { width: 15 },  // F: IMPORTE
      { width: 2 }    // G: Agregar otro en el futuro si es necesario
    ];
    
    // 9. AJUSTAR ALTURAS DE FILA
    worksheet.getRow(tableStartRow).height = 25; // Encabezados de tabla
    } // fin if (incluirResumen)

    // ===== HOJA 2: VIAJES DETALLADOS (columnas y orden personalizables) =====
    if (incluirDetalle) {
    const wsViajes = workbook.addWorksheet('Viajes Detallados');
    const columnasHoja2 = columnasSeleccionadas.filter(key => DEFINICIONES_COLUMNAS[key]);

    // Encabezados
    wsViajes.addRow(columnasHoja2.map(key => DEFINICIONES_COLUMNAS[key].header));

    // Aplicar estilo a encabezados
    const headerRowViajes = wsViajes.getRow(1);
    headerRowViajes.font = { bold: true };
    headerRowViajes.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'E6F3FF' } // Azul claro
    };

    // Datos
    viajes.forEach((viaje, index) => {
      wsViajes.addRow(columnasHoja2.map(key => DEFINICIONES_COLUMNAS[key].getValue(viaje, index)));
    });

    // Totales (solo se llenan las columnas de M3 y Total Viaje, si están presentes)
    const totalesPorColumna: Record<string, string> = {
      m3: totalM3.toFixed(2),
      total_viaje: formatCurrencyForExport(totalCobrar)
    };
    const totalRowViajes = wsViajes.addRow(columnasHoja2.map((key, idx) => {
      if (idx === 0) return 'TOTALES';
      return totalesPorColumna[key] ?? '';
    }));

    // Resaltar totales
    totalRowViajes.font = { bold: true };

    // Aplicar bordes a toda la hoja de viajes
    for (let i = 1; i <= wsViajes.rowCount; i++) {
      const row = wsViajes.getRow(i);
      for (let j = 1; j <= columnasHoja2.length; j++) {
        const cell = row.getCell(j);
        cell.border = {
          top: { style: 'thin', color: { argb: '000000' } },
          left: { style: 'thin', color: { argb: '000000' } },
          bottom: { style: 'thin', color: { argb: '000000' } },
          right: { style: 'thin', color: { argb: '000000' } }
        };
      }
    }

    // Ajustar anchos
    wsViajes.columns = columnasHoja2.map(key => ({ width: DEFINICIONES_COLUMNAS[key].width }));
    } // fin if (incluirDetalle)

    // ===== HOJA 3: RESUMEN POR MATERIAL =====
    if (incluirResumenPorMaterial) {
    const wsMateriales = workbook.addWorksheet('Resumen por Material');

    // Título
    wsMateriales.addRow(['RESUMEN POR MATERIAL']);
    wsMateriales.mergeCells('A1:E1');
    const titleRow = wsMateriales.getRow(1);
    titleRow.getCell(1).font = { bold: true, size: 14 };
    titleRow.getCell(1).alignment = { horizontal: 'center' };

    // Encabezados mejorados
    wsMateriales.addRow(['Material', 'Viajes', 'Total M3', 'Precio Promedio', 'Total a Cobrar']);
    const headerRowMat = wsMateriales.getRow(2);
    headerRowMat.font = { bold: true };
    headerRowMat.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'F2F2F2' }
    };

    // Datos del mapa de materiales
    Array.from(materialesMap.entries()).forEach(([material, datos]) => {
      wsMateriales.addRow([
        material,
        datos.viajes,
        datos.m3.toFixed(2),
        formatCurrencyForExport(datos.precioPromedio),
        formatCurrencyForExport(datos.total)
      ]);
    });

    // Total general
    const totalRowMat = wsMateriales.addRow([
      'TOTAL GENERAL',
      totalViajes,
      totalM3.toFixed(2),
      formatCurrencyForExport(totalCobrar / totalViajes), // Precio promedio general
      formatCurrencyForExport(totalCobrar)
    ]);
    totalRowMat.font = { bold: true };

    // Aplicar bordes
    for (let i = 1; i <= wsMateriales.rowCount; i++) {
      const row = wsMateriales.getRow(i);
      for (let j = 1; j <= 5; j++) {
        const cell = row.getCell(j);
        cell.border = {
          top: { style: 'thin', color: { argb: '000000' } },
          left: { style: 'thin', color: { argb: '000000' } },
          bottom: { style: 'thin', color: { argb: '000000' } },
          right: { style: 'thin', color: { argb: '000000' } }
        };
      }
    }

    // Ajustar anchos
    wsMateriales.columns = [
      { width: 25 }, { width: 10 }, { width: 15 }, { width: 18 }, { width: 20 }
    ];
    } // fin if (incluirResumenPorMaterial)

    if (workbook.worksheets.length === 0) {
      throw new Error('Debes incluir al menos una hoja en la exportación');
    }

    // 10. GENERAR Y DESCARGAR ARCHIVO
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Estimacion_${contadorEstimacion-1}_${cliente.cliente_nombre.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Error al exportar estimación a Excel:', error);
    throw error;
  }
};

// Función auxiliar para formatear currency en Excel
const formatCurrencyForExport = (value: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value);
};

// =============================================
// EXPORTACIÓN A EXCEL: RENTA DE MAQUINARIA (cliente con etiqueta "maquinaria")
// =============================================
export const exportarEstimacionMaquinariaExcel = async (
  rentas: RentaMaquinaria[],
  cliente: EstimacionCliente
): Promise<boolean> => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Estimaciones - Tsa';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Renta de Maquinaria');

    // 1. ENCABEZADO DE LA EMPRESA
    const row1 = worksheet.getRow(1);
    row1.getCell(2).value = 'TRANSPORTES, TERRACERÍAS Y AGREGADOS';
    row1.getCell(2).font = { bold: true, size: 14, color: { argb: 'FF0000' } };
    row1.getCell(2).alignment = { horizontal: 'center' };
    worksheet.mergeCells(1, 2, 1, 8);

    const row2 = worksheet.getRow(2);
    row2.getCell(2).value = 'FC S.A. DE C.V.';
    row2.getCell(2).font = { bold: true, size: 12, color: { argb: 'FF0000' } };
    row2.getCell(2).alignment = { horizontal: 'center' };
    worksheet.mergeCells(2, 2, 2, 8);

    // 2. INFORMACIÓN DE LA ESTIMACIÓN
    const infoStartRow = 4;
    const rowCliente = worksheet.getRow(infoStartRow);
    rowCliente.getCell(1).value = 'CLIENTE:';
    rowCliente.getCell(1).font = { bold: true };
    rowCliente.getCell(2).value = cliente.cliente_nombre;
    worksheet.mergeCells(infoStartRow, 2, infoStartRow, 4);
    rowCliente.getCell(5).value = 'FECHA:';
    rowCliente.getCell(5).font = { bold: true };
    rowCliente.getCell(6).value = new Date().toLocaleDateString('es-MX');
    worksheet.mergeCells(infoStartRow, 6, infoStartRow, 8);

    const rowObra = worksheet.getRow(infoStartRow + 1);
    rowObra.getCell(1).value = 'OBRA:';
    rowObra.getCell(1).font = { bold: true };
    rowObra.getCell(2).value = cliente.obra || 'No especificada';
    worksheet.mergeCells(infoStartRow + 1, 2, infoStartRow + 1, 4);
    rowObra.getCell(5).value = 'RESPONSABLE:';
    rowObra.getCell(5).font = { bold: true };
    rowObra.getCell(6).value = cliente.contacto || 'No especificado';
    worksheet.mergeCells(infoStartRow + 1, 6, infoStartRow + 1, 8);

    // 3. TABLA DE DETALLE
    const tableStartRow = infoStartRow + 3;
    const headers = ['Fecha', 'Estimación', 'Folio', 'Máquina', 'Operador', 'Hrs', 'Precio', 'Total', 'Observaciones'];
    const headersRow = worksheet.getRow(tableStartRow);
    headers.forEach((header, index) => {
      const cell = headersRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E6F3FF' } };
    });

    rentas.forEach((renta, index) => {
      const row = worksheet.getRow(tableStartRow + index + 1);
      row.getCell(1).value = renta.fecha ? new Date(renta.fecha).toLocaleDateString('es-MX') : '';
      row.getCell(2).value = renta.estimacion || '';
      row.getCell(3).value = renta.folio || '';
      row.getCell(4).value = renta.maquina_nombre || '';
      row.getCell(5).value = renta.operador_nombre || '';
      row.getCell(6).value = renta.hrs ?? 0;
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).value = renta.precio ?? 0;
      row.getCell(7).numFmt = '"$"#,##0.00';
      row.getCell(8).value = renta.total ?? 0;
      row.getCell(8).numFmt = '"$"#,##0.00';
      row.getCell(9).value = renta.observaciones || '';
    });

    const totalHrs = rentas.reduce((sum, r) => sum + (r.hrs || 0), 0);
    const totalCobrar = rentas.reduce((sum, r) => sum + (r.total || 0), 0);
    const iva = totalCobrar * 0.16;
    const totalConIva = totalCobrar + iva;

    const totalRowIndex = tableStartRow + rentas.length + 1;
    const totalRow = worksheet.getRow(totalRowIndex);
    totalRow.getCell(1).value = 'TOTALES';
    totalRow.getCell(1).font = { bold: true };
    totalRow.getCell(6).value = totalHrs;
    totalRow.getCell(6).numFmt = '#,##0.00';
    totalRow.getCell(6).font = { bold: true };
    totalRow.getCell(8).value = totalCobrar;
    totalRow.getCell(8).numFmt = '"$"#,##0.00';
    totalRow.getCell(8).font = { bold: true };

    const subRow = worksheet.getRow(totalRowIndex + 2);
    subRow.getCell(7).value = 'SUB TOTAL';
    subRow.getCell(7).font = { bold: true };
    subRow.getCell(7).alignment = { horizontal: 'right' };
    subRow.getCell(8).value = totalCobrar;
    subRow.getCell(8).numFmt = '"$"#,##0.00';
    subRow.getCell(8).font = { bold: true };

    const ivaRow = worksheet.getRow(totalRowIndex + 3);
    ivaRow.getCell(7).value = 'IVA 16%';
    ivaRow.getCell(7).font = { bold: true };
    ivaRow.getCell(7).alignment = { horizontal: 'right' };
    ivaRow.getCell(8).value = iva;
    ivaRow.getCell(8).numFmt = '"$"#,##0.00';
    ivaRow.getCell(8).font = { bold: true };

    const totalFinalRow = worksheet.getRow(totalRowIndex + 4);
    totalFinalRow.getCell(7).value = 'TOTAL';
    totalFinalRow.getCell(7).font = { bold: true, size: 12 };
    totalFinalRow.getCell(7).alignment = { horizontal: 'right' };
    totalFinalRow.getCell(8).value = totalConIva;
    totalFinalRow.getCell(8).numFmt = '"$"#,##0.00';
    totalFinalRow.getCell(8).font = { bold: true, size: 12 };

    // Bordes de la tabla (encabezados + datos + fila de totales)
    for (let row = tableStartRow; row <= totalRowIndex; row++) {
      const worksheetRow = worksheet.getRow(row);
      for (let col = 1; col <= 9; col++) {
        worksheetRow.getCell(col).border = {
          top: { style: 'thin', color: { argb: '000000' } },
          left: { style: 'thin', color: { argb: '000000' } },
          bottom: { style: 'thin', color: { argb: '000000' } },
          right: { style: 'thin', color: { argb: '000000' } }
        };
      }
    }

    worksheet.columns = [
      { width: 12 }, // Fecha
      { width: 14 }, // Estimación
      { width: 14 }, // Folio
      { width: 22 }, // Máquina
      { width: 20 }, // Operador
      { width: 10 }, // Hrs
      { width: 14 }, // Precio
      { width: 15 }, // Total
      { width: 30 }  // Observaciones
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Estimacion_Maquinaria_${cliente.cliente_nombre.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Error al exportar estimación de maquinaria a Excel:', error);
    throw error;
  }
};