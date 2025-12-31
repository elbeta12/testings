


const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const cors = require('cors');

// Inicializar Express para API
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Inicializar base de datos
const db = new sqlite3.Database('./haxball.db', (err) => {
    if (err) {
        console.error('Error al abrir la base de datos:', err);
    } else {
        console.log('✅ Base de datos conectada');
        initDatabase();
    }
});

// Crear tablas si no existen
function initDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS config (
            id INTEGER PRIMARY KEY,
            agenteLibreRoleId TEXT,
            jugadorRoleId TEXT,
            dtRoleId TEXT,
            canalFichajesId TEXT,
            canalBienvenidaId TEXT,
            imagenBienvenida TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            roleId TEXT UNIQUE,
            nombre TEXT,
            logo TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS fichajes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jugadorId TEXT,
            jugadorNombre TEXT,
            teamRoleId TEXT,
            teamNombre TEXT,
            posicion TEXT,
            dorsal TEXT,
            dtId TEXT,
            dtNombre TEXT,
            fecha TEXT,
            estado TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS historial (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT,
            jugadorId TEXT,
            jugadorNombre TEXT,
            teamNombre TEXT,
            teamLogo TEXT,
            posicion TEXT,
            dorsal TEXT,
            motivo TEXT,
            fecha TEXT,
            timestamp INTEGER
        )`);

        db.run(`INSERT OR IGNORE INTO config (id, agenteLibreRoleId, jugadorRoleId, dtRoleId, canalFichajesId, canalBienvenidaId, imagenBienvenida) 
                VALUES (1, '', '', '', '', '', '')`);
        
        console.log('✅ Tablas de base de datos creadas');
    });
}

// ==================== FUNCIONES DE BASE DE DATOS ====================

function getConfig(callback) {
    db.get('SELECT * FROM config WHERE id = 1', callback);
}

function updateConfig(data, callback) {
    db.run(`UPDATE config SET 
            agenteLibreRoleId = ?, 
            jugadorRoleId = ?, 
            dtRoleId = ?, 
            canalFichajesId = ?,
            canalBienvenidaId = ?,
            imagenBienvenida = ?
            WHERE id = 1`,
        [data.agenteLibreRoleId, data.jugadorRoleId, data.dtRoleId, 
         data.canalFichajesId, data.canalBienvenidaId, data.imagenBienvenida],
        callback
    );
}

function addTeam(team, callback) {
    db.run(`INSERT INTO teams (roleId, nombre, logo) VALUES (?, ?, ?)`,
        [team.roleId, team.nombre, team.logo],
        callback
    );
}

function getTeamByRoleId(roleId, callback) {
    db.get('SELECT * FROM teams WHERE roleId = ?', [roleId], callback);
}

function getAllTeams(callback) {
    db.all('SELECT * FROM teams', callback);
}

function findTeamByDTRole(roles, callback) {
    const roleIds = Array.from(roles.keys());
    const placeholders = roleIds.map(() => '?').join(',');
    db.get(`SELECT * FROM teams WHERE roleId IN (${placeholders})`, roleIds, callback);
}

function addFichaje(fichaje, callback) {
    db.run(`INSERT INTO fichajes 
        (jugadorId, jugadorNombre, teamRoleId, teamNombre, posicion, dorsal, dtId, dtNombre, fecha, estado) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            fichaje.jugadorId,
            fichaje.jugadorNombre,
            fichaje.teamRoleId,
            fichaje.teamNombre,
            fichaje.posicion,
            fichaje.dorsal,
            fichaje.dtId,
            fichaje.dtNombre,
            fichaje.fecha,
            fichaje.estado
        ],
        callback
    );
}

function updateFichajeEstado(jugadorId, teamRoleId, estado, callback) {
    db.run(`UPDATE fichajes SET estado = ? WHERE jugadorId = ? AND teamRoleId = ? AND estado = 'pendiente'`,
        [estado, jugadorId, teamRoleId],
        callback
    );
}

function removeFichaje(jugadorId, callback) {
    db.run('DELETE FROM fichajes WHERE jugadorId = ?', [jugadorId], callback);
}

function addHistorial(item, callback) {
    db.run(`INSERT INTO historial 
        (tipo, jugadorId, jugadorNombre, teamNombre, teamLogo, posicion, dorsal, motivo, fecha, timestamp) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            item.tipo,
            item.jugadorId,
            item.jugadorNombre,
            item.teamNombre,
            item.teamLogo,
            item.posicion,
            item.dorsal,
            item.motivo,
            item.fecha,
            Date.now()
        ],
        callback
    );
}

function getHistorial(callback) {
    db.all('SELECT * FROM historial ORDER BY timestamp DESC LIMIT 50', callback);
}

// ==================== API REST ENDPOINTS ====================

// Obtener historial de fichajes y bajas
app.get('/api/historial', (req, res) => {
    getHistorial((err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener historial' });
        }
        res.json(rows);
    });
});

// Obtener equipos
app.get('/api/equipos', (req, res) => {
    getAllTeams((err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Error al obtener equipos' });
        }
        res.json(rows);
    });
});

// Obtener plantilla de un equipo
app.get('/api/equipo/:roleId', (req, res) => {
    db.all('SELECT * FROM fichajes WHERE teamRoleId = ? AND estado = "aceptado"', 
        [req.params.roleId], 
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Error al obtener plantilla' });
            }
            res.json(rows);
        }
    );
});

// Iniciar servidor Express
app.listen(PORT, () => {
    console.log(`✅ API REST corriendo en puerto ${PORT}`);
});

// ==================== CLIENTE DE DISCORD ====================


const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.error("No se encontró el token. Revisa las variables de entorno en Railway.");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

function countTeamPlayers(guild, roleId) {
    return guild.members.cache.filter(member => 
        member.roles.cache.has(roleId)
    ).size;
}

// ==================== EVENTO DE BIENVENIDA ====================

client.on('guildMemberAdd', async member => {
    getConfig((err, config) => {
        if (!config || !config.canalBienvenidaId) return;

        const canalBienvenida = member.guild.channels.cache.get(config.canalBienvenidaId);
        if (!canalBienvenida) return;

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎉 ¡Nuevo Jugador en el Servidor!')
            .setDescription(`**${member.user.username}**, ¡bienvenido a la liga de Haxball más competitiva!\n\n¿Listo para demostrar tu talento? Los equipos están buscando nuevas estrellas.`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '⚽ Tu Estado', value: 'Agente Libre - Disponible para fichajes', inline: false },
                { name: '🌟 Miembros Totales', value: `${member.guild.memberCount} jugadores`, inline: false }
            )
            .setFooter({ text: '¡Prepárate para la acción!' })
            .setTimestamp();

        if (config.imagenBienvenida) {
            embed.setImage(config.imagenBienvenida);
        }

        canalBienvenida.send({ 
            content: `<@${member.id}> 👋`,
            embeds: [embed] 
        });
    });
});

// ==================== REGISTRO DE COMANDOS ====================

client.once('ready', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    console.log('TOKEN:', process.env.DISCORD_TOKEN);

    const commands = [
        new SlashCommandBuilder()
            .setName('config')
            .setDescription('Configura los roles y canales del bot')
            .addRoleOption(option =>
                option.setName('agente_libre')
                    .setDescription('Rol de Agente Libre')
                    .setRequired(true))
            .addRoleOption(option =>
                option.setName('jugador')
                    .setDescription('Rol de Jugador')
                    .setRequired(true))
            .addRoleOption(option =>
                option.setName('dt')
                    .setDescription('Rol de Director Técnico')
                    .setRequired(true))
            .addChannelOption(option =>
                option.setName('canal_fichajes')
                    .setDescription('Canal para enviar ofertas de fichaje')
                    .setRequired(true))
            .addChannelOption(option =>
                option.setName('canal_bienvenida')
                    .setDescription('Canal para mensajes de bienvenida')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('imagen_bienvenida')
                    .setDescription('URL de la imagen de bienvenida')
                    .setRequired(false))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

        new SlashCommandBuilder()
            .setName('añadir_equipo')
            .setDescription('Añade un equipo al sistema')
            .addRoleOption(option =>
                option.setName('rol_equipo')
                    .setDescription('Rol del equipo')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('nombre')
                    .setDescription('Nombre del equipo')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('logo')
                    .setDescription('URL del escudo del equipo')
                    .setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

        new SlashCommandBuilder()
            .setName('fichar')
            .setDescription('Envía una oferta de fichaje a un jugador')
            .addUserOption(option =>
                option.setName('jugador')
                    .setDescription('Jugador a fichar')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('posicion')
                    .setDescription('Posición del jugador')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('dorsal')
                    .setDescription('Número de dorsal')
                    .setRequired(false)),

        new SlashCommandBuilder()
            .setName('baja')
            .setDescription('Da de baja a un jugador del equipo')
            .addUserOption(option =>
                option.setName('jugador')
                    .setDescription('Jugador a dar de baja')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('motivo')
                    .setDescription('Motivo de la baja')
                    .setRequired(false)),

        new SlashCommandBuilder()
            .setName('equipos')
            .setDescription('Lista todos los equipos registrados'),

        new SlashCommandBuilder()
            .setName('mi_equipo')
            .setDescription('Muestra información de tu equipo'),

        new SlashCommandBuilder()
            .setName('info_equipo')
            .setDescription('Muestra información detallada de un equipo')
            .addRoleOption(option =>
                option.setName('equipo')
                    .setDescription('Rol del equipo a consultar')
                    .setRequired(true))
    ];

    try {
        await client.application.commands.set(commands);
        console.log('✅ Comandos slash registrados');
    } catch (error) {
        console.error('❌ Error registrando comandos:', error);
    }
});

// ==================== MANEJO DE COMANDOS ====================

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand() && !interaction.isButton()) return;

    // COMANDO: /config
    if (interaction.commandName === 'config') {
        const configData = {
            agenteLibreRoleId: interaction.options.getRole('agente_libre').id,
            jugadorRoleId: interaction.options.getRole('jugador').id,
            dtRoleId: interaction.options.getRole('dt').id,
            canalFichajesId: interaction.options.getChannel('canal_fichajes').id,
            canalBienvenidaId: interaction.options.getChannel('canal_bienvenida').id,
            imagenBienvenida: interaction.options.getString('imagen_bienvenida') || ''
        };

        updateConfig(configData, (err) => {
            if (err) {
                return interaction.reply({
                    content: '❌ Error al guardar la configuración',
                    ephemeral: true
                });
            }
            interaction.reply({
                content: '✅ Configuración guardada correctamente',
                ephemeral: true
            });
        });
    }

    // COMANDO: /añadir_equipo
    if (interaction.commandName === 'añadir_equipo') {
        const role = interaction.options.getRole('rol_equipo');
        const nombre = interaction.options.getString('nombre');
        const logo = interaction.options.getString('logo');

        getTeamByRoleId(role.id, (err, existingTeam) => {
            if (existingTeam) {
                return interaction.reply({
                    content: '❌ Este rol ya está asignado a un equipo',
                    ephemeral: true
                });
            }

            addTeam({ roleId: role.id, nombre, logo }, (err) => {
                if (err) {
                    return interaction.reply({
                        content: '❌ Error al añadir el equipo',
                        ephemeral: true
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('✅ Equipo Registrado')
                    .setThumbnail(logo)
                    .setDescription(`**${nombre}** ha sido añadido al sistema de fichajes`)
                    .addFields(
                        { name: '🎭 Rol Asignado', value: `<@&${role.id}>`, inline: true },
                        { name: '👥 Límite de Plantilla', value: '15 jugadores', inline: true }
                    )
                    .setFooter({ text: 'El equipo ya puede empezar a fichar jugadores' })
                    .setTimestamp();

                interaction.reply({ embeds: [embed], ephemeral: true });
            });
        });
    }

    // COMANDO: /fichar
    if (interaction.commandName === 'fichar') {
        const member = interaction.member;
        const jugador = interaction.options.getUser('jugador');
        const jugadorMember = interaction.guild.members.cache.get(jugador.id);
        const posicion = interaction.options.getString('posicion');
        const dorsal = interaction.options.getInteger('dorsal') || 0;

        getConfig((err, config) => {
            if (!config || !config.dtRoleId) {
                return interaction.reply({
                    content: '❌ El bot no está configurado. Usa /config primero',
                    ephemeral: true
                });
            }

            if (!member.roles.cache.has(config.dtRoleId)) {
                return interaction.reply({
                    content: '❌ No tienes permisos de Director Técnico',
                    ephemeral: true
                });
            }

            findTeamByDTRole(member.roles.cache, (err, team) => {
                if (!team) {
                    return interaction.reply({
                        content: '❌ No tienes un equipo asignado. Contacta a un administrador.',
                        ephemeral: true
                    });
                }

                const currentPlayers = countTeamPlayers(interaction.guild, team.roleId);
                if (currentPlayers >= 15) {
                    return interaction.reply({
                        content: '❌ Tu equipo ya tiene 15 jugadores (límite máximo)',
                        ephemeral: true
                    });
                }

                if (!jugadorMember.roles.cache.has(config.agenteLibreRoleId)) {
                    return interaction.reply({
                        content: '❌ El jugador seleccionado no es agente libre',
                        ephemeral: true
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle('⚽ NUEVA OFERTA DE FICHAJE')
                    .setDescription(`**${team.nombre}** quiere ficharte para su plantilla`)
                    .setThumbnail(team.logo)
                    .addFields(
                        { name: '👤 Jugador', value: `<@${jugador.id}>`, inline: true },
                        { name: '⚽ Posición', value: posicion, inline: true },
                        { name: '🔢 Dorsal', value: dorsal ? dorsal.toString() : 'Por asignar', inline: true },
                        { name: '🏆 Equipo', value: team.nombre, inline: true },
                        { name: '👔 Director Técnico', value: `<@${member.id}>`, inline: true },
                        { name: '📊 Plantilla Actual', value: `${currentPlayers}/15`, inline: true }
                    )
                    .setFooter({ text: '¿Aceptas la oferta? Decide tu futuro' })
                    .setTimestamp();

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`aceptar_${jugador.id}_${team.roleId}`)
                            .setLabel('✅ Aceptar Fichaje')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`rechazar_${jugador.id}_${team.roleId}`)
                            .setLabel('❌ Rechazar Fichaje')
                            .setStyle(ButtonStyle.Danger)
                    );

                addFichaje({
                    jugadorId: jugador.id,
                    jugadorNombre: jugador.username,
                    teamRoleId: team.roleId,
                    teamNombre: team.nombre,
                    posicion,
                    dorsal: dorsal || 0,
                    dtId: member.id,
                    dtNombre: member.user.username,
                    fecha: new Date().toISOString(),
                    estado: 'pendiente'
                }, () => {});

                const canal = interaction.guild.channels.cache.get(config.canalFichajesId);
                if (!canal) {
                    return interaction.reply({
                        content: '❌ Canal de fichajes no configurado',
                        ephemeral: true
                    });
                }

                canal.send({
                    content: `<@${jugador.id}> 🔔 **¡TIENES UNA OFERTA!**`,
                    embeds: [embed],
                    components: [row]
                });

                interaction.reply({
                    content: `✅ Oferta enviada a <@${jugador.id}>`,
                    ephemeral: true
                });
            });
        });
    }

    // COMANDO: /baja
    if (interaction.commandName === 'baja') {
        const member = interaction.member;
        const jugador = interaction.options.getUser('jugador');
        const jugadorMember = interaction.guild.members.cache.get(jugador.id);
        const motivo = interaction.options.getString('motivo') || 'Decisión técnica';

        getConfig((err, config) => {
            if (!config || !config.dtRoleId) {
                return interaction.reply({
                    content: '❌ El bot no está configurado',
                    ephemeral: true
                });
            }

            if (!member.roles.cache.has(config.dtRoleId)) {
                return interaction.reply({
                    content: '❌ No tienes permisos de Director Técnico',
                    ephemeral: true
                });
            }

            findTeamByDTRole(member.roles.cache, (err, team) => {
                if (!team) {
                    return interaction.reply({
                        content: '❌ No tienes un equipo asignado',
                        ephemeral: true
                    });
                }

                if (!jugadorMember.roles.cache.has(team.roleId)) {
                    return interaction.reply({
                        content: '❌ Este jugador no pertenece a tu equipo',
                        ephemeral: true
                    });
                }

                // Buscar datos del fichaje antes de eliminarlo
                db.get('SELECT * FROM fichajes WHERE jugadorId = ? AND teamRoleId = ?', 
                    [jugador.id, team.roleId], 
                    (err, fichaje) => {
                        
                    jugadorMember.roles.remove([team.roleId, config.jugadorRoleId]);
                    jugadorMember.roles.add(config.agenteLibreRoleId);

                    // Agregar al historial
                    addHistorial({
                        tipo: 'baja',
                        jugadorId: jugador.id,
                        jugadorNombre: jugador.username,
                        teamNombre: team.nombre,
                        teamLogo: team.logo,
                        posicion: fichaje ? fichaje.posicion : '',
                        dorsal: fichaje ? fichaje.dorsal : 0,
                        motivo: motivo,
                        fecha: new Date().toISOString()
                    }, () => {});

                    removeFichaje(jugador.id, () => {});

                    const embed = new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle('📉 BAJA CONFIRMADA')
                        .setDescription(`**${team.nombre}** ha rescindido el contrato de un jugador`)
                        .setThumbnail(team.logo)
                        .addFields(
                            { name: '👤 Jugador', value: `<@${jugador.id}>`, inline: true },
                            { name: '🏆 Equipo', value: team.nombre, inline: true },
                            { name: '📝 Motivo', value: motivo, inline: false },
                            { name: '👔 Director Técnico', value: `<@${member.id}>`, inline: true },
                            { name: '📊 Estado Actual', value: 'Agente Libre', inline: true }
                        )
                        .setFooter({ text: 'El jugador vuelve al mercado de fichajes' })
                        .setTimestamp();

                    const canal = interaction.guild.channels.cache.get(config.canalFichajesId);
                    if (canal) {
                        canal.send({ embeds: [embed] });
                    }

                    interaction.reply({
                        content: `✅ <@${jugador.id}> ha sido dado de baja`,
                        ephemeral: true
                    });
                });
            });
        });
    }

    // COMANDO: /equipos
    if (interaction.commandName === 'equipos') {
        getAllTeams((err, teams) => {
            if (!teams || teams.length === 0) {
                return interaction.reply({
                    content: '❌ No hay equipos registrados',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle('🏆 EQUIPOS DE LA LIGA')
                .setDescription('Todos los equipos participantes en la competición')
                .setTimestamp();

            teams.forEach(team => {
                const playerCount = countTeamPlayers(interaction.guild, team.roleId);
                embed.addFields({
                    name: `⚽ ${team.nombre}`,
                    value: `**Plantilla:** ${playerCount}/15 jugadores\n**Rol:** <@&${team.roleId}>`,
                    inline: true
                });
            });

            interaction.reply({ embeds: [embed] });
        });
    }

    // COMANDO: /mi_equipo
    if (interaction.commandName === 'mi_equipo') {
        getConfig((err, config) => {
            findTeamByDTRole(interaction.member.roles.cache, (err, team) => {
                if (!team) {
                    return interaction.reply({
                        content: '❌ No tienes un equipo asignado',
                        ephemeral: true
                    });
                }

                const playerCount = countTeamPlayers(interaction.guild, team.roleId);
                const players = interaction.guild.members.cache
                    .filter(m => m.roles.cache.has(team.roleId) && !m.roles.cache.has(config.dtRoleId))
                    .map(m => `⚽ <@${m.id}>`)
                    .join('\n') || 'Sin jugadores fichados';

                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle(`📋 ${team.nombre}`)
                    .setDescription('Información completa de tu equipo')
                    .setThumbnail(team.logo)
                    .addFields(
                        { name: '👥 Plantilla', value: `${playerCount}/15 jugadores`, inline: true },
                        { name: '🎭 Rol del Equipo', value: `<@&${team.roleId}>`, inline: true },
                        { name: '⚽ Jugadores Fichados', value: players, inline: false }
                    )
                    .setFooter({ text: 'Gestiona tu equipo con /fichar y /baja' })
                    .setTimestamp();

                interaction.reply({ embeds: [embed], ephemeral: true });
            });
        });
    }

    // COMANDO: /info_equipo
    if (interaction.commandName === 'info_equipo') {
        const equipoRole = interaction.options.getRole('equipo');
        
        getTeamByRoleId(equipoRole.id, (err, team) => {
            if (!team) {
                return interaction.reply({
                    content: '❌ Este equipo no está registrado en el sistema',
                    ephemeral: true
                });
            }

            getConfig((err, config) => {
                const dt = interaction.guild.members.cache.find(m => 
                    m.roles.cache.has(team.roleId) && m.roles.cache.has(config.dtRoleId)
                );

                const playerCount = countTeamPlayers(interaction.guild, team.roleId);
                const players = interaction.guild.members.cache
                    .filter(m => m.roles.cache.has(team.roleId) && !m.roles.cache.has(config.dtRoleId))
                    .map(m => `⚽ <@${m.id}>`)
                    .join('\n') || 'Sin jugadores fichados';

                const embed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle(`🏆 ${team.nombre}`)
                    .setDescription('Información detallada del equipo')
                    .setThumbnail(team.logo)
                    .addFields(
                        { name: '👔 Director Técnico', value: dt ? `<@${dt.id}>` : 'Sin DT asignado', inline: true },
                        { name: '👥 Plantilla', value: `${playerCount}/15`, inline: true },
                        { name: '🎭 Rol', value: `<@&${team.roleId}>`, inline: true },
                        { name: '⚽ Jugadores', value: players, inline: false }
                    )
                    .setFooter({ text: `${team.nombre} - Liga Haxball` })
                    .setTimestamp();

                interaction.reply({ embeds: [embed] });
            });
        });
    }

    // ==================== MANEJO DE BOTONES ====================

if (interaction.isButton()) {
    const [action, jugadorId, teamRoleId] = interaction.customId.split('_');

    // Solo el jugador puede responder
    if (interaction.user.id !== jugadorId) {
        return interaction.reply({
            content: '❌ Solo el jugador puede responder a esta oferta',
            ephemeral: true
        });
    }

    getConfig((err, config) => {
        const jugadorMember = interaction.guild.members.cache.get(jugadorId);

        getTeamByRoleId(teamRoleId, (err, team) => {

            // ===== ACEPTAR FICHAJE =====
            if (action === 'aceptar') {
                const currentPlayers = countTeamPlayers(interaction.guild, teamRoleId);

                // Equipo lleno
                if (currentPlayers >= 15) {
                    updateFichajeEstado(jugadorId, teamRoleId, 'rechazado', () => {});
                    return interaction.update({
                        content: '❌ El equipo ya tiene 15 jugadores',
                        components: []
                    });
                }

                // Roles
                jugadorMember.roles.remove(config.agenteLibreRoleId);
                jugadorMember.roles.add([config.jugadorRoleId, teamRoleId]);

                // BD
                updateFichajeEstado(jugadorId, teamRoleId, 'aceptado', () => {});

                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('✅ ¡FICHAJE CONFIRMADO!')
                    .setDescription(`<@${jugadorId}> es nuevo jugador de **${team.nombre}**`)
                    .setThumbnail(team.logo)
                    .addFields(
                        { name: '📊 Plantilla', value: `${currentPlayers + 1}/15`, inline: true },
                        { name: '🎭 Rol', value: `<@&${teamRoleId}>`, inline: true }
                    )
                    .setFooter({ text: '¡A demostrar tu talento!' })
                    .setTimestamp();

                return interaction.update({
                    embeds: [embed],
                    components: []
                });
            }

            // ===== RECHAZAR FICHAJE =====
            if (action === 'rechazar') {
                updateFichajeEstado(jugadorId, teamRoleId, 'rechazado', () => {});

                jugadorMember.roles.add(config.agenteLibreRoleId);

                const embed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('❌ FICHAJE RECHAZADO')
                    .setDescription(`<@${jugadorId}> ha rechazado la oferta de **${team.nombre}**`)
                    .setThumbnail(team.logo)
                    .addFields(
                        { name: '📋 Estado', value: 'Oferta rechazada', inline: true },
                        { name: '⚽ Jugador', value: 'Sigue como Agente Libre', inline: true }
                    )
                    .setFooter({ text: 'El jugador busca otras opciones' })
                    .setTimestamp();

                return interaction.update({
                    embeds: [embed],
                    components: []
                });
            }

        });
    });
}
});

// Login del bot
client.login(token);


