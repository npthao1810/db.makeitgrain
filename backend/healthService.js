const database = require('./database');

async function check() {
  await database.query('SELECT 1');
  return { status: 'ok', database: 'connected' };
}

module.exports = { check };
