// Bot mínimo en CommonJS para compatibilidad con package.json actual
// Responde a `!ping` con `Pong!` y tiene un comando `help` simple.

require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const prefix = process.env.PREFIX || '!';
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Falta DISCORD_TOKEN en .env — copia .env.example a .env y añade tu token');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`Conectado como ${client.user.tag}`);
  try {
    client.user.setActivity('MineEden', { type: 'PLAYING' });
  } catch (e) {
    // ignore activity set errors in some environments
  }
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === 'ping') {
    message.reply('Pong!');
    return;
  }

  if (command === 'help') {
    message.reply(`Comandos disponibles:\n${prefix}ping — responde Pong!`);
  }
});

client.login(token).catch((err) => {
  console.error('Error iniciando sesión del bot:', err);
  process.exit(1);
});
