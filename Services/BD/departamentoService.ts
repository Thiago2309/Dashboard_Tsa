// Services/BD/departamentoService.ts
import { supabase } from '../superbase.service';

export interface Departamento {
    id?: number;
    nombre: string;
    descripcion?: string;
    departamento_padre_id?: number | null;
    jefe_operador_id?: number | null;
    estatus: boolean;
    // Campos calculados (no existen en la tabla, se agregan al transformar)
    departamento_padre_nombre?: string;
    jefe_nombre?: string;
    total_empleados?: number;
}

const transformDepartamentoData = (
    dep: any,
    departamentosMap: Map<number, any>,
    jefesMap: Map<number, any>,
    conteoPorDepartamento: Map<number, number>
): Departamento => ({
    id: dep.id,
    nombre: dep.nombre,
    descripcion: dep.descripcion,
    departamento_padre_id: dep.departamento_padre_id,
    jefe_operador_id: dep.jefe_operador_id,
    estatus: dep.estatus,
    departamento_padre_nombre: dep.departamento_padre_id ? departamentosMap.get(dep.departamento_padre_id)?.nombre : undefined,
    jefe_nombre: dep.jefe_operador_id ? jefesMap.get(dep.jefe_operador_id)?.nombre : undefined,
    total_empleados: conteoPorDepartamento.get(dep.id) || 0
});

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
    const departamentosMap = new Map(departamentos.map(d => [d.id, d]));

    const jefeIds = Array.from(new Set(departamentos.map(d => d.jefe_operador_id).filter(Boolean)));
    let jefesMap = new Map<number, any>();
    if (jefeIds.length > 0) {
        const { data: jefes, error: jefesError } = await supabase
            .from('operador')
            .select('id, nombre')
            .in('id', jefeIds as any[]);

        if (jefesError) {
            console.error('Error fetching jefes de departamento:', jefesError);
        }
        jefesMap = new Map((jefes || []).map((j: any) => [j.id, j]));
    }

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

    return departamentos.map(dep => transformDepartamentoData(dep, departamentosMap, jefesMap, conteoPorDepartamento));
};

export const createDepartamento = async (departamento: Omit<Departamento, 'id'>): Promise<Departamento> => {
    const { data, error } = await supabase
        .from('departamento')
        .insert([{
            nombre: departamento.nombre,
            descripcion: departamento.descripcion || null,
            departamento_padre_id: departamento.departamento_padre_id || null,
            jefe_operador_id: departamento.jefe_operador_id || null,
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
            departamento_padre_id: departamento.departamento_padre_id || null,
            jefe_operador_id: departamento.jefe_operador_id || null,
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

// ===================== Empleados a cargo de un departamento =====================

export interface EmpleadoResumen {
    id: number;
    nombre: string;
    puesto: string;
}

// Empleados actualmente asignados a un departamento (para precargar el multiselect al editar)
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

// Asigna el departamento a los empleados seleccionados y libera a quienes ya no pertenecen a él.
// Como cada empleado solo puede tener un departamento_id, mover a alguien a este departamento
// automáticamente lo quita de cualquier otro departamento en el que estuviera antes.
export const sincronizarEmpleadosDepartamento = async (departamentoId: number, empleadoIds: number[]): Promise<void> => {
    if (empleadoIds.length > 0) {
        const { error: asignarError } = await supabase
            .from('operador')
            .update({ departamento_id: departamentoId })
            .in('id', empleadoIds);

        if (asignarError) {
            console.error('Error asignando empleados al departamento:', asignarError);
            throw asignarError;
        }
    }

    let query = supabase
        .from('operador')
        .update({ departamento_id: null })
        .eq('departamento_id', departamentoId);

    if (empleadoIds.length > 0) {
        query = query.not('id', 'in', `(${empleadoIds.join(',')})`);
    }

    const { error: quitarError } = await query;

    if (quitarError) {
        console.error('Error liberando empleados del departamento:', quitarError);
        throw quitarError;
    }
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

// Define quién es el CEO (máximo nivel jerárquico). Pasa null para dejar la empresa sin CEO.
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
            .update({ es_ceo: true })
            .eq('id', operadorId);

        if (setError) {
            console.error('Error definiendo nuevo CEO:', setError);
            throw setError;
        }
    }
};

// ===================== Organigrama de la empresa (basado en departamentos) =====================
// CEO -> departamentos raíz (sin padre) -> sub-departamentos y empleados a cargo de cada uno.

export interface DepartamentoOrganigrama {
    id: number;
    nombre: string;
    jefe: EmpleadoResumen | null;
    empleados: EmpleadoResumen[];
    subdepartamentos: DepartamentoOrganigrama[];
}

export interface OrganigramaEmpresa {
    ceo: EmpleadoResumen | null;
    departamentos: DepartamentoOrganigrama[];
}

export const fetchOrganigramaEmpresa = async (): Promise<OrganigramaEmpresa> => {
    const [{ data: departamentosData, error: depError }, { data: operadoresData, error: opError }] = await Promise.all([
        supabase.from('departamento').select('id, nombre, departamento_padre_id, jefe_operador_id').eq('estatus', true).order('nombre'),
        supabase.from('operador').select('id, nombre, puesto, departamento_id, es_ceo').eq('estatus', true)
    ]);

    if (depError) {
        console.error('Error fetching departamentos para organigrama:', depError);
        throw depError;
    }
    if (opError) {
        console.error('Error fetching empleados para organigrama:', opError);
        throw opError;
    }

    const departamentos: any[] = departamentosData || [];
    const operadores: any[] = operadoresData || [];
    const operadoresMap = new Map(operadores.map(o => [o.id, o]));
    const departamentosIds = new Set(departamentos.map(d => d.id));

    const empleadosPorDepartamento = new Map<number, any[]>();
    operadores.forEach(op => {
        if (op.departamento_id) {
            const lista = empleadosPorDepartamento.get(op.departamento_id) || [];
            lista.push(op);
            empleadosPorDepartamento.set(op.departamento_id, lista);
        }
    });

    const hijosDeDepartamento = new Map<number, any[]>();
    departamentos.forEach(dep => {
        if (dep.departamento_padre_id) {
            const lista = hijosDeDepartamento.get(dep.departamento_padre_id) || [];
            lista.push(dep);
            hijosDeDepartamento.set(dep.departamento_padre_id, lista);
        }
    });

    const construirDepartamento = (dep: any, visitados: Set<number>): DepartamentoOrganigrama => {
        visitados.add(dep.id);
        const jefeRaw = dep.jefe_operador_id ? operadoresMap.get(dep.jefe_operador_id) : null;
        const empleados = (empleadosPorDepartamento.get(dep.id) || []).filter((e: any) => e.id !== dep.jefe_operador_id);
        const subdepartamentos = (hijosDeDepartamento.get(dep.id) || [])
            .filter((h: any) => !visitados.has(h.id))
            .map((h: any) => construirDepartamento(h, visitados));

        return {
            id: dep.id,
            nombre: dep.nombre,
            jefe: jefeRaw ? { id: jefeRaw.id, nombre: jefeRaw.nombre, puesto: jefeRaw.puesto } : null,
            empleados: empleados.map((e: any) => ({ id: e.id, nombre: e.nombre, puesto: e.puesto })),
            subdepartamentos
        };
    };

    const visitados = new Set<number>();
    // Departamentos raíz: sin padre, o cuyo padre no existe/no está activo (dependen directamente del CEO)
    const raiz = departamentos.filter(d => !d.departamento_padre_id || !departamentosIds.has(d.departamento_padre_id));
    const departamentosArbol = raiz.map(d => construirDepartamento(d, visitados));

    const ceoRaw = operadores.find(o => o.es_ceo);
    const ceo = ceoRaw ? { id: ceoRaw.id, nombre: ceoRaw.nombre, puesto: ceoRaw.puesto } : null;

    return { ceo, departamentos: departamentosArbol };
};
