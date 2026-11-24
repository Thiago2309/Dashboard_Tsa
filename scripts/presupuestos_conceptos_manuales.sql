-- INC-0026 · Presupuestos: permitir capturar conceptos MANUALES (sin usar el catálogo de Conceptos/Tarjetas).
-- Un renglón manual guarda su propia clave, descripción y unidad, y su precio unitario se escribe a mano.
-- Se guardan en la misma tabla apu_presupuesto_conceptos, así el cálculo, la carátula, la impresión y el
-- Excel del presupuesto siguen siendo los mismos.
--
-- Ejecutar una sola vez en el SQL Editor de Supabase. Es idempotente.

ALTER TABLE public.apu_presupuesto_conceptos
    ALTER COLUMN id_concepto DROP NOT NULL;

ALTER TABLE public.apu_presupuesto_conceptos
    ADD COLUMN IF NOT EXISTS es_manual boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS clave_manual text,
    ADD COLUMN IF NOT EXISTS descripcion_manual text,
    ADD COLUMN IF NOT EXISTS unidad_manual text;

-- Todo renglón debe venir del catálogo o ser manual.
ALTER TABLE public.apu_presupuesto_conceptos
    DROP CONSTRAINT IF EXISTS chk_apu_presupuesto_concepto_origen;

ALTER TABLE public.apu_presupuesto_conceptos
    ADD CONSTRAINT chk_apu_presupuesto_concepto_origen
    CHECK (es_manual OR id_concepto IS NOT NULL);
