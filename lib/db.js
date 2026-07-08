const { Pool } = require('pg');

const connectionString = process.env.PURUBOY_PG_URL;

let pool;

if (!pool) {
    if (!connectionString) {
        console.warn('[DB] PURUBOY_PG_URL tidak diset — database tidak akan tersedia.');
        // Export dummy pool yang throw error jelas
        pool = {
            query: async () => { throw new Error('Database tidak dikonfigurasi: PURUBOY_PG_URL tidak diset'); },
        };
    } else {
        pool = new Pool({ connectionString });
    }
}

module.exports = pool;