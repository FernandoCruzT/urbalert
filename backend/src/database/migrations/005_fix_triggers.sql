-- Migración 005 — corrige fn_recalcular_carga_autoridad
-- Solo cuenta reportes en estado 'asignado' o 'en_proceso' como activos.
-- El filtro anterior (NOT IN ('resuelto','cerrado')) incluía incorrectamente
-- estados como 'pendiente', 'enviado', 'en_revision', etc.
--
-- Ejecutar: psql -U postgres -d urbalert -f backend/src/database/migrations/005_fix_triggers.sql

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
          AND estado IN ('asignado', 'en_proceso')
    ) sub
    WHERE autoridad.id = p_autoridad_id;
END;
$$ LANGUAGE plpgsql;

-- Recalcular los valores actuales para todas las autoridades
-- (corregir datos acumulados con el filtro anterior)
DO $$
DECLARE
    v_id UUID;
BEGIN
    FOR v_id IN SELECT id FROM autoridad LOOP
        PERFORM fn_recalcular_carga_autoridad(v_id);
    END LOOP;
END;
$$;
