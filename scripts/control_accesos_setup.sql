-- ============================================================================
-- Módulo de Control de Accesos — Sistema TSA Dashboard
-- ============================================================================
-- Requiere haber corrido antes scripts/rls_setup.sql y scripts/auditoria_setup.sql
-- (usa la función is_admin() creada en este último).
--
-- Qué hace: crea 'permisos_modulo', donde cada fila dice "este usuario puede
-- ver este módulo del menú". El menú (layout/AppMenu.tsx) deja de decidir qué
-- mostrar según 4 roles fijos y en su lugar lee esta tabla por usuario. 'home'
-- no se guarda aquí — siempre es visible para todos. 'auditoria' y 'control de
-- accesos' se quedan fijos solo para Admin, no se manejan con esta tabla.
--
-- Para no dejar a todo el personal actual con el menú vacío al activar esto,
-- el bloque 2 siembra automáticamente los módulos que cada usuario YA ve hoy
-- según su rol actual — es seguro volver a correrlo (ON CONFLICT DO NOTHING).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Tabla y RLS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permisos_modulo (
    userid bigint NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
    modulo text NOT NULL,
    PRIMARY KEY (userid, modulo)
);

ALTER TABLE public.permisos_modulo ENABLE ROW LEVEL SECURITY;

-- Un usuario puede leer sus propios módulos (los necesita para armar su menú
-- al iniciar sesión); Admin puede leer los de todos.
DROP POLICY IF EXISTS "propio_o_admin_lee" ON public.permisos_modulo;
CREATE POLICY "propio_o_admin_lee" ON public.permisos_modulo FOR SELECT TO authenticated
USING (
    public.is_admin()
    OR userid = (SELECT id FROM public."user" WHERE auth_id = auth.uid())
);

-- Solo Admin puede asignar/quitar módulos de cualquiera.
DROP POLICY IF EXISTS "solo_admin_inserta" ON public.permisos_modulo;
CREATE POLICY "solo_admin_inserta" ON public.permisos_modulo FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "solo_admin_borra" ON public.permisos_modulo;
CREATE POLICY "solo_admin_borra" ON public.permisos_modulo FOR DELETE TO authenticated USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2) Migración: si ya habías corrido una versión anterior de este script,
--    'mantenimiento' era un solo módulo — ahora se parte en 6 submódulos
--    independientes (Equipamiento, Taller, Almacén, Costo Operativo, Compras,
--    Combustible). Esto expande las filas viejas a las nuevas antes de seguir,
--    sin quitarle nada a nadie que ya tuviera acceso. Si es la primera vez que
--    corres este script, este bloque simplemente no encuentra nada que migrar.
-- ----------------------------------------------------------------------------
INSERT INTO public.permisos_modulo (userid, modulo)
SELECT DISTINCT pm.userid, sub.modulo
FROM public.permisos_modulo pm
CROSS JOIN LATERAL (
    SELECT unnest(ARRAY[
        'mantenimiento_equipamiento', 'mantenimiento_taller', 'mantenimiento_almacen',
        'mantenimiento_costo_operativo', 'mantenimiento_compras', 'mantenimiento_combustible'
    ]) AS modulo
) sub
WHERE pm.modulo = 'mantenimiento'
ON CONFLICT (userid, modulo) DO NOTHING;

DELETE FROM public.permisos_modulo WHERE modulo = 'mantenimiento';

-- ----------------------------------------------------------------------------
-- 3) Siembra: cada usuario conserva lo que ya ve hoy según su rol actual
--    (ver la lógica vieja en layout/AppMenu.tsx antes de este cambio).
--    roleid 1 Admin, 2 Empleado, 4 Almacén, 5 Logística.
-- ----------------------------------------------------------------------------
INSERT INTO public.permisos_modulo (userid, modulo)
SELECT DISTINCT u.id, m.modulo
FROM public."user" u
JOIN public.userroles ur ON ur.userid = u.id
CROSS JOIN LATERAL (
    SELECT unnest(
        CASE ur.roleid
            WHEN 1 THEN ARRAY['gestion','rrhh','control_obras','soporte','admin_viajes','admin_logistica',
                'mantenimiento_equipamiento','mantenimiento_taller','mantenimiento_almacen',
                'mantenimiento_costo_operativo','mantenimiento_compras','mantenimiento_combustible']
            WHEN 2 THEN ARRAY['control_obras','soporte']
            WHEN 4 THEN ARRAY['gestion','rrhh','control_obras','soporte',
                'mantenimiento_equipamiento','mantenimiento_taller','mantenimiento_almacen',
                'mantenimiento_costo_operativo','mantenimiento_compras','mantenimiento_combustible']
            WHEN 5 THEN ARRAY['control_obras','soporte','admin_logistica']
            ELSE ARRAY[]::text[]
        END
    ) AS modulo
) m
ON CONFLICT (userid, modulo) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4) Activar/Desactivar acceso: en vez de borrar la cuenta al quitarle acceso
--    a alguien, se usa una bandera reversible. login() la revisa antes de dejar
--    entrar (igual que ya hace con operador.estatus).
-- ----------------------------------------------------------------------------
ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- login() necesita poder leer 'activo' ANTES de autenticar, igual que
-- id/nombre/apellido/email/auth_id (ver la sección de 'user' en rls_setup.sql).
GRANT SELECT (activo) ON public."user" TO anon;
GRANT SELECT (activo) ON public."user" TO authenticated;

-- ============================================================================
-- Para agregar un módulo nuevo al sistema en el futuro: solo hace falta usarlo
-- como 'key' en Services/BD/permisosService.ts (MODULOS_DISPONIBLES) y en el
-- gate correspondiente de layout/AppMenu.tsx — esta tabla no necesita cambios
-- de esquema, solo nuevas filas.
-- ============================================================================
