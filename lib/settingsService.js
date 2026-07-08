const pool = require('./db');

const ensureSettingsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS settings (
            key VARCHAR(50) PRIMARY KEY,
            value JSONB NOT NULL
        );
    `;
    await pool.query(query);
};

const settingsService = {
    getFeatured: async () => {
        await ensureSettingsTable();
        const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['featured_endpoint']);
        return result.rows.length ? result.rows[0].value : null;
    },
    setFeatured: async (data) => {
        await ensureSettingsTable();
        const query = `
            INSERT INTO settings (key, value)
            VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = $2
            RETURNING value;
        `;
        const result = await pool.query(query, ['featured_endpoint', data]);
        return result.rows[0].value;
    }
};

module.exports = settingsService;