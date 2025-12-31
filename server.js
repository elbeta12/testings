const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Permitir solicitudes desde cualquier origen
app.use(cors());

// Servir archivos estáticos de la raíz
app.use(express.static(__dirname));

// Conectar a SQLite
const db = new sqlite3.Database(path.join(__dirname, 'haxball.db'), (err) => {
    if (err) {
        console.error('❌ Error al abrir la base de datos:', err.message);
    } else {
        console.log('✅ Base de datos conectada');
        // Crear tabla fichajes si no existe
        db.run(`
            CREATE TABLE IF NOT EXISTS fichajes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                jugadorId TEXT,
                teamRoleId TEXT,
                posicion TEXT,
                dorsal TEXT,
                estado TEXT,
                fecha TEXT
            )
        `, (err) => {
            if (err) console.error('❌ Error creando tabla fichajes:', err.message);
            else console.log('✅ Tabla fichajes lista');
        });

        // Crear tabla equipos si no existe
        db.run(`
            CREATE TABLE IF NOT EXISTS teams (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT,
                roleId TEXT
            )
        `, (err) => {
            if (err) console.error('❌ Error creando tabla teams:', err.message);
            else console.log('✅ Tabla teams lista');
        });
    }
});

// API para obtener todos los fichajes
app.get('/api/fichajes', (req, res) => {
    db.all('SELECT * FROM fichajes', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API para obtener todos los equipos
app.get('/api/equipos', (req, res) => {
    db.all('SELECT * FROM teams', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API para fichajes por equipo
app.get('/api/fichajes/:teamRoleId', (req, res) => {
    const { teamRoleId } = req.params;
    db.all('SELECT * FROM fichajes WHERE teamRoleId = ?', [teamRoleId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Servir index.html en la raíz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🌐 Servidor web funcionando en https://tu-proyecto.up.railway.app/`);
});
