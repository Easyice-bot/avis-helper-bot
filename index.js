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

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const BANNIERE = 'https://i.imgur.com/bhzV8Xt.png';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Stocke temporairement la note et le helper choisi
const tempData = new Map();

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

  // 1. /helperavis → stocke le helper et envoie les boutons étoiles
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

  // 2. Clic sur un bouton étoile → stocke la note et ouvre le modal
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

  // 3. Soumission du modal → embed visible par TOUT LE MONDE avec bannière
  if (interaction.isModalSubmit() && interaction.customId === 'avis_modal') {

    const ressenti  = interaction.fields.getTextInputValue('ressenti');
    const joueur    = interaction.user;
    const data      = tempData.get(joueur.id) || {};
    const note      = data.note || 5;
    const helperId  = data.helperId;

    tempData.delete(joueur.id);

    // Étoiles
    const etoiles = '⭐'.repeat(note) + '✩'.repeat(5 - note);

    // Médaille selon la note
    const medaille =
      note === 5 ? '🥇 **EXCELLENT**' :
      note === 4 ? '🥈 **TRÈS BON**' :
      note === 3 ? '🥉 **BON**' :
      note === 2 ? '⚠️ **MOYEN**' :
                   '❌ **INSUFFISANT**';

    // Couleur selon la note
    const couleur =
      note === 5 ? 0xFFD700 :
      note === 4 ? 0xFFA500 :
      note === 3 ? 0x00BFFF :
      note === 2 ? 0xFF6600 :
                   0xFF0000;

    const embed = new EmbedBuilder()
      .setTitle('⚔️  AVIS HELPER  ⚔️')
      .setDescription(
        '```\n' +
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n' +
        '         RAPPORT D\'AIDE\n' +
        '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬' +
        '```'
      )
      .setColor(couleur)
      .setImage(BANNIERE) // ← Bannière en haut de l'embed
      .addFields(
        {
          name: '🎖️ Helper',
          value: `<@${helperId}>`,
          inline: true,
        },
        {
          name: '🎮 Joueur aidé',
          value: `<@${joueur.id}>`,
          inline: true,
        },
        {
          name: '\u200B',
          value: '\u200B',
          inline: false,
        },
        {
          name: '⭐ Note',
          value: `${etoiles}  •  **${note}/5**  •  ${medaille}`,
          inline: false,
        },
        {
          name: '💬 Ressenti du joueur',
          value: `> ${ressenti}`,
          inline: false,
        },
      )
      .setFooter({
        text: `✍️ Avis soumis par ${joueur.username}  •  ${new Date().toLocaleDateString('fr-FR')}`,
        iconURL: joueur.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.reply({
      content: `🔔 <@${helperId}> — Tu as reçu un nouvel avis !`,
      embeds: [embed],
    });
  }
});

// ─── Connexion ─────────────────────────────────────────────────────────────
client.login(TOKEN);
