import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { searchAnime, getOngoingAnime, filterRecentOngoing, addAnime, removeAnime, listAnime } from '../manage-anime.js';
import { loadTrackedAnime } from '../config.js';

const GIST_RAW_URL = 'https://gist.githubusercontent.com/asagirireika98/874047cb9237951aca2bb5befa3e791f/raw/anime.m3u';

export async function handleSearch(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('query', true);

  await interaction.deferReply();

  const results = await searchAnime(query);

  if (results.length === 0) {
    await interaction.editReply(`No results found for **${query}**.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`Search: ${query}`)
    .setColor(0x5865f2)
    .setDescription(
      results.map((r, i) => `**${i + 1}.** ${r.name}\n\`${r.slug}\``).join('\n\n')
    )
    .setFooter({ text: 'Use /add <slug> to track an anime' });

  await interaction.editReply({ embeds: [embed] });
}

export async function handleOngoing(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const ongoing = await getOngoingAnime();

  if (ongoing.length === 0) {
    await interaction.editReply('No ongoing anime found.');
    return;
  }

  const recent = filterRecentOngoing(ongoing, 14);

  const embed = new EmbedBuilder()
    .setTitle('Ongoing Anime (2 weeks)')
    .setColor(0x57f287)
    .setDescription(
      recent.map((a, i) => `**${i + 1}.** ${a.name}\n${a.episode} | ${a.date}`).join('\n\n')
    )
    .setFooter({ text: `${recent.length} anime updated recently` });

  await interaction.editReply({ embeds: [embed] });
}

export async function handleAdd(interaction: ChatInputCommandInteraction) {
  const slug = interaction.options.getString('slug', true);

  await interaction.deferReply();

  const result = await addAnime(slug);

  if (result.success) {
    const embed = new EmbedBuilder()
      .setTitle('Anime Added')
      .setColor(0x57f287)
      .setDescription(`**${result.name}**\n\`${slug}\``);

    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply(`Failed: ${result.error}`);
  }
}

export async function handleRemove(interaction: ChatInputCommandInteraction) {
  const slug = interaction.options.getString('slug', true);

  const result = removeAnime(slug);

  if (result.success) {
    await interaction.reply(`Removed \`${slug}\` from tracked list.`);
  } else {
    await interaction.reply(`Failed: ${result.error}`);
  }
}

export async function handleList(interaction: ChatInputCommandInteraction) {
  const anime = listAnime();

  if (anime.length === 0) {
    await interaction.reply('No anime tracked yet.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Tracked Anime')
    .setColor(0xfee75c)
    .setDescription(
      anime.map((a, i) => `**${i + 1}.** ${a.name}\n\`${a.slug}\``).join('\n\n')
    )
    .setFooter({ text: `${anime.length} anime tracked` });

  await interaction.reply({ embeds: [embed] });
}

export async function handlePlaylist(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('M3U Playlist')
    .setColor(0xeb459e)
    .setDescription('Open this link in VLC or any M3U player:')
    .addFields(
      { name: 'Raw M3U', value: `[anime.m3u](${GIST_RAW_URL})`, inline: false },
      { name: 'Gist', value: `[View on GitHub](https://gist.github.com/asagirireika98/874047cb9237951aca2bb5befa3e791f)`, inline: false }
    )
    .setFooter({ text: 'Right-click → Copy Link → Open in VLC' });

  await interaction.reply({ embeds: [embed] });
}
