// Services/BD/departamentoService.ts
import { supabase } from '../superbase.service';

export interface Departamento {
    id?: number;
    nombre: string;
    descripcion?: string;
    estatus: boolean;
    // Campo calculado (no existe en la tabla, se agrega al transformar)
    total_empleados?: number;
}

export const fetchDepartamentos = async (): Promise<Departamento[]> => {
    const { data, error } = await supabase
        .from('departamento')
        .select('*')
        .order('nombre');

    if (error) {
        console.error('Error fetching departamentos:', error);
        throw error;
    }

    const departamentos: any[] = data || [];

    const { data: operadores, error: operadoresError } = await supabase
        .from('operador')
        .select('id, departamento_id');

    if (operadoresError) {
        console.error('Error contando empleados por departamento:', operadoresError);
    }

    const conteoPorDepartamento = new Map<number, number>();
    (operadores || []).forEach((op: any) => {
        if (op.departamento_id) {
            conteoPorDepartamento.set(op.departamento_id, (conteoPorDepartamento.get(op.departamento_id) || 0) + 1);
        }
    });

    return departamentos.map(dep => ({
        id: dep.id,
        nombre: dep.nombre,
        descripcion: dep.descripcion,
        estatus: dep.estatus,
        total_empleados: conteoPorDepartamento.get(dep.id) || 0
    }));
};

// Lista simple para selects (dropdowns)
export const fetchDepartamentosActivos = async (): Promise<{ id: number; nombre: string }[]> => {
    const { data, error } = await supabase
        .from('departamento')
        .select('id, nombre')
        .eq('estatus', true)
        .order('nombre');

    if (error) {
        console.error('Error fetching departamentos activos:', error);
        throw error;
    }

    return data || [];
};

export const createDepartamento = async (departamento: Omit<Departamento, 'id'>): Promise<Departamento> => {
    const { data, error } = await supabase
        .from('departamento')
        .insert([{
            nombre: departamento.nombre,
            descripcion: departamento.descripcion || null,
            estatus: departamento.estatus
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating departamento:', error);
        throw error;
    }

    return data;
};

export const updateDepartamento = async (departamento: Departamento): Promise<Departamento> => {
    const { data, error } = await supabase
        .from('departamento')
        .update({
            nombre: departamento.nombre,
            descripcion: departamento.descripcion || null,
            estatus: departamento.estatus
        })
        .eq('id', departamento.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating departamento:', error);
        throw error;
    }

    return data;
};

export const deleteDepartamento = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('departamento')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting departamento:', error);
        throw error;
    }
};

// ===================== Empleados de un departamento =====================

export interface EmpleadoResumen {
    id: number;
    nombre: string;
    puesto: string;
}

export const fetchEmpleadosDeDepartamento = async (departamentoId: number): Promise<EmpleadoResumen[]> => {
    const { data, error } = await supabase
        .from('operador')
        .select('id, nombre, puesto')
        .eq('departamento_id', departamentoId)
        .order('nombre');

    if (error) {
        console.error('Error fetching empleados del departamento:', error);
        throw error;
    }

    return data || [];
};

// ===================== CEO de la empresa =====================

export const fetchCeo = async (): Promise<EmpleadoResumen | null> => {
    const { data, error } = await supabase
        .from('operador')
        .select('id, nombre, puesto')
        .eq('es_ceo', true)
        .maybeSingle();

    if (error) {
        console.error('Error fetching CEO:', error);
        throw error;
    }

    return data || null;
};

// Define quién es el CEO (máximo nivel jerárquico, sin gerente). Pasa null para dejar la empresa sin CEO.
export const definirCeo = async (operadorId: number | null): Promise<void> => {
    const { error: clearError } = await supabase
        .from('operador')
        .update({ es_ceo: false })
        .eq('es_ceo', true);

    if (clearError) {
        console.error('Error limpiando CEO anterior:', clearError);
        throw clearError;
    }

    if (operadorId) {
        const { error: setError } = await supabase
            .from('operador')
            .update({ es_ceo: true, jefe_inmediato_id: null })
            .eq('id', operadorId);

        if (setError) {
            console.error('Error definiendo nuevo CEO:', setError);
            throw setError;
        }
    }
};

// ===================== Jerarquía de la empresa (basada en el gerente de cada empleado) =====================
// CEO -> gerentes -> empleados a su cargo, según el campo "jefe_inmediato_id" de cada empleado.
// El departamento y el puesto se muestran como información adicional en cada nodo.

export interface OperadorJerarquia {
    id: number;
    nombre: string;
    puesto: string;
    es_ceo?: boolean;
    jefe_inmediato_id?: number | null;
    departamento_id?: number | null;
    departamento_nombre?: string;
}

export const fetchJerarquiaEmpleados = async (): Promise<OperadorJerarquia[]> => {
    const { data, error } = await supabase
        .from('operador')
        .select('id, nombre, puesto, es_ceo, jefe_inmediato_id, departamento_id, estatus')
        .eq('estatus', true)
        .order('nombre');

    if (error) {
        console.error('Error fetching jerarquía de empleados:', error);
        throw error;
    }

    const empleados: any[] = data || [];

    const { data: departamentos, error: depError } = await supabase
        .from('departamento')
        .select('id, nombre');

    if (depError) {
        console.error('Error fetching departamentos para jerarquía:', depError);
    }

    const departamentosMap = new Map((departamentos || []).map((d: any) => [d.id, d.nombre]));

    return empleados.map(emp => ({
        id: emp.id,
        nombre: emp.nombre,
        puesto: emp.puesto,
        es_ceo: emp.es_ceo || false,
        jefe_inmediato_id: emp.jefe_inmediato_id,
        departamento_id: emp.departamento_id,
        departamento_nombre: emp.departamento_id ? departamentosMap.get(emp.departamento_id) : undefined
    }));
};
