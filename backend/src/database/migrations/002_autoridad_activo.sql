-- Migración 002 — campo activo en autoridad
-- Ejecutar: psql -U postgres -d urbalert -f backend/src/database/migrations/002_autoridad_activo.sql

ALTER TABLE autoridad
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- Índice para filtrar solo autoridades activas en la asignación
CREATE INDEX IF NOT EXISTS idx_autoridad_activo ON autoridad(activo);
