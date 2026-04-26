const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActivityType, PermissionFlagsBits } = require('discord.js');

// ================= [ ID CONFIGURATION ] =================
const TOKEN = 'MTQ5MjM3MzU0NTg5NDkzNjY2Nw.G0h6a_.gNPMoQohzTBHVv4_71z6lK1kHDwb7zAPOwcSKE'; 
const CLIENT_ID = '1492373545894936667'; 
const OWNER_ID = '766986088757329930'; 
const ADMIN_ROLE_ID = '1490817928302428313'; 
const GETKEY_ROLE_ID = '1490818104459132979'; 
const GETKEY_CHANNEL_ID = '1497533216397987982'; 
// =========================================================

// Junkie API v2 Configuration
const JUNKIE_SECRET_TOKEN = '59f145d9-25af-4783-af67-557c920dfa0b'; 
const JUNKIE_PROVIDER_ID = 8969; 
const JUNKIE_SERVICE_ID = 20542;  

// In-Memory Cooldown Store
const cooldowns = new Map();
const COOLDOWN_DURATION = 12 * 60 * 60 * 1000; // 12 Jam dalam milidetik

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers
    ] 
});

const commands = [
    {
        name: 'getkey',
        description: 'Generate an official license key from the database.',
    },
    {
        name: 'ktdelete',
        description: 'Delete all expired keys from the database (Owner/Admin only).',
        default_member_permissions: String(PermissionFlagsBits.Administrator) 
    },
    {
        name: 'addprem',
        description: 'Add a custom premium key (Owner/Admin only).',
        options: [
            { name: 'name', description: 'Name for the key', type: 3, required: true },
            { name: 'minutes', description: 'Validity in minutes', type: 4, required: true },
            { name: 'user_id', description: 'Discord ID to bind (optional)', type: 3, required: false }
        ],
        default_member_permissions: String(PermissionFlagsBits.Administrator)
    }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('[SYSTEM] Registering slash commands...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('[SYSTEM] Slash commands successfully registered!');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', () => {
    client.user.setActivity('TikTok @forkthub', { type: ActivityType.Watching }); 
    console.log(`[INFO] Bot is online as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const isOwner = interaction.user.id === OWNER_ID;
    const hasAdminRole = interaction.member.roles.cache.has(ADMIN_ROLE_ID);

    // ==========================================
    // COMMAND: /getkey
    // ==========================================
    if (interaction.commandName === 'getkey') {
        // 1. Cek Channel
        if (interaction.channelId !== GETKEY_CHANNEL_ID) {
            return interaction.reply({ 
                content: `❌ This command can only be used in <#${GETKEY_CHANNEL_ID}>`, 
                ephemeral: true 
            });
        }

        // 2. Cek Role (Owner bypass role check)
        if (!interaction.member.roles.cache.has(GETKEY_ROLE_ID) && !isOwner) {
            return interaction.reply({ 
                content: `❌ You need the <@&${GETKEY_ROLE_ID}> role to use this command.`, 
                ephemeral: true 
            });
        }

        // 3. LOGIKA COOLDOWN (Owner bypass cooldown)
        if (!isOwner) {
            const expirationTime = cooldowns.get(interaction.user.id);
            if (expirationTime) {
                const currentTime = Date.now();
                if (currentTime < expirationTime) {
                    const timeLeftUnix = Math.floor(expirationTime / 1000);
                    return interaction.reply({ 
                        content: `⏳ **Cooldown Active!** You can generate another key <t:${timeLeftUnix}:R>.`, 
                        ephemeral: true 
                    });
                }
            }
        }

        // 4. Cek Status
        const requiredStatus = "TikTok @forkthub"; 
        const userPresence = interaction.member.presence;
        const customStatus = userPresence?.activities.find(a => a.type === 4); 

        if (!customStatus || !customStatus.state.includes(requiredStatus)) {
            const warningEmbed = new EmbedBuilder()
                .setTitle('FORKT-KEYS: ACCESS DENIED')
                .setDescription(`To use this command, you must set your Discord Custom Status to: ``${requiredStatus}```)
                .setColor('#FF0000')
                .setFooter({ text: 'Status Verification Required' });

            return interaction.reply({ embeds: [warningEmbed], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const response = await fetch('https://api.jnkie.com/api/v2/keys', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${JUNKIE_SECRET_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider_id: JUNKIE_PROVIDER_ID,
                    service_id: JUNKIE_SERVICE_ID,
                    key_name: `Get_${interaction.user.username}`, 
                    validity_minutes: 60, 
                    discord_id: interaction.user.id, 
                    is_premium: false,
                    hwid_limit: 1
                })
            });

            const data = await response.json();
            if (!response.ok || !data.key) throw new Error(data.message || 'Invalid API response.');

            const generatedKey = data.key.key_value;
            const expiresAtUnix = Math.floor(new Date(data.key.expires_at).getTime() / 1000);

            // SET COOLDOWN (Berhasil generate -> Masukkan ke list cooldown)
            if (!isOwner) {
                cooldowns.set(interaction.user.id, Date.now() + COOLDOWN_DURATION);
            }

            const keyEmbed = new EmbedBuilder()
                .setTitle('FORKT-KEYS')
                .setDescription('Verification successful. Your license key has been generated.')
                .setColor('#8B0000') 
                .addFields(
                    { name: '🔑 License Key', value: `\`\`\`${generatedKey}\`\`\``, inline: false },
                    { name: '⏳ Duration', value: '1 Hour', inline: true },
                    { name: '🌐 Status', value: '🟢 Active', inline: true },
                    { name: '⏰ Expires At', value: `<t:${expiresAtUnix}:f> (<t:${expiresAtUnix}:R>)`, inline: false }
                )
                .setFooter({ text: 'Key System By @sukitovone' })
                .setTimestamp();

            await interaction.editReply({ embeds: [keyEmbed] });

        } catch (error) {
            console.error(`[ERROR] ${error.message}`);
            await interaction.editReply({ content: `❌ Error: \`${error.message}\`` });
        }
    }

    // ==========================================
    // COMMAND: /addprem
    // ==========================================
    if (interaction.commandName === 'addprem') {
        if (!isOwner && !hasAdminRole) {
            return interaction.reply({ content: '❌ Unauthorized access.', ephemeral: true });
        }

        const keyName = interaction.options.getString('name');
        const minutes = interaction.options.getInteger('minutes');
        const targetUser = interaction.options.getString('user_id') || interaction.user.id;

        await interaction.deferReply({ ephemeral: true });

        try {
            const response = await fetch('https://api.jnkie.com/api/v2/keys', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${JUNKIE_SECRET_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider_id: JUNKIE_PROVIDER_ID,
                    service_id: JUNKIE_SERVICE_ID,
                    key_name: keyName, 
                    validity_minutes: minutes, 
                    discord_id: targetUser, 
                    is_premium: true,
                    no_hwid: true,
                    hwid_limit: 1
                })
            });

            const data = await response.json();
            if (!response.ok || !data.key) throw new Error(data.message || 'API Error');

            const premEmbed = new EmbedBuilder()
                .setTitle('FORKT-KEYS: PREMIUM GENERATED')
                .setDescription('A new premium license has been added to the database.')
                .setColor('#FFD700') 
                .addFields(
                    { name: '🔑 Premium Key', value: `\`\`\`${data.key.key_value}\`\`\`` },
                    { name: '💎 Type', value: 'Premium (No HWID Lock)', inline: true },
                    { name: '⏳ Validity', value: `${minutes} Minutes`, inline: true },
                    { name: '👤 Assigned To', value: `<@${targetUser}>`, inline: false }
                )
                .setFooter({ text: 'Premium Core System' });

            await interaction.editReply({ embeds: [premEmbed] });

        } catch (error) {
            await interaction.editReply({ content: `❌ Failed to add premium key: \`${error.message}\`` });
        }
    }

    // ==========================================
    // COMMAND: /ktdelete
    // ==========================================
    if (interaction.commandName === 'ktdelete') {
        if (!isOwner && !hasAdminRole) return interaction.reply({ content: '❌ Unauthorized.', ephemeral: true });

        await interaction.deferReply({ ephemeral: true });
        try {
            const response = await fetch(`https://api.jnkie.com/api/v2/services/${JUNKIE_SERVICE_ID}/keys/expired`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${JUNKIE_SECRET_TOKEN}` }
            });

            if (!response.ok) throw new Error('Deletion failed');

            await interaction.editReply({ content: '✅ Successfully deleted all expired keys.' });
        } catch (error) {
            await interaction.editReply({ content: `❌ Error: ${error.message}` });
        }
    }
});

client.login(TOKEN);
