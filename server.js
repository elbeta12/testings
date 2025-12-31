const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // sirve index.html y otros archivos

// Conectar a DB
const db = new sqlite3.Database('./haxball.db', err => {
    if (err) console.error('DB error:', err);
    else console.log('✅ DB conectada');
});

// Endpoints de ejemplo
app.get('/api/fichajes', (req, res) => {
    db.all('SELECT * FROM fichajes', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Enviar index.html al acceder a /
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🌐 Servidor corriendo en puerto ${PORT}`));
