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
} = require('discord.js');

const TOKEN     = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const BANNIERE = 'https://i.imgur.com/bhzV8Xt.png';

// ─── Lien Helper ID → Salon casier ID ─────────────────────────────────────
const CASIERS = {
  '1401502031071678557': '1508229841793847296', // Helper 1
  '521074946886205455':  '1508229903466627093', // Helper 2
  '1507008227840098384': '1508229966419198013', // Helper 3
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Stocke temporairement la note et le helper choisi
const tempData = new Map();

// Stocke les avis en mémoire { helperId: { total, count, notes: {1,2,3,4,5} } }
const avisData = new Map();

// ─── Enregistrement de la commande slash ───────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('helperavis')
    .setDescription('⭐ Donner un avis sur un helper')
    .addUserOption(option =>
      option
        .setName('helper')
        .setDescription('Le helper qui vous a aidé')
        .setRequired(true)
    ),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log('✅ Commande /helperavis enregistrée');
});

// ─── Gestion des interactions ──────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // 1. /helperavis → boutons étoiles
  if (interaction.isChatInputCommand() && interaction.commandName === 'helperavis') {

    const helper = interaction.options.getUser('helper');
    tempData.set(interaction.user.id, { helperId: helper.id });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('note_1').setLabel('★').setEmoji('1️⃣').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('note_2').setLabel('★★').setEmoji('2️⃣').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('note_3').setLabel('★★★').setEmoji('3️⃣').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('note_4').setLabel('★★★★').setEmoji('4️⃣').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('note_5').setLabel('★★★★★').setEmoji('5️⃣').setStyle(ButtonStyle.Success),
    );

    await interaction.reply({
      content: [
        '```',
        '╔══════════════════════════════╗',
        '║     ⚔️  AVIS HELPER  ⚔️       ║',
        '╚══════════════════════════════╝',
        '```',
        `> 👤 **Helper sélectionné :** <@${helper.id}>`,
        `> 🎮 **Joueur :** <@${interaction.user.id}>`,
        '',
        '✨ **Quelle note donnes-tu à ce helper ?**',
      ].join('\n'),
      components: [row],
      ephemeral: true,
    });
  }

  // 2. Clic bouton étoile → modal ressenti
  if (interaction.isButton() && interaction.customId.startsWith('note_')) {

    const note = parseInt(interaction.customId.split('_')[1]);
    const data = tempData.get(interaction.user.id) || {};
    tempData.set(interaction.user.id, { ...data, note });

    const modal = new ModalBuilder()
      .setCustomId('avis_modal')
      .setTitle('💬 Votre ressenti');

    const ressentiInput = new TextInputBuilder()
      .setCustomId('ressenti')
      .setLabel('✍️ Décrivez votre expérience :')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ex: Helper très réactif, explications claires, top joueur !')
      .setMinLength(10)
      .setMaxLength(500)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(ressentiInput),
    );

    await interaction.showModal(modal);
  }

  // 3. Soumission modal → embed public + mise à jour casier
  if (interaction.isModalSubmit() && interaction.customId === 'avis_modal') {

    const ressenti = interaction.fields.getTextInputValue('ressenti');
    const joueur   = interaction.user;
    const data     = tempData.get(joueur.id) || {};
    const note     = data.note || 5;
    const helperId = data.helperId;

    tempData.delete(joueur.id);

    // Étoiles
    const etoiles  = '⭐'.repeat(note) + '✩'.repeat(5 - note);
    const medaille =
      note === 5 ? '🥇 **EXCELLENT**' :
      note === 4 ? '🥈 **TRÈS BON**'  :
      note === 3 ? '🥉 **BON**'       :
      note === 2 ? '⚠️ **MOYEN**'     :
                   '❌ **INSUFFISANT**';
    const couleur =
      note === 5 ? 0xFFD700 :
      note === 4 ? 0xFFA500 :
      note === 3 ? 0x00BFFF :
      note === 2 ? 0xFF6600 :
                   0xFF0000;

    // ── Embed avis public ──
    const embedAvis = new EmbedBuilder()
      .setTitle('⚔️  AVIS HELPER  ⚔️')
      .setDescription(
        '```\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n         RAPPORT D\'AIDE\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬```'
      )
      .setColor(couleur)
      .setImage(BANNIERE)
      .addFields(
        { name: '🎖️ Helper',        value: `<@${helperId}>`,  inline: true  },
        { name: '🎮 Joueur aidé',   value: `<@${joueur.id}>`, inline: true  },
        { name: '\u200B',           value: '\u200B',           inline: false },
        { name: '⭐ Note',          value: `${etoiles}  •  **${note}/5**  •  ${medaille}`, inline: false },
        { name: '💬 Ressenti',      value: `> ${ressenti}`,   inline: false },
      )
      .setFooter({
        text: `✍️ Avis soumis par ${joueur.username}  •  ${new Date().toLocaleDateString('fr-FR')}`,
        iconURL: joueur.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.reply({
      content: `🔔 <@${helperId}> — Tu as reçu un nouvel avis !`,
      embeds: [embedAvis],
    });

    // ── Mise à jour des stats du helper ──
    if (!avisData.has(helperId)) {
      avisData.set(helperId, { total: 0, count: 0, notes: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
    }
    const stats = avisData.get(helperId);
    stats.total += note;
    stats.count += 1;
    stats.notes[note] += 1;

    // ── Envoi dans le casier du helper ──
    const casierID = CASIERS[helperId];
    if (casierID) {
      const casierChannel = interaction.guild.channels.cache.get(casierID);
      if (casierChannel) {

        const moyenne = (stats.total / stats.count).toFixed(2);
        const barres  = (n) => '█'.repeat(stats.notes[n]) || '—';

        const embedCasier = new EmbedBuilder()
          .setTitle(`📁 Casier de <@${helperId}>`)
          .setDescription('```\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n      STATISTIQUES D\'AVIS\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬```')
          .setColor(0xFFD700)
          .addFields(
            { name: '📊 Moyenne générale',  value: `**${moyenne}/5** — ${'⭐'.repeat(Math.round(moyenne))}${'✩'.repeat(5 - Math.round(moyenne))}`, inline: false },
            { name: '📝 Total avis',        value: `**${stats.count}** avis reçus`, inline: false },
            { name: '\u200B',              value: '\u200B', inline: false },
            { name: '⭐⭐⭐⭐⭐ 5 étoiles', value: `${barres(5)} (${stats.notes[5]})`, inline: false },
            { name: '⭐⭐⭐⭐ 4 étoiles',  value: `${barres(4)} (${stats.notes[4]})`, inline: false },
            { name: '⭐⭐⭐ 3 étoiles',    value: `${barres(3)} (${stats.notes[3]})`, inline: false },
            { name: '⭐⭐ 2 étoiles',      value: `${barres(2)} (${stats.notes[2]})`, inline: false },
            { name: '⭐ 1 étoile',         value: `${barres(1)} (${stats.notes[1]})`, inline: false },
          )
          .addFields(
            { name: '🕒 Dernier avis',     value: `Par <@${joueur.id}> — ${new Date().toLocaleDateString('fr-FR')}`, inline: false },
          )
          .setFooter({ text: `Mis à jour automatiquement à chaque nouvel avis` })
          .setTimestamp();

        await casierChannel.send({ embeds: [embedCasier] });
      }
    }
  }
});

// ─── Connexion ─────────────────────────────────────────────────────────────
client.login(TOKEN);
