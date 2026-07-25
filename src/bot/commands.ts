import { REST, Routes, SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search anime on otakudesu')
    .addStringOption(opt =>
      opt.setName('query').setDescription('Anime name to search').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('ongoing')
    .setDescription('Show ongoing anime from otakudesu'),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add anime to tracked list by slug')
    .addStringOption(opt =>
      opt.setName('slug').setDescription('Anime slug (e.g. naruto-sub-indo)').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove anime from tracked list')
    .addStringOption(opt =>
      opt.setName('slug').setDescription('Anime slug to remove').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all tracked anime'),

  new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Get the current M3U playlist link'),
].map(cmd => cmd.toJSON());

export async function deployCommands(token: string, clientId: string, guildId?: string) {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Registering slash commands...');

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`Registered ${commands.length} commands to guild ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log(`Registered ${commands.length} commands globally`);
    }
  } catch (error) {
    console.error('Failed to deploy commands:', error);
  }
}
