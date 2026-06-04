-- Migración 001 — campos adicionales en reporte
-- Ejecutar: psql -U postgres -d urbalert -f backend/src/database/migrations/001_reporte_extras.sql

ALTER TABLE reporte
  ADD COLUMN IF NOT EXISTS confirmaciones_duplicado  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ubicacion_baja_precision  BOOLEAN NOT NULL DEFAULT FALSE;
