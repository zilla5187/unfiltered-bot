# Remove the broken index.js
rm index.js

# Create the correct index.js
cat > index.js << 'ENDOFFILE'
/**
 * ██╗   ██╗██████╗  ██████╗ ████████╗
 * ██║   ██║██╔══██╗██╔═══██╗╚══██╔══╝
 * ██║   ██║██████╔╝██║   ██║   ██║   
 * ██║   ██║██╔══██╗██║   ██║   ██║   
 * ╚██████╔╝██████╔╝╚██████╔╝   ██║   
 *  ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝   
 * 
 * UBot - Unfiltered Bytzz WhatsApp Bot
 * Advanced CLI Management System
 * Created by Glen | TG: @unfilteredg
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { spawn } = require('child_process');

// ============ CONFIGURATION ============
const CONFIG = {
    botName: 'UBOT',
    version: '4.0.0',
    author: 'Glen',
    telegram: '@unfilteredg',
    whatsapp: '+25473505427',
    github: 'github.com/zilla5187',
    website: 'netivosolutions.top',
    sessionDir: './session',
    dataDir: './data',
    port: process.env.PORT || 3000,
};

// ============ ASCII BANNER ============
const printBanner = () => {
    console.log(chalk.green(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   ${chalk.greenBright('██╗   ██╗')}${chalk.white('██████╗  ██████╗ ████████╗')}                                       ║
║   ${chalk.greenBright('██║   ██║')}${chalk.white('██╔══██╗██╔═══██╗╚══██╔══╝')}                                       ║
║   ${chalk.greenBright('██║   ██║')}${chalk.white('██████╔╝██║   ██║   ██║   ')}   ${chalk.gray('Unfiltered Bytzz Bot')}            ║
║   ${chalk.greenBright('██║   ██║')}${chalk.white('██╔══██╗██║   ██║   ██║   ')}   ${chalk.gray('Multi-Device WhatsApp')}           ║
║   ${chalk.greenBright('╚██████╔╝')}${chalk.white('██████╔╝╚██████╔╝   ██║   ')}   ${chalk.gray('v' + CONFIG.version)}                         ║
║   ${chalk.greenBright(' ╚═════╝ ')}${chalk.white('╚═════╝  ╚═════╝    ╚═╝   ')}                                       ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`));
    console.log(chalk.gray(`  📱 Telegram: ${CONFIG.telegram} | 💬 WhatsApp: ${CONFIG.whatsapp}`));
    console.log(chalk.gray(`  🌐 Website: ${CONFIG.website} | 📦 GitHub: ${CONFIG.github}\n`));
};

// ============ UTILITIES ============
const clearScreen = () => {
    console.clear();
    process.stdout.write('\x1Bc');
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============ READLINE INTERFACE ============
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const question = (prompt) => new Promise((resolve) => {
    rl.question(chalk.green('? ') + chalk.white(prompt), resolve);
});

const pressEnter = () => new Promise((resolve) => {
    rl.question(chalk.gray('\n  Press ENTER to continue...'), () => resolve());
});

// ============ SESSION MANAGEMENT ============
const sessionExists = () => fs.existsSync(CONFIG.sessionDir) && fs.readdirSync(CONFIG.sessionDir).length > 0;

const getSessionInfo = () => {
    if (!sessionExists()) return null;
    try {
        const credsPath = path.join(CONFIG.sessionDir, 'creds.json');
        if (fs.existsSync(credsPath)) {
            const creds = JSON.parse(fs.readFileSync(credsPath));
            return {
                registered: creds.registered || false,
                phone: creds.me?.id?.split(':')[0] || 'Unknown',
            };
        }
    } catch (e) {}
    return { registered: false, phone: 'Unknown' };
};

const deleteSession = () => {
    if (fs.existsSync(CONFIG.sessionDir)) {
        fs.rmSync(CONFIG.sessionDir, { recursive: true, force: true });
        return true;
    }
    return false;
};

// ============ BOT PROCESS ============
let botProcess = null;
let botStartTime = null;

const isBotRunning = () => botProcess !== null && !botProcess.killed;

const formatUptime = (ms) => {
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000) % 60;
    const h = Math.floor(ms / 3600000) % 24;
    const d = Math.floor(ms / 86400000);
    return `${d}d ${h}h ${m}m ${s}s`;
};

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ============ MENUS ============
const printMenu = (items, title) => {
    console.log(chalk.green('\n  ╔═══════════════════════════════════════╗'));
    console.log(chalk.green('  ║') + chalk.white.bold(`  ${title}`.padEnd(39)) + chalk.green('║'));
    console.log(chalk.green('  ╠═══════════════════════════════════════╣'));
    items.forEach(item => {
        console.log(chalk.green('  ║') + chalk.white(`  ${item.icon}  [${item.key}] ${item.label}`.padEnd(39)) + chalk.green('║'));
    });
    console.log(chalk.green('  ╚═══════════════════════════════════════╝\n'));
};

const mainMenu = [
    { key: '1', label: 'Start Bot', icon: '🚀' },
    { key: '2', label: 'Stop Bot', icon: '🛑' },
    { key: '3', label: 'View Bot Status', icon: '📊' },
    { key: '4', label: 'Session Manager', icon: '🔐' },
    { key: '5', label: 'System Info', icon: '💻' },
    { key: '6', label: 'About', icon: 'ℹ️' },
    { key: '0', label: 'Exit', icon: '👋' },
];

const sessionMenu = [
    { key: '1', label: 'View Session Info', icon: '🔍' },
    { key: '2', label: 'Delete Session', icon: '🗑️' },
    { key: '3', label: 'Backup Session', icon: '💾' },
    { key: '0', label: 'Back', icon: '◀️' },
];

// ============ BOT RUNNER ============
const startBot = async () => {
    if (isBotRunning()) {
        console.log(chalk.yellow('\n  ⚠️  Bot is already running!'));
        await pressEnter();
        return;
    }

    console.log(chalk.cyan('\n  🚀 Starting UBot...\n'));

    // Create bot runner script
    const botScript = `
require('./settings');
const fs = require('fs');
const chalk = require('chalk');
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber');
const { smsg } = require('./lib/myfunc');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidDecode,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");
const { rmSync } = require('fs');
const readline = require('readline');

const store = require('./lib/lightweight_store');
const settings = require('./settings');

store.readFromFile();
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000);

global.botname = "UBOT";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        const msgRetryCounterCache = new NodeCache();

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            browser: ["UBot", "Chrome", "20.0.04"],
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid);
                let msg = await store.loadMessage(jid, key.id);
                return msg?.message || "";
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
        });

        XeonBotInc.ev.on('creds.update', saveCreds);
        store.bind(XeonBotInc.ev);

        if (!XeonBotInc.authState.creds.registered) {
            console.log(chalk.cyan('\\n  ════════════════════════════════════════'));
            console.log(chalk.cyan('  ║') + chalk.white.bold('  UBOT PAIRING MODE') + chalk.cyan('                    ║'));
            console.log(chalk.cyan('  ════════════════════════════════════════\\n'));
            
            const phoneNumber = await question(chalk.green('  ? ') + chalk.white('Enter WhatsApp number (with country code): '));
            const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
            
            if (cleanNumber.length >= 10) {
                setTimeout(async () => {
                    try {
                        const code = await XeonBotInc.requestPairingCode(cleanNumber);
                        const pairingCode = code?.match(/.{1,4}/g)?.join("-") || code;
                        console.log();
                        console.log(chalk.green('  ╔═══════════════════════════════════════╗'));
                        console.log(chalk.green('  ║') + chalk.white.bold('  YOUR PAIRING CODE:                   ') + chalk.green('║'));
                        console.log(chalk.green('  ║') + chalk.greenBright.bold('  ' + pairingCode.padEnd(37)) + chalk.green('║'));
                        console.log(chalk.green('  ╚═══════════════════════════════════════╝'));
                        console.log();
                        console.log(chalk.gray('  Enter this code in WhatsApp:'));
                        console.log(chalk.gray('  Settings → Linked Devices → Link a Device\\n'));
                    } catch (e) {
                        console.log(chalk.red('  ❌ Failed to get pairing code: ' + e.message));
                    }
                }, 3000);
            }
        }

        XeonBotInc.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) console.log(chalk.yellow('\\n  📱 Scan QR Code above with WhatsApp'));
            if (connection === 'connecting') console.log(chalk.yellow('  🔄 Connecting...'));
            
            if (connection === 'open') {
                const phoneNum = XeonBotInc.user?.id?.split(':')[0];
                console.log();
                console.log(chalk.green('  ╔═══════════════════════════════════════╗'));
                console.log(chalk.green('  ║') + chalk.white.bold('  ✅ UBOT CONNECTED!                    ') + chalk.green('║'));
                console.log(chalk.green('  ║') + chalk.gray('  Phone: +' + (phoneNum || 'Unknown').padEnd(28)) + chalk.green('║'));
                console.log(chalk.green('  ╚═══════════════════════════════════════╝\\n'));
                
                try {
                    await XeonBotInc.sendMessage(phoneNum + '@s.whatsapp.net', {
                        text: '⚡ *UBOT Connected!*\\n\\n🤖 Unfiltered Bytzz Bot\\n⏰ ' + new Date().toLocaleString() + '\\n✅ Status: Online\\n\\n_Type .menu for commands_'
                    });
                } catch (e) {}
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(chalk.red('  ❌ Disconnected'));
                if (lastDisconnect?.error?.output?.statusCode === 401) {
                    rmSync('./session', { recursive: true, force: true });
                }
                if (shouldReconnect) {
                    console.log(chalk.yellow('  🔄 Reconnecting...'));
                    await delay(5000);
                    startBot();
                } else {
                    process.exit(0);
                }
            }
        });

        XeonBotInc.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.message) return;
                msg.message = Object.keys(msg.message)[0] === 'ephemeralMessage' ? msg.message.ephemeralMessage.message : msg.message;
                if (msg.key?.remoteJid === 'status@broadcast') { await handleStatus(XeonBotInc, m); return; }
                if (msg.key.id.startsWith('BAE5') && msg.key.id.length === 16) return;
                await handleMessages(XeonBotInc, m, true);
            } catch (e) { console.error('  ❌ Error:', e.message); }
        });

        XeonBotInc.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\\d+@/gi.test(jid)) {
                const decode = jidDecode(jid) || {};
                return decode.user && decode.server ? decode.user + '@' + decode.server : jid;
            }
            return jid;
        };

        XeonBotInc.getName = (jid) => {
            const id = XeonBotInc.decodeJid(jid);
            const v = store.contacts[id] || {};
            return v.name || v.subject || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international');
        };

        XeonBotInc.public = true;
        XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store);

        XeonBotInc.ev.on('contacts.update', (update) => {
            for (const contact of update) {
                const id = XeonBotInc.decodeJid(contact.id);
                if (store?.contacts) store.contacts[id] = { id, name: contact.notify };
            }
        });

        XeonBotInc.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(XeonBotInc, update);
        });

        return XeonBotInc;
    } catch (e) {
        console.error('  ❌ Error:', e.message);
        await delay(5000);
        startBot();
    }
}

console.log(chalk.green('\\n  ════════════════════════════════════════'));
console.log(chalk.green('  ║') + chalk.greenBright.bold('  ⚡ UBOT - Unfiltered Bytzz') + chalk.green('            ║'));
console.log(chalk.green('  ║') + chalk.gray('  Created by Glen | v4.0.0') + chalk.green('             ║'));
console.log(chalk.green('  ════════════════════════════════════════\\n'));

startBot();

process.on('uncaughtException', (e) => console.error('  ❌ Exception:', e.message));
process.on('unhandledRejection', (e) => console.error('  ❌ Rejection:', e.message));
`;

    fs.writeFileSync('./bot_runner.js', botScript);

    botProcess = spawn('node', ['bot_runner.js'], {
        stdio: 'inherit',
        detached: false,
    });

    botStartTime = Date.now();

    botProcess.on('error', (err) => {
        console.log(chalk.red('\n  ❌ Failed to start: ' + err.message));
        botProcess = null;
    });

    botProcess.on('exit', (code) => {
        console.log(chalk.yellow(`\n  Bot exited with code ${code}`));
        botProcess = null;
        botStartTime = null;
    });
};

const stopBot = async () => {
    if (!isBotRunning()) {
        console.log(chalk.yellow('\n  ⚠️  Bot is not running!'));
        await pressEnter();
        return;
    }

    console.log(chalk.cyan('\n  🛑 Stopping UBot...'));
    
    try {
        botProcess.kill('SIGTERM');
        await sleep(1000);
        if (isBotRunning()) botProcess.kill('SIGKILL');
        botProcess = null;
        botStartTime = null;
        console.log(chalk.green('  ✅ Bot stopped!'));
    } catch (e) {
        console.log(chalk.red('  ❌ Failed to stop: ' + e.message));
    }
    
    await pressEnter();
};

const viewStatus = async () => {
    clearScreen();
    printBanner();
    
    console.log(chalk.cyan('  ═══════════════════════════════════════'));
    console.log(chalk.cyan('  ║') + chalk.white.bold('  📊 BOT STATUS') + chalk.cyan('                        ║'));
    console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
    
    const session = getSessionInfo();
    const running = isBotRunning();
    
    console.log(chalk.white('  ┌─────────────────────────────────────┐'));
    console.log(chalk.white('  │') + chalk.gray(' Bot Status:     ') + (running ? chalk.green('● RUNNING') : chalk.red('● STOPPED')).padEnd(28) + chalk.white('│'));
    if (running && botStartTime) {
        console.log(chalk.white('  │') + chalk.gray(' Uptime:         ') + chalk.white(formatUptime(Date.now() - botStartTime).padEnd(20)) + chalk.white('│'));
    }
    console.log(chalk.white('  │') + chalk.gray(' Session:        ') + (session?.registered ? chalk.green('✓ Active') : chalk.yellow('✗ Not paired')).padEnd(28) + chalk.white('│'));
    if (session?.phone && session.phone !== 'Unknown') {
        console.log(chalk.white('  │') + chalk.gray(' Phone:          ') + chalk.white(('+' + session.phone).padEnd(20)) + chalk.white('│'));
    }
    console.log(chalk.white('  │') + chalk.gray(' Memory:         ') + chalk.white(formatBytes(process.memoryUsage().rss).padEnd(20)) + chalk.white('│'));
    console.log(chalk.white('  └─────────────────────────────────────┘'));
    
    await pressEnter();
};

const handleSessionMenu = async () => {
    while (true) {
        clearScreen();
        printBanner();
        
        const status = isBotRunning();
        console.log(chalk.gray(`  Status: ${status ? chalk.green('● Running') : chalk.red('● Stopped')}`));
        
        printMenu(sessionMenu, 'SESSION MANAGER');
        
        const choice = await question('Enter choice: ');
        
        switch (choice) {
            case '1': // View Session
                clearScreen();
                printBanner();
                console.log(chalk.cyan('\n  🔍 SESSION INFO\n'));
                const session = getSessionInfo();
                if (!session) {
                    console.log(chalk.yellow('  ⚠️  No session found.'));
                } else {
                    console.log(chalk.white('  Registered: ') + (session.registered ? chalk.green('Yes') : chalk.red('No')));
                    console.log(chalk.white('  Phone: ') + chalk.white(session.phone || 'Unknown'));
                }
                await pressEnter();
                break;
                
            case '2': // Delete Session
                clearScreen();
                printBanner();
                console.log(chalk.red('\n  ⚠️  WARNING: This will log out your bot!\n'));
                const confirm = await question('Type "yes" to confirm: ');
                if (confirm.toLowerCase() === 'yes') {
                    if (isBotRunning()) {
                        botProcess.kill('SIGTERM');
                        botProcess = null;
                    }
                    if (deleteSession()) {
                        console.log(chalk.green('\n  ✅ Session deleted!'));
                    } else {
                        console.log(chalk.yellow('\n  ⚠️  No session to delete.'));
                    }
                }
                await pressEnter();
                break;
                
            case '3': // Backup Session
                clearScreen();
                printBanner();
                if (!sessionExists()) {
                    console.log(chalk.yellow('\n  ⚠️  No session to backup.'));
                } else {
                    const backupDir = './session_backups';
                    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const backupPath = path.join(backupDir, `session_${timestamp}`);
                    fs.cpSync(CONFIG.sessionDir, backupPath, { recursive: true });
                    console.log(chalk.green(`\n  ✅ Backup created: ${backupPath}`));
                }
                await pressEnter();
                break;
                
            case '0':
                return;
        }
    }
};

const viewSystemInfo = async () => {
    clearScreen();
    printBanner();
    
    const os = require('os');
    
    console.log(chalk.cyan('  ═══════════════════════════════════════'));
    console.log(chalk.cyan('  ║') + chalk.white.bold('  💻 SYSTEM INFO') + chalk.cyan('                       ║'));
    console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
    
    console.log(chalk.white('  ┌─────────────────────────────────────┐'));
    console.log(chalk.white('  │') + chalk.gray(' Platform:       ') + chalk.white(os.platform().padEnd(20)) + chalk.white('│'));
    console.log(chalk.white('  │') + chalk.gray(' Architecture:   ') + chalk.white(os.arch().padEnd(20)) + chalk.white('│'));
    console.log(chalk.white('  │') + chalk.gray(' Node.js:        ') + chalk.white(process.version.padEnd(20)) + chalk.white('│'));
    console.log(chalk.white('  │') + chalk.gray(' CPU Cores:      ') + chalk.white(String(os.cpus().length).padEnd(20)) + chalk.white('│'));
    console.log(chalk.white('  │') + chalk.gray(' Total Memory:   ') + chalk.white(formatBytes(os.totalmem()).padEnd(20)) + chalk.white('│'));
    console.log(chalk.white('  │') + chalk.gray(' Free Memory:    ') + chalk.white(formatBytes(os.freemem()).padEnd(20)) + chalk.white('│'));
    console.log(chalk.white('  │') + chalk.gray(' Hostname:       ') + chalk.white(os.hostname().substring(0, 20).padEnd(20)) + chalk.white('│'));
    console.log(chalk.white('  └─────────────────────────────────────┘'));
    
    await pressEnter();
};

const viewAbout = async () => {
    clearScreen();
    printBanner();
    
    console.log(chalk.green(`
    ⚡ UBOT - Unfiltered Bytzz Bot
    
    Version:     ${CONFIG.version}
    Author:      ${CONFIG.author}
    Telegram:    ${CONFIG.telegram}
    WhatsApp:    ${CONFIG.whatsapp}
    GitHub:      ${CONFIG.github}
    Website:     ${CONFIG.website}
    
    ─────────────────────────────────────────
    
    UBOT is an advanced WhatsApp multi-device
    bot with 100+ features including:
    
    • Group Management (antilink, antibadword)
    • Media Downloads (YT, TikTok, IG)
    • AI Features (ChatGPT, Gemini)
    • Sticker Maker
    • Games & Fun Commands
    • And much more!
    
    ─────────────────────────────────────────
    
    ${chalk.gray('Made with ❤️ by Glen')}
    `));
    
    await pressEnter();
};

// ============ MAIN LOOP ============
const mainLoop = async () => {
    while (true) {
        clearScreen();
        printBanner();
        
        const status = isBotRunning();
        console.log(chalk.gray(`  Status: ${status ? chalk.green('● Bot Running') + (botStartTime ? chalk.gray(' | Uptime: ' + formatUptime(Date.now() - botStartTime)) : '') : chalk.red('● Bot Stopped')}`));
        
        printMenu(mainMenu, 'MAIN MENU');
        
        const choice = await question('Enter choice: ');
        
        switch (choice) {
            case '1':
                await startBot();
                break;
            case '2':
                await stopBot();
                break;
            case '3':
                await viewStatus();
                break;
            case '4':
                await handleSessionMenu();
                break;
            case '5':
                await viewSystemInfo();
                break;
            case '6':
                await viewAbout();
                break;
            case '0':
                clearScreen();
                console.log(chalk.green('\n  👋 Thanks for using UBot! Goodbye!\n'));
                if (isBotRunning()) {
                    const confirm = await question('Bot is running. Stop before exit? (y/n): ');
                    if (confirm.toLowerCase() === 'y') {
                        botProcess.kill('SIGTERM');
                    }
                }
                rl.close();
                process.exit(0);
            default:
                console.log(chalk.red('\n  ❌ Invalid option!'));
                await sleep(1000);
        }
    }
};

// ============ STARTUP ============
const startup = async () => {
    clearScreen();
    
    console.log(chalk.green(`
   █▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀█
   █  ⚡ UBOT LOADING...     █
   █▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█
    `));
    
    // Check required files
    const requiredFiles = ['./settings.js', './main.js', './lib/myfunc.js'];
    const missing = requiredFiles.filter(f => !fs.existsSync(f));
    
    if (missing.length > 0) {
        console.log(chalk.red('\n  ❌ Missing required files:'));
        missing.forEach(f => console.log(chalk.red(`     - ${f}`)));
        console.log(chalk.yellow('\n  Please ensure all bot files are present.'));
        process.exit(1);
    }
    
    await sleep(1500);
    mainLoop();
};

// ============ ERROR HANDLING ============
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n  Shutting down...'));
    if (isBotRunning()) botProcess.kill('SIGTERM');
    rl.close();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error(chalk.red('\n  ❌ Error:'), err.message);
});

process.on('unhandledRejection', (err) => {
    console.error(chalk.red('\n  ❌ Error:'), err);
});

// Start
startup();
ENDOFFILE
