const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Permitir solicitudes desde cualquier origen
app.use(cors());

// Servir archivos estáticos desde la raíz para que index.html funcione
app.use(express.static(__dirname));

// Conectar a la base de datos
const db = new sqlite3.Database('./haxball.db', (err) => {
    if (err) {
        console.error('Error al abrir la base de datos:', err);
    } else {
        console.log('✅ Conectado a la base de datos');
    }
});

// Ruta para obtener todos los equipos
app.get('/api/equipos', (req, res) => {
    db.all('SELECT * FROM teams', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Ruta para obtener todos los fichajes
app.get('/api/fichajes', (req, res) => {
    db.all('SELECT * FROM fichajes', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Ruta para obtener fichajes de un equipo específico
app.get('/api/fichajes/:teamRoleId', (req, res) => {
    const { teamRoleId } = req.params;
    db.all('SELECT * FROM fichajes WHERE teamRoleId = ?', [teamRoleId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Enviar index.html al acceder a la raíz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Inicio del servidor
app.listen(PORT, () => {
    console.log(`🌐 Servidor web de Haxball funcionando ✅ en http://localhost:${PORT}`);
});
