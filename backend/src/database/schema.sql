-- =============================================================
-- Urbalert — Schema PostgreSQL
-- =============================================================

-- -------------------------------------------------------------
-- Extensiones
-- -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================================
-- TABLAS INDEPENDIENTES (sin FK)
-- =============================================================

CREATE TABLE sector (
    id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE categoria (
    id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL
);

-- =============================================================
-- USUARIO
-- =============================================================

CREATE TABLE usuario (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre        VARCHAR(100)  NOT NULL,
    apellido      VARCHAR(100)  NOT NULL,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    telefono      VARCHAR(20),
    password_hash TEXT          NOT NULL,
    rol           VARCHAR(20)   NOT NULL CHECK (rol IN ('ciudadano', 'autoridad', 'superadmin')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================
-- PERFILES POR ROL
-- =============================================================

CREATE TABLE ciudadano (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id      UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    estado_cuenta   VARCHAR(20) NOT NULL DEFAULT 'activa'
                        CHECK (estado_cuenta IN ('activa', 'advertida', 'restringida', 'suspendida')),
    reportes_falsos INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE autoridad (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id        UUID        NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    categoria_id      UUID        NOT NULL REFERENCES categoria(id),
    sector_id         UUID        NOT NULL REFERENCES sector(id),
    departamento      VARCHAR(150),
    carga_ponderada   INTEGER NOT NULL DEFAULT 0,
    reportes_activos  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE superadmin (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE
);

-- =============================================================
-- COLONIA_SECTOR
-- =============================================================

CREATE TABLE colonia_sector (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sector_id      UUID        NOT NULL REFERENCES sector(id) ON DELETE CASCADE,
    nombre_colonia VARCHAR(150) NOT NULL,
    municipio      VARCHAR(100) NOT NULL
);

-- =============================================================
-- SUBCATEGORIA
-- =============================================================

CREATE TABLE subcategoria (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categoria_id  UUID        NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
    nombre        VARCHAR(150) NOT NULL,
    urgencia      VARCHAR(10)  NOT NULL CHECK (urgencia IN ('alto', 'medio', 'bajo')),
    razon_urgencia VARCHAR(255)
);

-- =============================================================
-- REPORTE
-- =============================================================

CREATE TABLE reporte (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ciudadano_id     UUID        NOT NULL REFERENCES ciudadano(id),
    categoria_id     UUID        NOT NULL REFERENCES categoria(id),
    subcategoria_id  UUID        NOT NULL REFERENCES subcategoria(id),
    autoridad_id     UUID             REFERENCES autoridad(id),
    reporte_padre_id UUID             REFERENCES reporte(id),
    descripcion      TEXT        NOT NULL,
    urgencia         VARCHAR(10)  NOT NULL CHECK (urgencia IN ('alto', 'medio', 'bajo')),
    estado           VARCHAR(20)  NOT NULL DEFAULT 'enviado'
                         CHECK (estado IN (
                             'enviado', 'en_validacion', 'en_revision', 'pendiente',
                             'asignado', 'en_proceso', 'resuelto', 'cerrado'
                         )),
    -- Ubicación textual
    calle            VARCHAR(150),
    numero           VARCHAR(20),
    colonia          VARCHAR(150),
    -- Coordenadas
    latitud          NUMERIC(10, 7),
    longitud         NUMERIC(10, 7),
    precision_gps    NUMERIC(6, 2),
    -- Punto geoespacial (PostGIS) — derivado de latitud/longitud
    ubicacion        GEOMETRY(Point, 4326),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- FOTO_REPORTE
-- =============================================================

CREATE TABLE foto_reporte (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporte_id      UUID        NOT NULL REFERENCES reporte(id) ON DELETE CASCADE,
    url_cloudinary  TEXT        NOT NULL,
    orden           INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- HISTORIAL_ESTADO
-- =============================================================

CREATE TABLE historial_estado (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporte_id      UUID        NOT NULL REFERENCES reporte(id) ON DELETE CASCADE,
    usuario_id      UUID             REFERENCES usuario(id) ON DELETE SET NULL,
    rol_usuario     VARCHAR(20)  NOT NULL CHECK (rol_usuario IN ('autoridad', 'superadmin', 'sistema')),
    estado_anterior VARCHAR(20)  NOT NULL
                        CHECK (estado_anterior IN (
                            'enviado', 'en_validacion', 'en_revision', 'pendiente',
                            'asignado', 'en_proceso', 'resuelto', 'cerrado'
                        )),
    estado_nuevo    VARCHAR(20)  NOT NULL
                        CHECK (estado_nuevo IN (
                            'enviado', 'en_validacion', 'en_revision', 'pendiente',
                            'asignado', 'en_proceso', 'resuelto', 'cerrado'
                        )),
    observacion     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- VALIDACION
-- =============================================================

CREATE TABLE validacion (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporte_id         UUID        NOT NULL REFERENCES reporte(id) ON DELETE CASCADE,
    superadmin_id      UUID        NOT NULL REFERENCES superadmin(id),
    resultado          VARCHAR(30)  NOT NULL
                           CHECK (resultado IN (
                               'sano', 'falso', 'duplicado',
                               'ubicacion_corregida', 'ubicacion_rechazada'
                           )),
    motivo             TEXT,
    similitud_texto    NUMERIC(4, 3),
    distancia_duplicado NUMERIC(8, 2),
    reporte_similar_id UUID             REFERENCES reporte(id),
    revisado_at        TIMESTAMPTZ
);

-- =============================================================
-- ASIGNACION
-- =============================================================

CREATE TABLE asignacion (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporte_id   UUID        NOT NULL REFERENCES reporte(id) ON DELETE CASCADE,
    autoridad_id UUID        NOT NULL REFERENCES autoridad(id),
    tipo         VARCHAR(20)  NOT NULL CHECK (tipo IN ('inicial', 'escalado', 'transferencia')),
    motivo       TEXT,
    asignado_por UUID             REFERENCES usuario(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- PENALIZACION
-- =============================================================

CREATE TABLE penalizacion (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ciudadano_id  UUID        NOT NULL REFERENCES ciudadano(id) ON DELETE CASCADE,
    reporte_id    UUID        NOT NULL REFERENCES reporte(id),
    tipo_sancion  VARCHAR(20)  NOT NULL CHECK (tipo_sancion IN ('advertencia', 'restriccion', 'suspension')),
    inicio        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fin           TIMESTAMPTZ,
    descripcion   TEXT
);

-- =============================================================
-- NOTIFICACION
-- =============================================================

CREATE TABLE notificacion (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID        NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    reporte_id UUID             REFERENCES reporte(id) ON DELETE SET NULL,
    titulo     VARCHAR(150) NOT NULL,
    mensaje    TEXT        NOT NULL,
    leida      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- ÍNDICES
-- =============================================================

-- REPORTE — campos más consultados en filtros y listados
CREATE INDEX idx_reporte_estado          ON reporte(estado);
CREATE INDEX idx_reporte_colonia         ON reporte(colonia);
CREATE INDEX idx_reporte_categoria_id    ON reporte(categoria_id);
CREATE INDEX idx_reporte_autoridad_id    ON reporte(autoridad_id);
CREATE INDEX idx_reporte_ciudadano_id    ON reporte(ciudadano_id);
CREATE INDEX idx_reporte_created_at      ON reporte(created_at DESC);
-- Índice espacial PostGIS para búsquedas por proximidad
CREATE INDEX idx_reporte_ubicacion       ON reporte USING GIST(ubicacion);

-- HISTORIAL_ESTADO
CREATE INDEX idx_historial_reporte_id    ON historial_estado(reporte_id);

-- NOTIFICACION — para cargar notificaciones no leídas de un usuario
CREATE INDEX idx_notificacion_usuario_leida ON notificacion(usuario_id, leida);

-- ASIGNACION
CREATE INDEX idx_asignacion_autoridad_id ON asignacion(autoridad_id);

-- VALIDACION
CREATE INDEX idx_validacion_reporte_id   ON validacion(reporte_id);

-- =============================================================
-- FUNCIONES DE APOYO
-- =============================================================

-- Función genérica para actualizar updated_at
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para sincronizar el campo ubicacion (geometry) desde latitud/longitud
CREATE OR REPLACE FUNCTION fn_sync_ubicacion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitud IS NOT NULL AND NEW.longitud IS NOT NULL THEN
        NEW.ubicacion = ST_SetSRID(ST_MakePoint(NEW.longitud, NEW.latitud), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para recalcular carga_ponderada y reportes_activos en AUTORIDAD
--
-- Lógica de ponderación:
--   urgencia alto   → peso 3
--   urgencia medio  → peso 2
--   urgencia bajo   → peso 1
-- Solo se cuentan reportes en estados activos (no resuelto / cerrado).
CREATE OR REPLACE FUNCTION fn_recalcular_carga_autoridad(p_autoridad_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE autoridad
    SET
        reportes_activos = sub.total,
        carga_ponderada  = sub.carga
    FROM (
        SELECT
            COUNT(*)                                              AS total,
            COALESCE(SUM(
                CASE urgencia
                    WHEN 'alto'  THEN 3
                    WHEN 'medio' THEN 2
                    ELSE              1
                END
            ), 0)                                                 AS carga
        FROM reporte
        WHERE autoridad_id = p_autoridad_id
          AND estado NOT IN ('resuelto', 'cerrado')
    ) sub
    WHERE autoridad.id = p_autoridad_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- TRIGGERS
-- =============================================================

-- 1. Actualizar updated_at en REPORTE
CREATE TRIGGER trg_reporte_updated_at
BEFORE UPDATE ON reporte
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

-- 2. Sincronizar campo ubicacion al insertar o actualizar coordenadas
CREATE TRIGGER trg_reporte_sync_ubicacion
BEFORE INSERT OR UPDATE OF latitud, longitud ON reporte
FOR EACH ROW
EXECUTE FUNCTION fn_sync_ubicacion();

-- 3. Recalcular carga de la autoridad cuando se asigna o se cambia el estado de un reporte
CREATE OR REPLACE FUNCTION fn_trg_carga_autoridad()
RETURNS TRIGGER AS $$
BEGIN
    -- Al insertar un reporte ya asignado
    IF TG_OP = 'INSERT' AND NEW.autoridad_id IS NOT NULL THEN
        PERFORM fn_recalcular_carga_autoridad(NEW.autoridad_id);

    -- Al actualizar: puede cambiar autoridad_id o estado
    ELSIF TG_OP = 'UPDATE' THEN
        -- Si la autoridad cambió, recalcular la anterior y la nueva
        IF OLD.autoridad_id IS DISTINCT FROM NEW.autoridad_id THEN
            IF OLD.autoridad_id IS NOT NULL THEN
                PERFORM fn_recalcular_carga_autoridad(OLD.autoridad_id);
            END IF;
            IF NEW.autoridad_id IS NOT NULL THEN
                PERFORM fn_recalcular_carga_autoridad(NEW.autoridad_id);
            END IF;
        -- Si solo cambió el estado y tiene autoridad asignada
        ELSIF OLD.estado IS DISTINCT FROM NEW.estado AND NEW.autoridad_id IS NOT NULL THEN
            PERFORM fn_recalcular_carga_autoridad(NEW.autoridad_id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reporte_carga_autoridad
AFTER INSERT OR UPDATE OF autoridad_id, estado ON reporte
FOR EACH ROW
EXECUTE FUNCTION fn_trg_carga_autoridad();
