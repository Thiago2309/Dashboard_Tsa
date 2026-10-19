-- ============================================================================
-- Agenda — Asignación de tareas del Kanban por Admin
-- ============================================================================
-- Cómo correrlo: pega TODO este archivo en el SQL Editor de Supabase y
-- ejecútalo una sola vez. Requiere haber corrido antes scripts/agenda_setup.sql.
-- Es seguro volver a correrlo.
--
-- Qué hace: igual que en el calendario (agenda_eventos), Admin ahora puede
-- cargarle tareas en el Kanban a cualquier persona del personal.
--   - agenda_tareas gana la columna creado_por (quién la cargó).
--   - Vista fetch_agenda_tareas con el nombre del dueño y de quién la asignó.
--   - RLS: un empleado solo puede crearse tareas a sí mismo; Admin a quien sea.
--     El empleado puede mover (cambiar estado/orden) las tareas que le
--     asignaron, pero no editar su contenido ni borrarlas — eso solo lo puede
--     hacer quien la creó o Admin.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Columna creado_por (las tareas existentes quedan como creadas por su dueño)
-- ----------------------------------------------------------------------------
ALTER TABLE public.agenda_tareas ADD COLUMN IF NOT EXISTS creado_por bigint REFERENCES public."user"(id) ON DELETE CASCADE;
UPDATE public.agenda_tareas SET creado_por = userid WHERE creado_por IS NULL;
ALTER TABLE public.agenda_tareas ALTER COLUMN creado_por SET NOT NULL;

-- ----------------------------------------------------------------------------
-- 2) Vista fetch_agenda_tareas (lecturas); escrituras van contra agenda_tareas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.fetch_agenda_tareas AS
SELECT
    t.*,
    trim(concat_ws(' ', u.nombre, u.apellido)) AS usuario_nombre,
    trim(concat_ws(' ', c.nombre, c.apellido)) AS creado_por_nombre
FROM public.agenda_tareas t
JOIN public."user" u ON u.id = t.userid
JOIN public."user" c ON c.id = t.creado_por;

ALTER VIEW public.fetch_agenda_tareas SET (security_invoker = on);

-- ----------------------------------------------------------------------------
-- 3) RLS — agenda_tareas (reemplaza la política "todo propio" anterior)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "agenda_tareas_all_propio" ON public.agenda_tareas;

DROP POLICY IF EXISTS "agenda_tareas_select" ON public.agenda_tareas;
CREATE POLICY "agenda_tareas_select" ON public.agenda_tareas FOR SELECT TO authenticated
USING (
    public.is_admin()
    OR userid = (SELECT id FROM public."user" WHERE auth_id = auth.uid())
    OR creado_por = (SELECT id FROM public."user" WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "agenda_tareas_insert" ON public.agenda_tareas;
CREATE POLICY "agenda_tareas_insert" ON public.agenda_tareas FOR INSERT TO authenticated
WITH CHECK (
    creado_por = (SELECT id FROM public."user" WHERE auth_id = auth.uid())
    AND (
        public.is_admin()
        OR userid = (SELECT id FROM public."user" WHERE auth_id = auth.uid())
    )
);

DROP POLICY IF EXISTS "agenda_tareas_update" ON public.agenda_tareas;
CREATE POLICY "agenda_tareas_update" ON public.agenda_tareas FOR UPDATE TO authenticated
USING (
    public.is_admin()
    OR userid = (SELECT id FROM public."user" WHERE auth_id = auth.uid())
    OR creado_por = (SELECT id FROM public."user" WHERE auth_id = auth.uid())
)
WITH CHECK (
    public.is_admin()
    OR userid = (SELECT id FROM public."user" WHERE auth_id = auth.uid())
    OR creado_por = (SELECT id FROM public."user" WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "agenda_tareas_delete" ON public.agenda_tareas;
CREATE POLICY "agenda_tareas_delete" ON public.agenda_tareas FOR DELETE TO authenticated
USING (
    public.is_admin()
    OR creado_por = (SELECT id FROM public."user" WHERE auth_id = auth.uid())
);

-- ----------------------------------------------------------------------------
-- 4) Candado de columnas: si no eres Admin ni quien creó la tarea, solo puedes
--    cambiarle estado y orden (moverla en el tablero). Nadie que no sea Admin
--    puede cambiar el dueño (userid) ni el creador (creado_por).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_agenda_tareas_proteger_columnas()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_mi_id bigint;
BEGIN
    -- Llamadas sin sesión de usuario (SQL Editor / service role) no se limitan.
    IF auth.uid() IS NULL OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    SELECT id INTO v_mi_id FROM public."user" WHERE auth_id = auth.uid();

    IF NEW.userid IS DISTINCT FROM OLD.userid OR NEW.creado_por IS DISTINCT FROM OLD.creado_por THEN
        RAISE EXCEPTION 'No puedes cambiar a quién pertenece la tarea';
    END IF;

    IF OLD.creado_por IS DISTINCT FROM v_mi_id AND (
        NEW.titulo IS DISTINCT FROM OLD.titulo
        OR NEW.descripcion IS DISTINCT FROM OLD.descripcion
        OR NEW.prioridad IS DISTINCT FROM OLD.prioridad
        OR NEW.fecha_limite IS DISTINCT FROM OLD.fecha_limite
    ) THEN
        RAISE EXCEPTION 'Solo puedes cambiar el estado de una tarea que te asignaron';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_tareas_proteger_columnas ON public.agenda_tareas;
CREATE TRIGGER trg_agenda_tareas_proteger_columnas BEFORE UPDATE ON public.agenda_tareas
    FOR EACH ROW EXECUTE FUNCTION public.fn_agenda_tareas_proteger_columnas();
