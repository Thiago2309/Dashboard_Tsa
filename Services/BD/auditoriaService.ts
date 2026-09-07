// Services/BD/auditoriaService.ts
import { supabase } from '../superbase.service';

export interface RegistroAuditoria {
    id: number;
    tabla: string;
    operacion: 'INSERT' | 'UPDATE' | 'DELETE';
    registro_id: string | null;
    datos_anteriores: Record<string, any> | null;
    datos_nuevos: Record<string, any> | null;
    usuario_nombre: string | null;
    usuario_email: string | null;
    fecha: string;
}

export interface FiltrosAuditoria {
    tabla?: string;
    operacion?: 'INSERT' | 'UPDATE' | 'DELETE';
    desde?: string; // ISO date
    hasta?: string; // ISO date
    usuario?: string; // texto libre, busca en nombre/email
    page?: number;
    pageSize?: number;
}

// Mismo universo de tablas auditadas en scripts/auditoria_setup.sql (se excluyen
// catálogos casi estáticos y facturación, fuera de alcance por ahora).
export const TABLAS_AUDITADAS = [
    'viajes', 'clientes', 'operador', 'user', 'userroles', 'invitados', 'logistica',
    'vacaciones_periodos', 'orden_trabajo', 'orden_trabajo_detalle', 'bitacora_taller',
    'proveedor', 'operador_documento', 'maquinaria_documento', 'camion_documento',
    'prestamos', 'pagos_prestamos', 'nominas', 'descuentos', 'bonos', 'maquinaria',
    'renta_maquinaria', 'inventario', 'movimientos_inventario', 'validaciones_inventario',
    'validaciones_inventario_detalle', 'incidencias', 'gastos', 'cajachica',
    'cuentas_por_pagar', 'pagos_cxp', 'cuentas_por_cobrar', 'pagos', 'combustible',
    'requisicion_compra', 'orden_compra', 'checador_zona', 'checador_registro',
    'checador_reporte', 'apu_presupuestos', 'apu_presupuesto_conceptos',
    'apu_presupuesto_frentes', 'apu_presupuesto_maquinaria', 'apu_presupuesto_tarjetas',
    'apu_presupuesto_tarjeta_insumos', 'estimaciones_config_exportacion', 'costo_operativo_otros'
] as const;

export const fetchAuditoria = async (filtros: FiltrosAuditoria = {}): Promise<{ registros: RegistroAuditoria[]; total: number }> => {
    const page = filtros.page ?? 0;
    const pageSize = filtros.pageSize ?? 25;

    let query = supabase
        .from('auditoria')
        .select('*', { count: 'exact' })
        .order('fecha', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

    if (filtros.tabla) query = query.eq('tabla', filtros.tabla);
    if (filtros.operacion) query = query.eq('operacion', filtros.operacion);
    if (filtros.desde) query = query.gte('fecha', filtros.desde);
    if (filtros.hasta) query = query.lte('fecha', filtros.hasta);
    if (filtros.usuario) query = query.or(`usuario_nombre.ilike.%${filtros.usuario}%,usuario_email.ilike.%${filtros.usuario}%`);

    const { data, error, count } = await query;

    if (error) {
        console.error('Error obteniendo auditoría:', error);
        throw error;
    }

    return { registros: data || [], total: count ?? 0 };
};
