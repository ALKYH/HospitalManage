const db = require('../db');

exports.createAccount = async (req, res) => {
    try {
        const created_at = new Date();
        const { id, username, password_hash, role } = req.body;

        const result = await db.query(
            'INSERT INTO accounts (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [id, username, password_hash, role, created_at, created_at]
        );

        res.status(201).json({ id: result.insertId, username, role, created_at });
    } catch (error) {
        console.error('Error creating account:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

