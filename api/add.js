import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    const { a, b } = req.query;
    const result = Number(a) + Number(b);

    try {
        const sql = neon(process.env.DATABASE_URL);
        await sql`CREATE TABLE IF NOT EXISTS logs (
            id SERIAL PRIMARY KEY,
            a FLOAT, b FLOAT, result FLOAT,
            created_at TIMESTAMP DEFAULT NOW()
        )`;
        await sql`INSERT INTO logs (a, b, result) VALUES (${Number(a)}, ${Number(b)}, ${result})`;
    } catch (err) {
        console.error('DB 저장 실패:', err);
    }

    res.status(200).json({ result });
}
