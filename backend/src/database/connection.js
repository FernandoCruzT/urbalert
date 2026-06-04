const pgp = require('pg-promise')();

const db = pgp({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'urbalert',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

/**
 * Verifica la conexión con la base de datos al arrancar.
 * Lanza un error si no se puede conectar.
 */
async function connectDB() {
  const conn = await db.connect();
  conn.done();
  console.log(`DB conectada → ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
}

module.exports = { db, connectDB };
