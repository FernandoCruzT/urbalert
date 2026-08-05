-- Migración 007 — campo activo en usuario
-- Permite desactivar una cuenta de superadmin (autoborrado desde su perfil)
-- sin borrar la fila, igual que ya existe autoridad.activo para autoridades.
--
-- Ejecutar: psql "$DATABASE_URL" -f backend/src/database/migrations/007_usuario_activo.sql

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
