-- INC-0025 (parte 2) · Historial de precios por fecha de cada ruta Origen-Destino.
--
-- Cada renglón dice: "a partir de vigente_desde, esta ruta cuesta precio_unidad / precio_materia".
-- El precio de un viaje se toma del renglón vigente en la FECHA DEL VIAJE (el más reciente con
-- vigente_desde <= fecha). Así, una nota atrasada capturada después de un cambio de precio toma el
-- precio que estaba vigente en su fecha, no el actual.
--
-- Requiere haber corrido antes scripts/viajes_precio_congelado.sql.
-- Ejecutar una sola vez en el SQL Editor de Supabase. Es idempotente.

CREATE TABLE IF NOT EXISTS public.precio_origen_destino_historial (
    id bigserial PRIMARY KEY,
    id_precio_origen_destino bigint NOT NULL REFERENCES public.precio_origen_destino (id) ON DELETE CASCADE,
    precio_unidad numeric NOT NULL,
    precio_materia numeric NOT NULL DEFAULT 0,
    vigente_desde date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_precio_od_historial_ruta_fecha UNIQUE (id_precio_origen_destino, vigente_desde)
);

CREATE INDEX IF NOT EXISTS idx_precio_od_historial_ruta ON public.precio_origen_destino_historial (id_precio_origen_destino, vigente_desde DESC);

-- Precio base de cada ruta existente: el precio actual, vigente "desde siempre". De aquí en adelante
-- cada cambio de precio agrega un renglón nuevo con su fecha.
INSERT INTO public.precio_origen_destino_historial (id_precio_origen_destino, precio_unidad, precio_materia, vigente_desde)
SELECT p.id, COALESCE(p.precio_unidad, 0), COALESCE(p.precio_materia, 0), DATE '1900-01-01'
FROM public.precio_origen_destino p
ON CONFLICT (id_precio_origen_destino, vigente_desde) DO NOTHING;

-- Mismo esquema de seguridad que el resto de las tablas de negocio (ver rls_setup.sql).
ALTER TABLE public.precio_origen_destino_historial ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "solo_autenticados" ON public.precio_origen_destino_historial;
CREATE POLICY "solo_autenticados" ON public.precio_origen_destino_historial FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bitácora de auditoría (si ya corriste auditoria_setup.sql).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_registrar_auditoria') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_auditoria ON public.precio_origen_destino_historial';
        EXECUTE 'CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON public.precio_origen_destino_historial FOR EACH ROW EXECUTE FUNCTION public.fn_registrar_auditoria()';
    END IF;
END $$;
