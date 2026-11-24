-- INC-0025 · Origen-Destino: cambiar el precio de una ruta sin alterar los viajes anteriores.
--
-- Cada viaje guarda el precio (flete y material) con el que se calculó. Así:
--   * Editar un viaje (operador, folio, etc.) conserva su cálculo con SU precio, no con el actual de la ruta.
--   * El botón "Actualizar precio" de Origen-Destino recalcula solo los viajes desde la fecha elegida
--     (sin tocar facturados ni pagados).
--
-- Ejecutar una sola vez en el SQL Editor de Supabase. Es idempotente: el llenado solo toca viajes
-- que todavía no tienen precio guardado.

ALTER TABLE public.viajes
    ADD COLUMN IF NOT EXISTS precio_unidad_viaje numeric,
    ADD COLUMN IF NOT EXISTS precio_materia_viaje numeric;

-- Llenado de los viajes existentes: el precio se obtiene "hacia atrás" desde el importe ya guardado
-- (caphrsviajes / (m3 × horas_renta | cantidad_viajes | 1)), para que ningún importe cambie.
-- Si no se puede despejar (sin M3 de catálogo o sin importe), se usa el precio actual de la ruta.
UPDATE public.viajes v
SET precio_unidad_viaje = COALESCE(
        (
            SELECT v.caphrsviajes / NULLIF(
                m.metros_cubicos * (
                    CASE
                        WHEN v.en_renta AND COALESCE(v.horas_renta, 0) > 0 THEN v.horas_renta
                        WHEN COALESCE(v.cantidad_viajes, 0) > 0 THEN v.cantidad_viajes
                        ELSE 1
                    END
                ), 0)
            FROM public.m3 m
            WHERE m.id = v.id_m3
        ),
        (SELECT p.precio_unidad FROM public.precio_origen_destino p WHERE p.id = v.id_precio_origen_destino),
        0
    )
WHERE v.precio_unidad_viaje IS NULL;

-- Material: total_materia / m3. Si el viaje no tiene material calculado, su precio de material fue 0.
UPDATE public.viajes v
SET precio_materia_viaje = COALESCE(
        CASE
            WHEN COALESCE(v.total_materia, 0) = 0 THEN 0
            ELSE COALESCE(
                (SELECT v.total_materia / NULLIF(m.metros_cubicos, 0) FROM public.m3 m WHERE m.id = v.id_m3),
                (SELECT p.precio_materia FROM public.precio_origen_destino p WHERE p.id = v.id_precio_origen_destino)
            )
        END,
        0
    )
WHERE v.precio_materia_viaje IS NULL;
