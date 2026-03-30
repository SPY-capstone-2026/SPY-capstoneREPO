import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    try {
        const { rows } = await sql`SELECT * FROM logs ORDER BY created_at DESC`;
        res.status(200).json({ logs: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
