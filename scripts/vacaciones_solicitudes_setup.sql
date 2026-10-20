-- ============================================================================
-- Solicitudes de Vacaciones — Sistema TSA Dashboard
-- ============================================================================
-- Cómo correrlo: pega TODO este archivo en el SQL Editor de Supabase y
-- ejecútalo una sola vez. Requiere haber corrido antes scripts/rls_setup.sql
-- y scripts/auditoria_setup.sql (usa la función de auditoría
-- fn_registrar_auditoria() creada ahí). Es seguro volver a correrlo
-- (usa IF NOT EXISTS / DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS).
--
-- Qué hace: crea la tabla vacaciones_solicitudes para el módulo
-- RH > Vacaciones > "Solicitudes".
--
--   - Una solicitud se crea para un empleado (operador) con fechas y días.
--   - Lleva la firma del empleado (obligatoria) y la firma del jefe que
--     autoriza. Las firmas se guardan como imagen PNG en base64 (data URL).
--   - Mientras solo tenga la firma del empleado queda en estatus 'pendiente'.
--   - Cuando el jefe firma, pasa a 'autorizada' y la app crea un registro en
--     vacaciones_periodos (columna id_periodo) con los días disfrutados, así
--     el saldo de días disponibles del empleado se descuenta automáticamente.
--   - dias_ley / dias_tomados_antes / dias_restantes son una "foto" del saldo
--     al momento de autorizar, para que el formato impreso no cambie después.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vacaciones_solicitudes (
    id bigserial PRIMARY KEY,
    id_operador bigint NOT NULL REFERENCES public.operador(id) ON DELETE CASCADE,
    fecha_solicitud date NOT NULL DEFAULT CURRENT_DATE,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    fecha_regreso date,
    dias_solicitados integer NOT NULL CHECK (dias_solicitados > 0),
    motivo text,
    estatus text NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente', 'autorizada', 'rechazada')),

    firma_empleado text NOT NULL,
    firma_jefe text,
    autorizado_por text,
    autorizado_por_userid bigint REFERENCES public."user"(id) ON DELETE SET NULL,
    fecha_autorizacion timestamptz,
    motivo_rechazo text,

    dias_ley integer,
    dias_tomados_antes integer,
    dias_restantes integer,

    id_periodo bigint REFERENCES public.vacaciones_periodos(id) ON DELETE SET NULL,
    creado_por bigint REFERENCES public."user"(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vacaciones_solicitudes_fechas_check CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT vacaciones_solicitudes_autorizada_check CHECK (
        estatus <> 'autorizada' OR (firma_jefe IS NOT NULL AND autorizado_por IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_vacaciones_solicitudes_operador ON public.vacaciones_solicitudes (id_operador);
CREATE INDEX IF NOT EXISTS idx_vacaciones_solicitudes_estatus ON public.vacaciones_solicitudes (estatus);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.fn_vacaciones_solicitudes_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vacaciones_solicitudes_updated_at ON public.vacaciones_solicitudes;
CREATE TRIGGER trg_vacaciones_solicitudes_updated_at BEFORE UPDATE ON public.vacaciones_solicitudes
    FOR EACH ROW EXECUTE FUNCTION public.fn_vacaciones_solicitudes_updated_at();

-- RLS: mismo criterio que vacaciones_periodos (solo usuarios autenticados)
ALTER TABLE public.vacaciones_solicitudes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "solo_autenticados" ON public.vacaciones_solicitudes;
CREATE POLICY "solo_autenticados" ON public.vacaciones_solicitudes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auditoría
DROP TRIGGER IF EXISTS trg_auditoria ON public.vacaciones_solicitudes;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.vacaciones_solicitudes
    FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria();
