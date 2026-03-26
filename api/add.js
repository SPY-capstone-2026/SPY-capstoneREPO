export default function handler(req, res) {
    const { a, b } = req.query;
    const result = Number(a) + Number(b);

    res.status(200).json({ result });
}