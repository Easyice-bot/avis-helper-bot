const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');

const TOKEN     = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const BANNIERE = 'https://i.imgur.com/bhzV8Xt.png';

// ─── CONDITIONS PAR GIVEAWAY (10 slots) ───────────────────────────────────
// Valeurs par défaut pour chaque slot 1 à 10
const NB_SLOTS = 10;
const giveawayConditions = new Map();
for (let i = 1; i <= NB_SLOTS; i++) {
  giveawayConditions.set(i, { messages: 20, voc: 30 }); // valeurs par défaut
}

// Pour ce TEST, /helperavis vérifie les conditions du slot n°1
const SLOT_TESTE = 1;

// ─── Lien Helper ID → Salon casier ID ─────────────────────────────────────
const CASIERS = {
  '1401502031071678557': '1508229841793847296', // Helper 1
  '521074946886205455':  '1508229903466627093', // Helper 2
  '1507008227840098384': '1508229966419198013', // Helper 3
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const tempData    = new Map();
const avisData    = new Map();
const casierMsgId = new Map();

// ─── Tracking messages & vocal (maison, simple, en mémoire) ───────────────
const messageCounts = new Map();
const voiceMinutes  = new Map();
const voiceJoinedAt = new Map();

function getMessageCount(userId) {
  return messageCounts.get(userId) || 0;
}

function getVoiceMinutes(userId) {
  return voiceMinutes.get(userId) || 0;
}

function checkEligibilite(userId, slot) {
  const cond = giveawayConditions.get(slot);
  const msgs = getMessageCount(userId);
  const voc  = getVoiceMinutes(userId);
  return {
    eligible: msgs >= cond.messages && voc >= cond.voc,
    msgs,
    voc,
    seuilMsg: cond.messages,
    seuilVoc: cond.voc,
  };
}

// ─── Commandes slash ────────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('helperavis')
    .setDescription('⭐ Donner un avis sur un helper')
    .addUserOption(option =>
      option.setName('helper').setDescription('Le helper qui vous a aidé').setRequired(true)
    ),
];

// Génère automatiquement /condition-giveaway1 à /condition-giveaway10
for (let i = 1; i <= NB_SLOTS; i++) {
  commands.push(
    new SlashCommandBuilder()
      .setName(`condition-giveaway${i}`)
      .setDescription(`🔧 Définir les conditions du giveaway n°${i} (Admin)`)
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addIntegerOption(o =>
        o.setName('messages').setDescription('Nombre de messages minimum requis').setRequired(true).setMinValue(0)
      )
      .addIntegerOption(o =>
        o.setName('voc').setDescription('Minutes de vocal minimum requises').setRequired(true).setMinValue(0)
      )
  );
}

const commandsJson = commands.map(cmd => cmd.toJSON());
const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandsJson });
  console.log(`✅ ${commandsJson.length} commandes enregistrées (helperavis + ${NB_SLOTS} condition-giveawayX)`);
});

// ─── Tracking : messages ───────────────────────────────────────────────────
client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  const userId = message.author.id;
  messageCounts.set(userId, getMessageCount(userId) + 1);
});

// ─── Tracking : vocal ───────────────────────────────────────────────────────
client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.member?.id || oldState.member?.id;
  if (!userId) return;
  if (newState.member?.user.bot || oldState.member?.user.bot) return;

  const oldChan = oldState.channelId;
  const newChan = newState.channelId;

  if (!oldChan && newChan) {
    voiceJoinedAt.set(userId, Date.now());
  } else if (oldChan && !newChan) {
    const joined = voiceJoinedAt.get(userId);
    if (joined) {
      const minutes = Math.floor((Date.now() - joined) / 60000);
      if (minutes > 0) voiceMinutes.set(userId, getVoiceMinutes(userId) + minutes);
      voiceJoinedAt.delete(userId);
    }
  }
});

// ─── Interactions ──────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // /condition-giveawayX → configure les seuils de CE slot précis
  if (interaction.isChatInputCommand() && interaction.commandName.startsWith('condition-giveaway')) {
    const slot = parseInt(interaction.commandName.replace('condition-giveaway', ''));
    const nvMsg = interaction.options.getInteger('messages');
    const nvVoc = interaction.options.getInteger('voc');

    giveawayConditions.set(slot, { messages: nvMsg, voc: nvVoc });

    return interaction.reply({
      content:
        `✅ **Conditions du giveaway n°${slot} mises à jour !**\n\n` +
        `> 💬 Messages requis : **${nvMsg}**\n` +
        `> 🎙️ Vocal requis : **${nvVoc} minutes**`,
      ephemeral: true,
    });
  }

  // /helperavis → vérifie les conditions du SLOT_TESTE (slot 1 pour ce test)
  if (interaction.isChatInputCommand() && interaction.commandName === 'helperavis') {
    const { eligible, msgs, voc, seuilMsg, seuilVoc } = checkEligibilite(interaction.user.id, SLOT_TESTE);

    if (!eligible) {
      return interaction.reply({
        content:
          `❌ **Tu n'es pas encore éligible pour laisser un avis.** (test slot giveaway n°${SLOT_TESTE})\n\n` +
          `> 💬 Messages : **${msgs} / ${seuilMsg}**\n` +
          `> 🎙️ Vocal : **${voc} / ${seuilVoc} minutes**\n\n` +
          `Continue à participer sur le serveur, tu pourras laisser un avis une fois les seuils atteints !`,
        ephemeral: true,
      });
    }

    const helper = interaction.options.getUser('helper');
    tempData.set(interaction.user.id, { helperId: helper.id });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('note_1').setLabel('⭐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('note_2').setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('note_3').setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('note_4').setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('note_5').setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Success),
    );

    await interaction.reply({
      content: `> 🎖️ **Helper :** <@${helper.id}>\n> 🎮 **Joueur :** <@${interaction.user.id}>\n\n✨ **Quelle note lui donnes-tu ?**`,
      components: [row],
      ephemeral: true,
    });
  }

  // Bouton étoile → modal
  if (interaction.isButton() && interaction.customId.startsWith('note_')) {
    const note = parseInt(interaction.customId.split('_')[1]);
    const data = tempData.get(interaction.user.id) || {};
    tempData.set(interaction.user.id, { ...data, note });

    const modal = new ModalBuilder().setCustomId('avis_modal').setTitle('💬 Votre ressenti');
    const ressentiInput = new TextInputBuilder()
      .setCustomId('ressenti')
      .setLabel('Décrivez votre expérience :')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ex: Helper très réactif, top joueur !')
      .setMinLength(10)
      .setMaxLength(300)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(ressentiInput));
    await interaction.showModal(modal);
  }

  // Modal soumis → embed public + mise à jour casier
  if (interaction.isModalSubmit() && interaction.customId === 'avis_modal') {
    const ressenti = interaction.fields.getTextInputValue('ressenti');
    const joueur   = interaction.user;
    const data     = tempData.get(joueur.id) || {};
    const note     = data.note || 5;
    const helperId = data.helperId;
    tempData.delete(joueur.id);

    const etoiles  = '⭐'.repeat(note) + '✩'.repeat(5 - note);
    const medaille =
      note === 5 ? '🥇 EXCELLENT' :
      note === 4 ? '🥈 TRÈS BON'  :
      note === 3 ? '🥉 BON'       :
      note === 2 ? '⚠️ MOYEN'     : '❌ INSUFFISANT';
    const couleur =
      note === 5 ? 0xFFD700 :
      note === 4 ? 0xFFA500 :
      note === 3 ? 0x00BFFF :
      note === 2 ? 0xFF6600 : 0xFF0000;

    const embedAvis = new EmbedBuilder()
      .setTitle('⚔️ AVIS HELPER')
      .setColor(couleur)
      .setImage(BANNIERE)
      .addFields(
        { name: '🎖️ Helper',      value: `<@${helperId}>`,                         inline: true  },
        { name: '🎮 Joueur aidé', value: `<@${joueur.id}>`,                        inline: true  },
        { name: '⭐ Note',        value: `${etoiles} **${note}/5** — ${medaille}`, inline: false },
        { name: '💬 Ressenti',    value: `> ${ressenti}`,                          inline: false },
      )
      .setFooter({ text: `Avis de ${joueur.username} • ${new Date().toLocaleDateString('fr-FR')}`, iconURL: joueur.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({
      content: `🔔 <@${helperId}> — Nouvel avis reçu !`,
      embeds: [embedAvis],
    });

    if (!avisData.has(helperId)) {
      avisData.set(helperId, { total: 0, count: 0, notes: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
    }
    const stats = avisData.get(helperId);
    stats.total += note;
    stats.count += 1;
    stats.notes[note] += 1;

    const casierID = CASIERS[helperId];
    if (casierID) {
      const casierChannel = interaction.guild.channels.cache.get(casierID);
      if (casierChannel) {

        const moyenne     = (stats.total / stats.count).toFixed(1);
        const moyRound    = Math.round(moyenne);
        const moyEtoiles  = '⭐'.repeat(moyRound) + '✩'.repeat(5 - moyRound);

        const moyMedaille =
          moyRound === 5 ? '🥇 EXCELLENT' :
          moyRound === 4 ? '🥈 TRÈS BON'  :
          moyRound === 3 ? '🥉 BON'       :
          moyRound === 2 ? '⚠️ MOYEN'     : '❌ INSUFFISANT';

        const moyCouleur =
          moyRound === 5 ? 0xFFD700 :
          moyRound === 4 ? 0xFFA500 :
          moyRound === 3 ? 0x00BFFF :
          moyRound === 2 ? 0xFF6600 : 0xFF0000;

        const barre = (n) => {
          const pct = stats.count > 0 ? Math.round((stats.notes[n] / stats.count) * 10) : 0;
          return `${'⭐'.repeat(n)}  ${'▰'.repeat(pct)}${'▱'.repeat(10 - pct)}  **${stats.notes[n]}** avis`;
        };

        const embedCasier = new EmbedBuilder()
          .setTitle('🏆 FICHE HELPER')
          .setDescription(
            `> 👤 <@${helperId}>\n` +
            `> 📊 **Moyenne : ${moyenne}/5** — ${moyEtoiles}\n` +
            `> ${moyMedaille} — **${stats.count}** avis au total`
          )
          .setColor(moyCouleur)
          .addFields(
            { name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '📈 Détail des notes', value:
              `${barre(5)}\n` +
              `${barre(4)}\n` +
              `${barre(3)}\n` +
              `${barre(2)}\n` +
              `${barre(1)}`,
              inline: false
            },
            { name: '\u200B', value: '━━━━━━━━━━━━━━━━━━━━━━', inline: false },
            { name: '🕒 Dernier avis reçu', value: `Par <@${joueur.id}> le ${new Date().toLocaleDateString('fr-FR')}`, inline: false },
          )
          .setFooter({ text: '🔄 Mis à jour automatiquement à chaque nouvel avis' })
          .setTimestamp();

        const ancienMsgId = casierMsgId.get(helperId);
        if (ancienMsgId) {
          try {
            const ancienMsg = await casierChannel.messages.fetch(ancienMsgId);
            await ancienMsg.delete();
          } catch (e) {}
        }

        const nouveauMsg = await casierChannel.send({ embeds: [embedCasier] });
        casierMsgId.set(helperId, nouveauMsg.id);
      }
    }
  }
});

client.login(TOKEN);
