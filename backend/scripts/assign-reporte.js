require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { connectDB } = require('../src/database/connection');
const { assignReport } = require('../src/services/assignment.service');

const REPORTE_ID = '4a42c717-396c-43b8-a6c1-ed952faccab9'; // Lomas de Polanco, pendiente

(async () => {
  try {
    await connectDB();
    console.log(`Asignando reporte ${REPORTE_ID}...`);
    const autoridad = await assignReport(REPORTE_ID);
    if (!autoridad) {
      console.log('✗ Sin autoridad disponible — reporte sigue pendiente.');
    } else {
      console.log('✓ Asignado a:');
      console.log(`  nombre:          ${autoridad.nombre} ${autoridad.apellido}`);
      console.log(`  autoridad.id:    ${autoridad.id}`);
      console.log(`  departamento:    ${autoridad.departamento}`);
      console.log(`  carga_ponderada: ${autoridad.carga_ponderada}`);
    }
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
