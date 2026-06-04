/**
 * Script de un solo uso: crea un superadmin de prueba.
 * Uso: node backend/scripts/seed-superadmin.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { db, connectDB } = require('../src/database/connection');

const DATA = {
  nombre:   'Fernando',
  apellido: 'Cruz',
  email:    'cruzfernando3b46@gmail.com',
  password: 'contrasenia123',
  rol:      'superadmin',
};

(async () => {
  try {
    await connectDB();

    await db.tx(async (t) => {
      const existe = await t.oneOrNone(
        'SELECT id FROM usuario WHERE email = $1',
        DATA.email.toLowerCase()
      );
      if (existe) {
        console.log('⚠  El email ya existe en la base de datos. No se creó nada.');
        return;
      }

      const hash = await bcrypt.hash(DATA.password, 12);

      const usuario = await t.one(
        `INSERT INTO usuario (nombre, apellido, email, password_hash, rol)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, nombre, apellido, email, rol`,
        [DATA.nombre, DATA.apellido, DATA.email.toLowerCase(), hash, DATA.rol]
      );

      const perfil = await t.one(
        `INSERT INTO superadmin (usuario_id) VALUES ($1) RETURNING id`,
        usuario.id
      );

      console.log('✓ Superadmin creado correctamente');
      console.log(`  usuario_id  : ${usuario.id}`);
      console.log(`  superadmin_id: ${perfil.id}`);
      console.log(`  email       : ${usuario.email}`);
      console.log(`  rol         : ${usuario.rol}`);
    });

  } catch (err) {
    console.error('✗ Error:', err.message || err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
