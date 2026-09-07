-- ============================================================================
-- Activación de Row Level Security (RLS) — Sistema TSA Dashboard
-- ============================================================================
-- Cómo correrlo: pega TODO este archivo en el SQL Editor de Supabase y ejecútalo
-- una sola vez. Es seguro volver a correrlo si algo falla a medias (usa
-- DROP POLICY IF EXISTS antes de cada CREATE POLICY).
--
-- Qué hace: activa RLS en todas las tablas de negocio y agrega una política
-- "solo_autenticados" que exige una sesión válida de Supabase Auth (el usuario
-- ya hizo login) para leer/escribir. Cualquiera que solo tenga la anon key
-- pública (sin haber iniciado sesión) queda bloqueado.
--
-- Excepciones necesarias porque login() consulta 'user' y 'operador' ANTES de
-- autenticar (para verificar que el email existe y que el operador no esté
-- desactivado): se agrega una política de SELECT para el rol 'anon', pero
-- restringida solo a las columnas que ese chequeo necesita (nunca la contraseña).
--
-- NO se toca nada de facturación (configuracion_fiscal, facturas,
-- facturas_detalles) a propósito.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Activar RLS en todas las tablas de negocio
-- ----------------------------------------------------------------------------
ALTER TABLE public.apu_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apu_conceptos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apu_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apu_maquinaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apu_presupuesto_conceptos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apu_presupuesto_frentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apu_presupuesto_maquinaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apu_presupuesto_tarjeta_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apu_presupuesto_tarjetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apu_presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apu_tarjeta_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apu_tarjetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitacora_taller ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cajachica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camion_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checador_registro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checador_reporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checador_zona ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combustible ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costo_operativo_otros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_por_cobrar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_por_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.descuentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimaciones_config_exportacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m3 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinaria_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nominas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operador_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_trabajo_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_cxp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precio_origen_destino ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puesto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renta_maquinaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisicion_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rol ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.userroles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacaciones_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validaciones_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validaciones_inventario_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viajes ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2) Política genérica: acceso total solo para usuarios logueados (authenticated)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "solo_autenticados" ON public.apu_categorias;
CREATE POLICY "solo_autenticados" ON public.apu_categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.apu_conceptos;
CREATE POLICY "solo_autenticados" ON public.apu_conceptos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.apu_insumos;
CREATE POLICY "solo_autenticados" ON public.apu_insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.apu_maquinaria;
CREATE POLICY "solo_autenticados" ON public.apu_maquinaria FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.apu_presupuesto_conceptos;
CREATE POLICY "solo_autenticados" ON public.apu_presupuesto_conceptos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.apu_presupuesto_frentes;
CREATE POLICY "solo_autenticados" ON public.apu_presupuesto_frentes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.apu_presupuesto_maquinaria;
CREATE POLICY "solo_autenticados" ON public.apu_presupuesto_maquinaria FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.apu_presupuesto_tarjeta_insumos;
CREATE POLICY "solo_autenticados" ON public.apu_presupuesto_tarjeta_insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.apu_presupuesto_tarjetas;
CREATE POLICY "solo_autenticados" ON public.apu_presupuesto_tarjetas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.apu_presupuestos;
CREATE POLICY "solo_autenticados" ON public.apu_presupuestos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.apu_tarjeta_insumos;
CREATE POLICY "solo_autenticados" ON public.apu_tarjeta_insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.apu_tarjetas;
CREATE POLICY "solo_autenticados" ON public.apu_tarjetas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.bitacora_taller;
CREATE POLICY "solo_autenticados" ON public.bitacora_taller FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.bonos;
CREATE POLICY "solo_autenticados" ON public.bonos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.cajachica;
CREATE POLICY "solo_autenticados" ON public.cajachica FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.camion_documento;
CREATE POLICY "solo_autenticados" ON public.camion_documento FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.checador_registro;
CREATE POLICY "solo_autenticados" ON public.checador_registro FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.checador_reporte;
CREATE POLICY "solo_autenticados" ON public.checador_reporte FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.checador_zona;
CREATE POLICY "solo_autenticados" ON public.checador_zona FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.clientes;
CREATE POLICY "solo_autenticados" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.combustible;
CREATE POLICY "solo_autenticados" ON public.combustible FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.costo_operativo_otros;
CREATE POLICY "solo_autenticados" ON public.costo_operativo_otros FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.cuentas_por_cobrar;
CREATE POLICY "solo_autenticados" ON public.cuentas_por_cobrar FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.cuentas_por_pagar;
CREATE POLICY "solo_autenticados" ON public.cuentas_por_pagar FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.departamento;
CREATE POLICY "solo_autenticados" ON public.departamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.descuentos;
CREATE POLICY "solo_autenticados" ON public.descuentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.estimaciones_config_exportacion;
CREATE POLICY "solo_autenticados" ON public.estimaciones_config_exportacion FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.gastos;
CREATE POLICY "solo_autenticados" ON public.gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.incidencias;
CREATE POLICY "solo_autenticados" ON public.incidencias FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.inventario;
CREATE POLICY "solo_autenticados" ON public.inventario FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.invitados;
CREATE POLICY "solo_autenticados" ON public.invitados FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.logistica;
CREATE POLICY "solo_autenticados" ON public.logistica FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.m3;
CREATE POLICY "solo_autenticados" ON public.m3 FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.maquinaria;
CREATE POLICY "solo_autenticados" ON public.maquinaria FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.maquinaria_documento;
CREATE POLICY "solo_autenticados" ON public.maquinaria_documento FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.material;
CREATE POLICY "solo_autenticados" ON public.material FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.movimientos_inventario;
CREATE POLICY "solo_autenticados" ON public.movimientos_inventario FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.nominas;
CREATE POLICY "solo_autenticados" ON public.nominas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.operador;
CREATE POLICY "solo_autenticados" ON public.operador FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.operador_documento;
CREATE POLICY "solo_autenticados" ON public.operador_documento FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.orden_compra;
CREATE POLICY "solo_autenticados" ON public.orden_compra FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.orden_trabajo;
CREATE POLICY "solo_autenticados" ON public.orden_trabajo FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.orden_trabajo_detalle;
CREATE POLICY "solo_autenticados" ON public.orden_trabajo_detalle FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.pagos;
CREATE POLICY "solo_autenticados" ON public.pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.pagos_cxp;
CREATE POLICY "solo_autenticados" ON public.pagos_cxp FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.pagos_prestamos;
CREATE POLICY "solo_autenticados" ON public.pagos_prestamos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.precio_origen_destino;
CREATE POLICY "solo_autenticados" ON public.precio_origen_destino FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.prestamos;
CREATE POLICY "solo_autenticados" ON public.prestamos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.proveedor;
CREATE POLICY "solo_autenticados" ON public.proveedor FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.puesto;
CREATE POLICY "solo_autenticados" ON public.puesto FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.renta_maquinaria;
CREATE POLICY "solo_autenticados" ON public.renta_maquinaria FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.requisicion_compra;
CREATE POLICY "solo_autenticados" ON public.requisicion_compra FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.rol;
CREATE POLICY "solo_autenticados" ON public.rol FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public."user";
CREATE POLICY "solo_autenticados" ON public."user" FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.userroles;
CREATE POLICY "solo_autenticados" ON public.userroles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.vacaciones_periodos;
CREATE POLICY "solo_autenticados" ON public.vacaciones_periodos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.validaciones_inventario;
CREATE POLICY "solo_autenticados" ON public.validaciones_inventario FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.validaciones_inventario_detalle;
CREATE POLICY "solo_autenticados" ON public.validaciones_inventario_detalle FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "solo_autenticados" ON public.viajes;
CREATE POLICY "solo_autenticados" ON public.viajes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3) Caso especial: 'user' — login() consulta esta tabla ANTES de autenticar,
--    por email, para ver si existe y obtener su auth_id. Se permite SELECT a
--    'anon' pero SOLO en columnas seguras (nunca 'pass' ni 'sueldo').
--
--    Además: la política "solo_autenticados" de la sección 2 le da a
--    'authenticated' SELECT sin restricción de columnas, lo que significa que
--    CUALQUIER usuario logueado (no solo Admin) podía leer 'pass' — la
--    contraseña en texto plano de todos los usuarios — con solo
--    supabase.from('user').select('pass') desde la consola del navegador.
--    Se cierra restringiendo también el SELECT de 'authenticated' a columnas
--    seguras. Las escrituras (INSERT/UPDATE, incluida 'pass') se dejan igual,
--    porque operadoresService.ts sigue necesitando poder actualizar la
--    contraseña (solo no puede volver a leerla).
-- ----------------------------------------------------------------------------
REVOKE SELECT ON public."user" FROM anon;
GRANT SELECT (id, auth_id, nombre, apellido, email) ON public."user" TO anon;

DROP POLICY IF EXISTS "anon_select_basico" ON public."user";
CREATE POLICY "anon_select_basico" ON public."user" FOR SELECT TO anon USING (true);

REVOKE SELECT ON public."user" FROM authenticated;
GRANT SELECT (id, auth_id, nombre, apellido, ciudad, email) ON public."user" TO authenticated;

-- ----------------------------------------------------------------------------
-- 4) Caso especial: 'operador' — login() consulta esta tabla ANTES de
--    autenticar, para saber si el operador ligado al usuario está desactivado.
--    Se permite SELECT a 'anon' pero solo en columnas seguras.
--
--    PENDIENTE (mismo problema que 'user' arriba): 'operador' también tiene
--    una columna 'pass' en texto plano, y hoy cualquier 'authenticated' puede
--    leerla completa vía select('*') (Services/BD/operadoresService.ts:37).
--    No se restringe aquí todavía porque requiere la lista exacta de columnas
--    de 'operador' (son muchas y no todas están confirmadas) — hacerlo a
--    ciegas puede romper columnas que el código sí necesita leer. Correr:
--      SELECT column_name FROM information_schema.columns
--      WHERE table_schema='public' AND table_name='operador'
--      ORDER BY ordinal_position;
--    y pasar el resultado para completar este bloque.
-- ----------------------------------------------------------------------------
REVOKE SELECT ON public.operador FROM anon;
GRANT SELECT (id, nombre, estatus) ON public.operador TO anon;

DROP POLICY IF EXISTS "anon_select_basico" ON public.operador;
CREATE POLICY "anon_select_basico" ON public.operador FOR SELECT TO anon USING (true);

-- ----------------------------------------------------------------------------
-- 5) Vistas fetch_* — deben ejecutarse con los permisos de quien consulta
--    (no del dueño de la vista), para que respeten el RLS de las tablas base.
-- ----------------------------------------------------------------------------
ALTER VIEW public.fetch_apu_conceptos SET (security_invoker = on);
ALTER VIEW public.fetch_apu_insumos SET (security_invoker = on);
ALTER VIEW public.fetch_apu_maquinaria SET (security_invoker = on);
ALTER VIEW public.fetch_apu_presupuesto_conceptos SET (security_invoker = on);
ALTER VIEW public.fetch_apu_presupuesto_frentes SET (security_invoker = on);
ALTER VIEW public.fetch_apu_presupuesto_maquinaria SET (security_invoker = on);
ALTER VIEW public.fetch_apu_presupuesto_tarjeta_insumos SET (security_invoker = on);
ALTER VIEW public.fetch_apu_presupuesto_tarjetas SET (security_invoker = on);
ALTER VIEW public.fetch_apu_presupuestos SET (security_invoker = on);
ALTER VIEW public.fetch_apu_tarjeta_insumos SET (security_invoker = on);
ALTER VIEW public.fetch_apu_tarjetas SET (security_invoker = on);
ALTER VIEW public.fetch_bitacora_taller SET (security_invoker = on);
ALTER VIEW public.fetch_caja_chica SET (security_invoker = on);
ALTER VIEW public.fetch_gastos SET (security_invoker = on);
ALTER VIEW public.fetch_incidencias SET (security_invoker = on);
ALTER VIEW public.fetch_logistica SET (security_invoker = on);
ALTER VIEW public.fetch_origen_destino SET (security_invoker = on);
ALTER VIEW public.fetch_renta_maquinaria SET (security_invoker = on);
ALTER VIEW public.fetch_vacaciones SET (security_invoker = on);
ALTER VIEW public.fetch_viajes SET (security_invoker = on);

-- ----------------------------------------------------------------------------
-- 6) Storage: bucket de fotos del checador — solo autenticados.
--    OJO: confirma que el nombre del bucket sea exactamente 'checador-fotos'
--    (Storage > Buckets en el dashboard) antes de correr este bloque; si el
--    nombre es otro, ajústalo aquí.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "checador_fotos_autenticados_select" ON storage.objects;
CREATE POLICY "checador_fotos_autenticados_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'checador-fotos');

DROP POLICY IF EXISTS "checador_fotos_autenticados_insert" ON storage.objects;
CREATE POLICY "checador_fotos_autenticados_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'checador-fotos');

-- ============================================================================
-- NO se toca nada de: configuracion_fiscal, facturas, facturas_detalles
-- (facturación) — fuera de alcance a propósito.
-- ============================================================================
