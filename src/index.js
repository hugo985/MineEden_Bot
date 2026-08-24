// Bot con sistema de tickets, bienvenida y estado.
// Usa comandos por prefijo (por defecto `!`):
//   - `!ticket` -> abre un ticket
//   - `!ticket cerrar` -> cierra el ticket (solo autor o staff)
//   - `!help` -> ayuda
// Requiere estas variables en .env:
// DISCORD_TOKEN - token del bot
// PREFIX (opcional) - prefijo (por defecto !)
// TICKET_CATEGORY_NAME (opcional) - nombre de la categoría donde crear tickets (por defecto TICKETS)
// STAFF_ROLE_NAME (opcional) - nombre del rol de staff que podrá ver y cerrar tickets (por defecto Staff)
// WELCOME_CHANNEL_ID (opcional) - id del canal de bienvenida; si no está, se busca un canal llamado "welcome" o "bienvenidas"

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ActivityType,
  ChannelType,
} = require('discord.js');

const prefix = process.env.PREFIX || '!';
const token = process.env.DISCORD_TOKEN;
const TICKET_CATEGORY_NAME = process.env.TICKET_CATEGORY_NAME || 'TICKETS';
const STAFF_ROLE_NAME = process.env.STAFF_ROLE_NAME || 'Staff';
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID || null;

if (!token) {
  console.error('Falta DISCORD_TOKEN en .env — copia .env.example a .env y añade tu token');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, // necesario para evento guildMemberAdd (habilitar intent en Dev Portal)
  ],
  partials: [Partials.Channel],
});

client.once('ready', async () => {
  console.log(`Conectado como ${client.user.tag}`);
  try {
    await client.user.setPresence({
      activities: [{ name: 'Jugando MineEden', type: ActivityType.Playing }],
      status: 'online',
    });
  } catch (e) {
    console.warn('No se pudo establecer la presencia:', e.message || e);
  }
});

// Bienvenida: envía un mensaje en el canal de bienvenida configurado o en uno con nombres comunes
client.on('guildMemberAdd', async (member) => {
  try {
    const guild = member.guild;
    let channel = null;
    if (WELCOME_CHANNEL_ID) {
      channel = guild.channels.cache.get(WELCOME_CHANNEL_ID);
    }
    if (!channel) {
      channel = guild.channels.cache.find((c) =>
        c.type === ChannelType.GuildText && ['welcome', 'bienvenidas', 'general'].includes(c.name.toLowerCase())
      );
    }
    if (!channel) return; // no hay canal disponible

    channel.send(`¡Bienvenido/a, ${member}! 🎉

Pasa por los canales y lee las reglas. Si necesitas ayuda, abre un ticket con \\`${prefix}ticket\\`.`);
  } catch (err) {
    console.error('Error en guildMemberAdd:', err);
  }
});

// Sistema de tickets
async function findOrCreateTicketCategory(guild) {
  let category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === TICKET_CATEGORY_NAME);
  if (category) return category;
  try {
    category = await guild.channels.create({ name: TICKET_CATEGORY_NAME, type: ChannelType.GuildCategory });
    return category;
  } catch (err) {
    console.error('No se pudo crear la categoría de tickets:', err);
    throw err;
  }
}

function buildTicketChannelName(user) {
  const username = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const short = user.id.slice(-4);
  return `ticket-${username}-${short}`.slice(0, 100);
}

async function createTicket(message, reason) {
  const { guild, author } = message;
  if (!guild) return message.reply('Los tickets solo se pueden crear dentro de un servidor.');

  try {
    const category = await findOrCreateTicketCategory(guild);
    const channelName = buildTicketChannelName(author);

    // Buscar rol staff
    const staffRole = guild.roles.cache.find((r) => r.name === STAFF_ROLE_NAME);

    // Permission overwrites
    const overwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: author.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      },
    ];

    if (staffRole) {
      overwrites.push({
        id: staffRole.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      });
    }

    // Create channel inside category
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: overwrites,
      topic: `Ticket Owner: ${author.id} | Reason: ${reason || 'No especificado'}`,
    });

    await channel.send({ content: `${author}, tu ticket ha sido creado. Un miembro del staff te atenderá pronto.${staffRole ? ` ${staffRole}` : ''}` });
    await message.reply(`Tu ticket ha sido creado: ${channel}`);
  } catch (err) {
    console.error('Error creando ticket:', err);
    message.reply('Ocurrió un error al crear el ticket. Contacta a un administrador.');
  }
}

async function closeTicket(message) {
  const { channel, author, guild } = message;
  if (!guild) return message.reply('Este comando solo funciona en servidores.');

  // Verificar si el canal es un ticket (bajo la categoría de tickets)
  if (!channel.parent || channel.parent.name !== TICKET_CATEGORY_NAME) {
    return message.reply('Este comando solo puede usarse dentro de un canal de ticket.');
  }

  // Obtener owner desde el topic
  const topic = channel.topic || '';
  const match = topic.match(/Ticket Owner: (\d{17,19})/);
  const ownerId = match ? match[1] : null;

  const member = guild.members.cache.get(author.id);
  const staffRole = guild.roles.cache.find((r) => r.name === STAFF_ROLE_NAME);

  const isOwner = ownerId === author.id;
  const isStaff = staffRole ? member.roles.cache.has(staffRole.id) : false;

  if (!isOwner && !isStaff) {
    return message.reply('Solo el creador del ticket o el staff pueden cerrarlo.');
  }

  try {
    await channel.send('Cerrando ticket en 5 segundos...');
    setTimeout(async () => {
      try {
        await channel.delete('Ticket cerrado');
      } catch (e) {
        console.error('Error eliminando canal de ticket:', e);
      }
    }, 5000);
  } catch (err) {
    console.error('Error cerrando ticket:', err);
    message.reply('No pude cerrar el ticket automáticamente.');
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === 'ping') {
    return message.reply('Pong!');
  }

  if (command === 'help') {
    return message.reply(`Comandos disponibles:\n${prefix}ticket — abrir un ticket\n${prefix}ticket cerrar — cerrar ticket\n${prefix}ping — pong`);
  }

  if (command === 'ticket') {
    const sub = args.shift();
    if (!sub) {
      // Abrir ticket. Razon opcional en args.
      const reason = args.join(' ');
      return createTicket(message, reason);
    }

    if (sub === 'cerrar' || sub === 'close') {
      return closeTicket(message);
    }

    // por defecto, abrir ticket con todo como razón
    const reason = [sub, ...args].join(' ');
    return createTicket(message, reason);
  }
});

client.login(token).catch((err) => {
  console.error('Error iniciando sesión del bot:', err);
  process.exit(1);
});
