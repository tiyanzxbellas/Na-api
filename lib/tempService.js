const pool = require('./db');
const { v4: uuidv4 } = require('uuid');

// Ensure table exists
const ensureTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS temp_store (
            id UUID PRIMARY KEY,
            data JSONB NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL
        );
    `;
    await pool.query(query);
};

const tempService = {
    save: async (data, ttlMinutes = 30) => {
        await ensureTable();
        const id = uuidv4();
        // Set expiry time
        const expiresAt = new Date(Date.now() + ttlMinutes * 60000);
        
        const query = 'INSERT INTO temp_store (id, data, expires_at) VALUES ($1, $2, $3)';
        await pool.query(query, [id, data, expiresAt]);
        
        return id;
    },

    get: async (id) => {
        await ensureTable();
        // Fetch only if not expired
        const query = 'SELECT data FROM temp_store WHERE id = $1 AND expires_at > NOW()';
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) return null;
        return result.rows[0].data;
    }
};

module.exports = tempService;