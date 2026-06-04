-- Migración 004 — campo requiere_cambio_password en usuario
-- Ejecutar: psql -U postgres -d urbalert -f backend/src/database/migrations/004_requiere_cambio_password.sql

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS requiere_cambio_password BOOLEAN NOT NULL DEFAULT FALSE;
