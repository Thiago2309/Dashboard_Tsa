-- ============================================================================
-- Módulo de auditoría — Sistema TSA Dashboard
-- ============================================================================
-- Cómo correrlo: pega TODO este archivo en el SQL Editor de Supabase y ejecútalo
-- una sola vez (requiere haber corrido antes scripts/rls_setup.sql, porque usa
-- las mismas tablas 'user'/'userroles' para saber quién hizo cada cambio y
-- quién puede ver la bitácora).
--
-- Qué hace: crea una tabla 'auditoria' que registra automáticamente, vía
-- triggers de Postgres, cada INSERT/UPDATE/DELETE en las tablas de negocio:
-- qué tabla, qué operación, el registro completo antes y/o después, quién
-- (usuario logueado) y a qué hora. Como corre a nivel de base de datos, no
-- importa si el cambio vino de la app, de una pantalla que le pega directo a
-- Supabase, o de alguien usando la API con la anon key: siempre queda
-- registrado. Solo Admin (roleid 1) puede leer la bitácora.
--
-- NO se audita: facturación (fuera de alcance, igual que en rls_setup.sql) ni
-- tablas de catálogo casi estáticas (puesto, departamento, material, m3, rol,
-- precio_origen_destino, apu_categorias/conceptos/insumos/maquinaria/
-- tarjetas/tarjeta_insumos) — se pueden agregar después con un CREATE TRIGGER
-- más si hace falta.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabla donde vive la bitácora
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auditoria (
    id bigserial PRIMARY KEY,
    tabla text NOT NULL,
    operacion text NOT NULL, -- INSERT | UPDATE | DELETE
    registro_id text,
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    usuario_auth_id uuid,
    usuario_nombre text,
    usuario_email text,
    fecha timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON public.auditoria (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON public.auditoria (tabla);

-- ----------------------------------------------------------------------------
-- 2) Función helper: ¿el usuario logueado actual es Admin (roleid 1)?
--    SECURITY DEFINER para no depender de qué tan abiertas estén las políticas
--    de 'user'/'userroles' en el futuro.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public."user" u
        JOIN public.userroles ur ON ur.userid = u.id
        WHERE u.auth_id = auth.uid() AND ur.roleid = 1
    );
$$;

-- ----------------------------------------------------------------------------
-- 3) Función del trigger: registra cada INSERT/UPDATE/DELETE.
--    SECURITY DEFINER para poder insertar en 'auditoria' sin necesidad de
--    darle permiso de escritura ahí a 'anon'/'authenticated' — así nadie puede
--    falsificar ni borrar su propio rastro desde el navegador.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_registrar_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_usuario_id bigint;
    v_nombre text;
    v_email text;
    v_registro_id text;
BEGIN
    SELECT id, trim(concat_ws(' ', nombre, apellido)), email
    INTO v_usuario_id, v_nombre, v_email
    FROM public."user"
    WHERE auth_id = auth.uid();

    IF TG_OP = 'DELETE' THEN
        v_registro_id := (to_jsonb(OLD)->>'id');
    ELSE
        v_registro_id := (to_jsonb(NEW)->>'id');
    END IF;

    INSERT INTO public.auditoria (
        tabla, operacion, registro_id, datos_anteriores, datos_nuevos,
        usuario_auth_id, usuario_nombre, usuario_email
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        v_registro_id,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        auth.uid(),
        NULLIF(v_nombre, ''),
        v_email
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4) RLS: solo Admin puede leer la bitácora. Nadie (ni Admin) puede
--    insertar/editar/borrar directo — solo el trigger, vía SECURITY DEFINER.
-- ----------------------------------------------------------------------------
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.auditoria FROM anon, authenticated;
GRANT SELECT ON public.auditoria TO authenticated;

DROP POLICY IF EXISTS "solo_admin_lee" ON public.auditoria;
CREATE POLICY "solo_admin_lee" ON public.auditoria FOR SELECT TO authenticated USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5) Triggers en las tablas de negocio (se excluyen catálogos y facturación)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_auditoria ON public.viajes;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.viajes FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.clientes;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.operador;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.operador FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public."user";
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public."user" FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.userroles;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.userroles FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.invitados;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.invitados FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.logistica;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.logistica FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.vacaciones_periodos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.vacaciones_periodos FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.orden_trabajo;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.orden_trabajo FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.orden_trabajo_detalle;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.orden_trabajo_detalle FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.bitacora_taller;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.bitacora_taller FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.proveedor;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.proveedor FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.operador_documento;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.operador_documento FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.maquinaria_documento;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.maquinaria_documento FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.camion_documento;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.camion_documento FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.prestamos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.prestamos FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.pagos_prestamos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.pagos_prestamos FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.nominas;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.nominas FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.descuentos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.descuentos FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.bonos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.bonos FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.maquinaria;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.maquinaria FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.renta_maquinaria;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.renta_maquinaria FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.inventario;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.inventario FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.movimientos_inventario;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.movimientos_inventario FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.validaciones_inventario;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.validaciones_inventario FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.validaciones_inventario_detalle;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.validaciones_inventario_detalle FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.incidencias;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.incidencias FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.gastos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.gastos FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.cajachica;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.cajachica FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.cuentas_por_pagar;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.cuentas_por_pagar FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.pagos_cxp;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.pagos_cxp FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.cuentas_por_cobrar;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.cuentas_por_cobrar FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.pagos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.pagos FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.combustible;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.combustible FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.requisicion_compra;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.requisicion_compra FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.orden_compra;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.orden_compra FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.checador_zona;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.checador_zona FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.checador_registro;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.checador_registro FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.checador_reporte;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.checador_reporte FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.apu_presupuestos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.apu_presupuestos FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.apu_presupuesto_conceptos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.apu_presupuesto_conceptos FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.apu_presupuesto_frentes;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.apu_presupuesto_frentes FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.apu_presupuesto_maquinaria;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.apu_presupuesto_maquinaria FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.apu_presupuesto_tarjetas;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.apu_presupuesto_tarjetas FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.apu_presupuesto_tarjeta_insumos;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.apu_presupuesto_tarjeta_insumos FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.estimaciones_config_exportacion;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.estimaciones_config_exportacion FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

DROP TRIGGER IF EXISTS trg_auditoria ON public.costo_operativo_otros;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.costo_operativo_otros FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();

-- ============================================================================
-- Para agregar otra tabla a futuro, solo copiar este patrón:
--   DROP TRIGGER IF EXISTS trg_auditoria ON public.NOMBRE_TABLA;
--   CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.NOMBRE_TABLA
--       FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();
-- ============================================================================
