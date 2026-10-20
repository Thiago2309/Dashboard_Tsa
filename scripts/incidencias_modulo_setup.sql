-- ============================================================================
-- Incidencias: campo "Módulo" — Sistema TSA Dashboard
-- ============================================================================
-- Cómo correrlo: pega TODO este archivo en el SQL Editor de Supabase y
-- ejecútalo. Es seguro volver a correrlo.
--
-- Qué hace:
--   1) Agrega la columna modulo (texto libre) a la tabla incidencias, para
--      saber en qué módulo del sistema se pide el cambio o se encontró el error.
--   2) Agrega esa columna a la vista fetch_incidencias (la que lee la pantalla
--      "Reportar Incidencia"). Para no perder lo que la vista ya hace (join con
--      el usuario que reporta, etc.) se toma su definición actual y se le
--      agrega modulo encima, en vez de reescribirla a mano.
-- ============================================================================

ALTER TABLE public.incidencias ADD COLUMN IF NOT EXISTS modulo text;

DO $$
DECLARE
    definicion text;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'fetch_incidencias' AND column_name = 'modulo'
    ) THEN
        definicion := rtrim(pg_get_viewdef('public.fetch_incidencias'::regclass, true), E'; \n');
        EXECUTE 'DROP VIEW public.fetch_incidencias';
        EXECUTE 'CREATE VIEW public.fetch_incidencias AS
                 SELECT v.*, i.modulo
                 FROM (' || definicion || ') v
                 LEFT JOIN public.incidencias i ON i.id = v.id';
    END IF;
END $$;

-- Mismo ajuste de seguridad que en scripts/rls_setup.sql
ALTER VIEW public.fetch_incidencias SET (security_invoker = on);
GRANT SELECT ON public.fetch_incidencias TO authenticated;
