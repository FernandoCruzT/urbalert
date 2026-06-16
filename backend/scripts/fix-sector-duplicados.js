/**
 * fix-sector-duplicados.js
 * Consolida UUIDs duplicados de la tabla sector.
 * Canónico = UUID con más colonias vinculadas (el que usó seed-colonias-postgis.js).
 * Perdedor  = UUID con 0 colonias (creado por seed de usuarios/autoridades hardcodeado).
 *
 * Acciones:
 *   1. Detectar pares canónico/perdedor por nombre.
 *   2. Redirigir autoridad.sector_id  del perdedor → canónico.
 *   3. Eliminar filas perdedoras de sector.
 *   4. Mostrar estado final.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { db, connectDB } = require('../src/database/connection');

(async () => {
  try {
    await connectDB();

    // ── 1. Obtener pares por nombre ────────────────────────────────────────────
    const rows = await db.any(`
      SELECT s.id, s.nombre, COUNT(cp.id)::int AS colonias,
             (SELECT COUNT(*) FROM autoridad WHERE sector_id = s.id)::int AS autoridades
      FROM sector s
      LEFT JOIN colonia_poligono cp ON cp.sector_id = s.id
      GROUP BY s.id, s.nombre
      ORDER BY s.nombre, COUNT(cp.id) DESC
    `);

    // Agrupar por nombre
    const byNombre = {};
    for (const r of rows) {
      (byNombre[r.nombre] ??= []).push(r);
    }

    const pares = []; // { nombre, canonico, perdedor }
    for (const [nombre, grupo] of Object.entries(byNombre)) {
      if (grupo.length < 2) {
        console.log(`[OK] ${nombre}: un solo UUID, sin conflicto.`);
        continue;
      }
      // El canónico tiene más colonias; si empatan, el primero alfabéticamente
      const sorted = grupo.sort((a, b) => b.colonias - a.colonias);
      const canonico = sorted[0];
      const perdedores = sorted.slice(1);
      for (const perdedor of perdedores) {
        pares.push({ nombre, canonico, perdedor });
        console.log(`[DUP] ${nombre}:`);
        console.log(`      canónico  → ${canonico.id}  (${canonico.colonias} colonias, ${canonico.autoridades} autoridades)`);
        console.log(`      perdedor  → ${perdedor.id}  (${perdedor.colonias} colonias, ${perdedor.autoridades} autoridades)`);
      }
    }

    if (pares.length === 0) {
      console.log('\n✓ Sin duplicados. Nada que corregir.');
      return;
    }

    // ── 2. Corregir dentro de una transacción ──────────────────────────────────
    await db.tx(async (t) => {
      for (const { nombre, canonico, perdedor } of pares) {

        // Redirigir autoridades
        const updA = await t.result(
          `UPDATE autoridad SET sector_id = $1 WHERE sector_id = $2`,
          [canonico.id, perdedor.id]
        );
        if (updA.rowCount > 0)
          console.log(`  [autoridad] ${updA.rowCount} fila(s) de ${nombre} redirigidas → ${canonico.id}`);

        // Redirigir colonia_poligono por si alguna apunta al perdedor
        const updCP = await t.result(
          `UPDATE colonia_poligono SET sector_id = $1 WHERE sector_id = $2`,
          [canonico.id, perdedor.id]
        );
        if (updCP.rowCount > 0)
          console.log(`  [colonia_poligono] ${updCP.rowCount} fila(s) de ${nombre} redirigidas → ${canonico.id}`);

        // Eliminar sector perdedor
        await t.none(`DELETE FROM sector WHERE id = $1`, [perdedor.id]);
        console.log(`  [sector] UUID perdedor ${perdedor.id} eliminado.`);
      }
    });

    // ── 3. Estado final ────────────────────────────────────────────────────────
    const final = await db.any(`
      SELECT s.id, s.nombre,
             COUNT(cp.id)::int AS colonias,
             (SELECT COUNT(*) FROM autoridad WHERE sector_id = s.id)::int AS autoridades
      FROM sector s
      LEFT JOIN colonia_poligono cp ON cp.sector_id = s.id
      GROUP BY s.id, s.nombre
      ORDER BY s.nombre
    `);

    console.log('\n── Estado final de sector ─────────────────────────────────────────────');
    console.log(`${'nombre'.padEnd(12)} ${'colonias'.padEnd(10)} ${'autoridades'.padEnd(12)} id`);
    console.log('─'.repeat(80));
    for (const r of final) {
      console.log(`${r.nombre.padEnd(12)} ${String(r.colonias).padEnd(10)} ${String(r.autoridades).padEnd(12)} ${r.id}`);
    }
    console.log(`\n✓ Total sectores: ${final.length} ${final.length === 5 ? '(correcto ✓)' : '← revisar'}`);

  } catch (err) {
    console.error('\n✗ Error:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
