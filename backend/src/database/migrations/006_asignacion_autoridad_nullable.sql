-- Migración 006 — permite autoridad_id NULL en tabla asignacion
-- Necesario para que el superadmin pueda reasignar reportes al pool automático
-- (autoridad_id = NULL) sin violar la constraint NOT NULL original.
--
-- Ejecutar: node backend/run-migration.js 006

ALTER TABLE asignacion ALTER COLUMN autoridad_id DROP NOT NULL;
