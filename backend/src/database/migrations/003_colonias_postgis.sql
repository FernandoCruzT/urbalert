-- Migración 003 — tabla colonia_poligono con geometrías PostGIS
-- Ejecutar: psql -U postgres -d urbalert -f backend/src/database/migrations/003_colonias_postgis.sql

-- ── 1. Sectores faltantes ────────────────────────────────────────────────────
INSERT INTO sector (nombre)
SELECT unnest(ARRAY['Norte','Sur','Oriente','Poniente'])
WHERE NOT EXISTS (SELECT 1 FROM sector WHERE nombre = 'Norte');

-- Asegura que los 5 sectores existen (idempotente)
INSERT INTO sector (nombre)
VALUES ('Norte'), ('Sur'), ('Oriente'), ('Poniente'), ('Centro')
ON CONFLICT DO NOTHING;

-- ── 2. Tabla colonia_poligono ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS colonia_poligono (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      VARCHAR(150) NOT NULL,
  municipio   VARCHAR(100),
  cp          VARCHAR(5),
  sector_id   UUID REFERENCES sector(id),
  geom        GEOMETRY(MultiPolygon, 4326)
);

-- Índice espacial GIST para ST_Contains / ST_Within
CREATE INDEX IF NOT EXISTS idx_colonia_poligono_geom
  ON colonia_poligono USING GIST(geom);

-- Índice en nombre para búsquedas textuales
CREATE INDEX IF NOT EXISTS idx_colonia_poligono_nombre
  ON colonia_poligono (LOWER(nombre));

-- ── 3. FK en reporte ─────────────────────────────────────────────────────────
ALTER TABLE reporte
  ADD COLUMN IF NOT EXISTS colonia_poligono_id UUID
    REFERENCES colonia_poligono(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reporte_colonia_poligono_id
  ON reporte(colonia_poligono_id);
