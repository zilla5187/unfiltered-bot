pm2 stop ubot
pm2 delete ubot
rm index.js
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
const { execSync, spawn } = require('child_process');
const figlet = require('figlet');

// Try to load optional dependencies
let gradient, boxen, ora;
try { gradient = require('gradient-string'); } catch (e) { gradient = null; }
try { boxen = require('boxen'); } catch (e) { boxen = null; }
try { ora = require('ora'); } catch (e) { ora = null; }

// ============ CONFIGURATION ============
const CONFIG = {
    botName: 'UBOT',
    version: '4.0.0',
    author: 'Glen',
    telegram: '@unfilteredg',
    whatsapp: '+25473505427',
    github: 'github.com/gloloruntobi',
    website: 'netivosolutions.top',
    sessionDir: './session',
    dataDir: './data',
    port: process.env.PORT || 3000,
};

// ============ COLORS & STYLES ============
const colors = {
    primary: chalk.white,
    secondary: chalk.gray,
    accent: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    info: chalk.cyan,
    success: chalk.greenBright,
    muted: chalk.dim,
    highlight: chalk.bgWhite.black,
    banner: chalk.green,
};

// ============ ASCII BANNERS ============
const BANNERS = {
    main: `
${chalk.green('╔═══════════════════════════════════════════════════════════════════════════════╗')}
${chalk.green('║')}                                                                               ${chalk.green('║')}
${chalk.green('║')}   ${chalk.greenBright('██╗   ██╗')}${chalk.white('██████╗  ██████╗ ████████╗')}                                       ${chalk.green('║')}
${chalk.green('║')}   ${chalk.greenBright('██║   ██║')}${chalk.white('██╔══██╗██╔═══██╗╚══██╔══╝')}                                       ${chalk.green('║')}
${chalk.green('║')}   ${chalk.greenBright('██║   ██║')}${chalk.white('██████╔╝██║   ██║   ██║   ')}   ${chalk.gray('Unfiltered Bytzz Bot')}            ${chalk.green('║')}
${chalk.green('║')}   ${chalk.greenBright('██║   ██║')}${chalk.white('██╔══██╗██║   ██║   ██║   ')}   ${chalk.gray('Multi-Device WhatsApp')}           ${chalk.green('║')}
${chalk.green('║')}   ${chalk.greenBright('╚██████╔╝')}${chalk.white('██████╔╝╚██████╔╝   ██║   ')}   ${chalk.gray('v' + CONFIG.version)}                         ${chalk.green('║')}
${chalk.green('║')}   ${chalk.greenBright(' ╚═════╝ ')}${chalk.white('╚═════╝  ╚═════╝    ╚═╝   ')}                                       ${chalk.green('║')}
${chalk.green('║')}                                                                               ${chalk.green('║')}
${chalk.green('╚═══════════════════════════════════════════════════════════════════════════════╝')}
`,
    mini: `
${chalk.green('┌─────────────────────────────────────┐')}
${chalk.green('│')}  ${chalk.greenBright('⚡')} ${chalk.white.bold('UBOT')} ${chalk.gray('- Unfiltered Bytzz')}       ${chalk.green('│')}
${chalk.green('│')}  ${chalk.gray('Created by Glen | v' + CONFIG.version)}        ${chalk.green('│')}
${chalk.green('└─────────────────────────────────────┘')}
`,
    loading: `
   ${chalk.green('█▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀█')}
   ${chalk.green('█')}  ${chalk.white('⚡ UBOT LOADING...')}     ${chalk.green('█')}
   ${chalk.green('█▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█')}
`,
};

// ============ UTILITY FUNCTIONS ============
const clearScreen = () => {
    process.stdout.write('\x1Bc');
    console.clear();
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const printLine = (char = '─', length = 70) => {
    console.log(chalk.green(char.repeat(length)));
};

const printBox = (text, options = {}) => {
    const { title = '', padding = 1, borderColor = 'green' } = options;
    const lines = text.split('\n');
    const maxLen = Math.max(...lines.map(l => l.replace(/\x1B\[[0-9;]*m/g, '').length), (title.length + 4));
    const width = maxLen + (padding * 2);
    
    console.log(chalk[borderColor]('┌' + (title ? `─ ${title} ` : '') + '─'.repeat(Math.max(0, width - title.length - 3)) + '┐'));
    lines.forEach(line => {
        const cleanLine = line.replace(/\x1B\[[0-9;]*m/g, '');
        const padRight = width - cleanLine.length;
        console.log(chalk[borderColor]('│') + ' '.repeat(padding) + line + ' '.repeat(Math.max(0, padRight - padding)) + chalk[borderColor]('│'));
    });
    console.log(chalk[borderColor]('└' + '─'.repeat(width) + '┘'));
};

const printHeader = () => {
    clearScreen();
    console.log(BANNERS.main);
    console.log(chalk.gray(`  📱 Telegram: ${CONFIG.telegram} | 💬 WhatsApp: ${CONFIG.whatsapp}`));
    console.log(chalk.gray(`  🌐 Website: ${CONFIG.website} | 📦 GitHub: ${CONFIG.github}`));
    console.log();
};

const printMiniHeader = () => {
    console.log(BANNERS.mini);
};

const spinner = (text) => {
    if (ora) return ora(text).start();
    console.log(chalk.yellow('⏳ ' + text));
    return { 
        succeed: (t) => console.log(chalk.green('✅ ' + (t || text))),
        fail: (t) => console.log(chalk.red('❌ ' + (t || text))),
        stop: () => {},
        text: text
    };
};

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

const getSystemInfo = () => {
    const os = require('os');
    return {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        totalMemory: formatBytes(os.totalmem()),
        freeMemory: formatBytes(os.freemem()),
        usedMemory: formatBytes(process.memoryUsage().rss),
        cpus: os.cpus().length,
        uptime: formatUptime(os.uptime() * 1000),
        hostname: os.hostname(),
    };
};

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
                platform: creds.platform || 'Unknown',
                lastConnect: creds.lastConnect || null,
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

// ============ BOT PROCESS MANAGEMENT ============
let botProcess = null;
let botStartTime = null;

const isBotRunning = () => botProcess !== null && !botProcess.killed;

const getBotStatus = () => {
    if (!isBotRunning()) return { running: false };
    return {
        running: true,
        pid: botProcess.pid,
        uptime: botStartTime ? formatUptime(Date.now() - botStartTime) : 'Unknown',
    };
};

// ============ READLINE INTERFACE ============
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const question = (prompt) => new Promise((resolve) => {
    rl.question(chalk.green('? ') + chalk.white(prompt), (answer) => {
        resolve(answer.trim());
    });
});

const pressEnter = () => new Promise((resolve) => {
    rl.question(chalk.gray('\n  Press ENTER to continue...'), () => resolve());
});

// ============ MENU SYSTEM ============
const MENUS = {
    main: [
        { key: '1', label: 'Start Bot', icon: '🚀', action: 'startBot' },
        { key: '2', label: 'Stop Bot', icon: '🛑', action: 'stopBot' },
        { key: '3', label: 'View Bot Status', icon: '📊', action: 'viewStatus' },
        { key: '4', label: 'View Logs', icon: '📜', action: 'viewLogs' },
        { key: '5', label: 'Session Manager', icon: '🔐', action: 'sessionMenu' },
        { key: '6', label: 'Settings', icon: '⚙️', action: 'settingsMenu' },
        { key: '7', label: 'System Info', icon: '💻', action: 'systemInfo' },
        { key: '8', label: 'Install Dependencies', icon: '📦', action: 'installDeps' },
        { key: '9', label: 'About', icon: 'ℹ️', action: 'about' },
        { key: '0', label: 'Exit', icon: '👋', action: 'exit' },
    ],
    session: [
        { key: '1', label: 'View Session Info', icon: '🔍', action: 'viewSession' },
        { key: '2', label: 'Delete Session', icon: '🗑️', action: 'deleteSession' },
        { key: '3', label: 'Backup Session', icon: '💾', action: 'backupSession' },
        { key: '4', label: 'Restore Session', icon: '📥', action: 'restoreSession' },
        { key: '0', label: 'Back to Main Menu', icon: '◀️', action: 'back' },
    ],
    settings: [
        { key: '1', label: 'Change Bot Name', icon: '✏️', action: 'changeBotName' },
        { key: '2', label: 'Change Port', icon: '🔌', action: 'changePort' },
        { key: '3', label: 'Change Owner Number', icon: '👤', action: 'changeOwner' },
        { key: '4', label: 'Toggle Auto-Read', icon: '👁️', action: 'toggleAutoRead' },
        { key: '5', label: 'Toggle Public Mode', icon: '🌐', action: 'togglePublic' },
        { key: '6', label: 'View Current Settings', icon: '📋', action: 'viewSettings' },
        { key: '0', label: 'Back to Main Menu', icon: '◀️', action: 'back' },
    ],
};

const printMenu = (menuItems, title = 'MAIN MENU') => {
    console.log();
    console.log(chalk.green('  ╔═══════════════════════════════════════╗'));
    console.log(chalk.green('  ║') + chalk.white.bold(`  ${title}`.padEnd(39)) + chalk.green('║'));
    console.log(chalk.green('  ╠═══════════════════════════════════════╣'));
    
    menuItems.forEach(item => {
        const line = `  ${item.icon}  [${item.key}] ${item.label}`;
        console.log(chalk.green('  ║') + chalk.white(line.padEnd(39)) + chalk.green('║'));
    });
    
    console.log(chalk.green('  ╚═══════════════════════════════════════╝'));
    console.log();
};

// ============ BOT CORE FUNCTIONS ============
const startBotProcess = async () => {
    if (isBotRunning()) {
        console.log(chalk.yellow('\n  ⚠️  Bot is already running!'));
        return false;
    }

    const spin = spinner('Starting UBot...');
    
    try {
        // Create the bot runner script
        const botScript = `
require('./settings');
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
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

let XeonBotInc = null;
global.botname = "UBOT";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        const msgRetryCounterCache = new NodeCache();

        XeonBotInc = makeWASocket({
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

        // Handle pairing code
        if (!XeonBotInc.authState.creds.registered) {
            console.log(chalk.cyan('\\n  ════════════════════════════════════════'));
            console.log(chalk.cyan('  ║') + chalk.white.bold('  UBOT PAIRING MODE') + chalk.cyan('                    ║'));
            console.log(chalk.cyan('  ════════════════════════════════════════\\n'));
            
            const phoneNumber = await question(chalk.green('  ? ') + chalk.white('Enter your WhatsApp number (with country code): '));
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
                        console.log(chalk.gray('  Settings → Linked Devices → Link a Device'));
                        console.log();
                    } catch (e) {
                        console.log(chalk.red('  ❌ Failed to get pairing code: ' + e.message));
                    }
                }, 3000);
            }
        }

        XeonBotInc.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log(chalk.yellow('\\n  📱 QR Code displayed above. Scan with WhatsApp.'));
            }
            
            if (connection === 'connecting') {
                console.log(chalk.yellow('  🔄 Connecting to WhatsApp...'));
            }
            
            if (connection === 'open') {
                const phoneNum = XeonBotInc.user?.id?.split(':')[0];
                console.log();
                console.log(chalk.green('  ╔═══════════════════════════════════════╗'));
                console.log(chalk.green('  ║') + chalk.white.bold('  ✅ UBOT CONNECTED SUCCESSFULLY!       ') + chalk.green('║'));
                console.log(chalk.green('  ║') + chalk.gray('  Phone: +' + (phoneNum || 'Unknown').padEnd(28)) + chalk.green('║'));
                console.log(chalk.green('  ║') + chalk.gray('  Time: ' + new Date().toLocaleString().padEnd(29)) + chalk.green('║'));
                console.log(chalk.green('  ╚═══════════════════════════════════════╝'));
                console.log();
                
                try {
                    await XeonBotInc.sendMessage(phoneNum + '@s.whatsapp.net', {
                        text: '⚡ *UBOT Connected!*\\n\\n🤖 Unfiltered Bytzz Bot\\n⏰ ' + new Date().toLocaleString() + '\\n✅ Status: Online\\n\\n_Type .menu for commands_'
                    });
                } catch (e) {}
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(chalk.red('  ❌ Connection closed'));
                
                if (lastDisconnect?.error?.output?.statusCode === 401) {
                    rmSync('./session', { recursive: true, force: true });
                    console.log(chalk.yellow('  🗑️ Session cleared due to logout'));
                }
                
                if (shouldReconnect) {
                    console.log(chalk.yellow('  🔄 Reconnecting in 5 seconds...'));
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
            } catch (e) { console.error('  ❌ Message error:', e.message); }
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

        // Anti-call
        const antiCallNotified = new Set();
        XeonBotInc.ev.on('call', async (calls) => {
            try {
                const { readState } = require('./commands/anticall');
                if (!readState().enabled) return;
                for (const call of calls) {
                    const jid = call.from || call.peerJid;
                    if (!jid) continue;
                    try { if (XeonBotInc.rejectCall) await XeonBotInc.rejectCall(call.id, jid); } catch {}
                    if (!antiCallNotified.has(jid)) {
                        antiCallNotified.add(jid);
                        setTimeout(() => antiCallNotified.delete(jid), 60000);
                        await XeonBotInc.sendMessage(jid, { text: '📵 Calls blocked.' });
                    }
                    setTimeout(async () => { try { await XeonBotInc.updateBlockStatus(jid, 'block'); } catch {} }, 800);
                }
            } catch {}
        });

        return XeonBotInc;
    } catch (e) {
        console.error('  ❌ Bot error:', e.message);
        await delay(5000);
        startBot();
    }
}

console.log(chalk.green('\\n  ════════════════════════════════════════'));
console.log(chalk.green('  ║') + chalk.greenBright.bold('  ⚡ UBOT - Unfiltered Bytzz Bot') + chalk.green('        ║'));
console.log(chalk.green('  ║') + chalk.gray('  Created by Glen | v4.0.0') + chalk.green('             ║'));
console.log(chalk.green('  ════════════════════════════════════════\\n'));

startBot();

process.on('uncaughtException', (e) => console.error('  ❌ Exception:', e.message));
process.on('unhandledRejection', (e) => console.error('  ❌ Rejection:', e.message));
`;

        // Write bot runner
        fs.writeFileSync('./bot_runner.js', botScript);
        
        await sleep(500);
        
        // Start bot process
        botProcess = spawn('node', ['bot_runner.js'], {
            stdio: 'inherit',
            detached: false,
        });
        
        botStartTime = Date.now();
        
        botProcess.on('error', (err) => {
            spin.fail('Failed to start bot: ' + err.message);
            botProcess = null;
        });
        
        botProcess.on('exit', (code) => {
            console.log(chalk.yellow(`\n  Bot process exited with code ${code}`));
            botProcess = null;
            botStartTime = null;
        });
        
        spin.succeed('Bot started successfully!');
        console.log(chalk.gray('  PID: ' + botProcess.pid));
        
        return true;
    } catch (e) {
        spin.fail('Failed to start bot: ' + e.message);
        return false;
    }
};

const stopBotProcess = async () => {
    if (!isBotRunning()) {
        console.log(chalk.yellow('\n  ⚠️  Bot is not running!'));
        return false;
    }
    
    const spin = spinner('Stopping UBot...');
    
    try {
        botProcess.kill('SIGTERM');
        await sleep(1000);
        
        if (isBotRunning()) {
            botProcess.kill('SIGKILL');
        }
        
        botProcess = null;
        botStartTime = null;
        
        spin.succeed('Bot stopped successfully!');
        return true;
    } catch (e) {
        spin.fail('Failed to stop bot: ' + e.message);
        return false;
    }
};

// ============ MENU ACTIONS ============
const actions = {
    // Main Menu Actions
    startBot: async () => {
        printHeader();
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
        console.log(chalk.cyan('  ║') + chalk.white.bold('  🚀 STARTING UBOT') + chalk.cyan('                     ║'));
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
        
        await startBotProcess();
        // Don't return to menu - let bot run
    },
    
    stopBot: async () => {
        printHeader();
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
        console.log(chalk.cyan('  ║') + chalk.white.bold('  🛑 STOPPING UBOT') + chalk.cyan('                     ║'));
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
        
        await stopBotProcess();
        await pressEnter();
        return 'main';
    },
    
    viewStatus: async () => {
        printHeader();
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
        console.log(chalk.cyan('  ║') + chalk.white.bold('  📊 BOT STATUS') + chalk.cyan('                        ║'));
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
        
        const status = getBotStatus();
        const session = getSessionInfo();
        
        console.log(chalk.white('  ┌─────────────────────────────────────┐'));
        console.log(chalk.white('  │') + chalk.gray(' Bot Status:     ') + (status.running ? chalk.green('● RUNNING') : chalk.red('● STOPPED')).padEnd(30) + chalk.white('│'));
        if (status.running) {
            console.log(chalk.white('  │') + chalk.gray(' Process ID:     ') + chalk.white(String(status.pid).padEnd(20)) + chalk.white('│'));
            console.log(chalk.white('  │') + chalk.gray(' Uptime:         ') + chalk.white(status.uptime.padEnd(20)) + chalk.white('│'));
        }
        console.log(chalk.white('  │') + chalk.gray(' Session:        ') + (session?.registered ? chalk.green('✓ Active') : chalk.yellow('✗ Not paired')).padEnd(30) + chalk.white('│'));
        if (session?.phone && session.phone !== 'Unknown') {
            console.log(chalk.white('  │') + chalk.gray(' Phone:          ') + chalk.white(('+' + session.phone).padEnd(20)) + chalk.white('│'));
        }
        console.log(chalk.white('  │') + chalk.gray(' Memory:         ') + chalk.white(formatBytes(process.memoryUsage().rss).padEnd(20)) + chalk.white('│'));
        console.log(chalk.white('  └─────────────────────────────────────┘'));
        
        await pressEnter();
        return 'main';
    },
    
    viewLogs: async () => {
        printHeader();
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
        console.log(chalk.cyan('  ║') + chalk.white.bold('  📜 VIEW LOGS') + chalk.cyan('                         ║'));
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
        
        console.log(chalk.yellow('  ℹ️  To view live logs, start the bot from this menu.'));
        console.log(chalk.yellow('  The logs will appear in real-time.\n'));
        
        // Check for PM2 logs
        try {
            console.log(chalk.gray('  Checking for PM2 logs...'));
            const pm2Logs = execSync('pm2 logs ubot --lines 20 --nostream 2>/dev/null', { encoding: 'utf8' });
            console.log(chalk.gray('\n  Last 20 PM2 log lines:'));
            console.log(chalk.white(pm2Logs));
        } catch (e) {
            console.log(chalk.gray('  No PM2 logs available.'));
        }
        
        await pressEnter();
        return 'main';
    },
    
    sessionMenu: async () => {
        return 'session';
    },
    
    settingsMenu: async () => {
        return 'settings';
    },
    
    systemInfo: async () => {
        printHeader();
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
        console.log(chalk.cyan('  ║') + chalk.white.bold('  💻 SYSTEM INFORMATION') + chalk.cyan('                ║'));
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
        
        const info = getSystemInfo();
        
        console.log(chalk.white('  ┌─────────────────────────────────────┐'));
        console.log(chalk.white('  │') + chalk.gray(' Platform:       ') + chalk.white(info.platform.padEnd(20)) + chalk.white('│'));
        console.log(chalk.white('  │') + chalk.gray(' Architecture:   ') + chalk.white(info.arch.padEnd(20)) + chalk.white('│'));
        console.log(chalk.white('  │') + chalk.gray(' Node.js:        ') + chalk.white(info.nodeVersion.padEnd(20)) + chalk.white('│'));
        console.log(chalk.white('  │') + chalk.gray(' CPU Cores:      ') + chalk.white(String(info.cpus).padEnd(20)) + chalk.white('│'));
        console.log(chalk.white('  │') + chalk.gray(' Total Memory:   ') + chalk.white(info.totalMemory.padEnd(20)) + chalk.white('│'));
        console.log(chalk.white('  │') + chalk.gray(' Free Memory:    ') + chalk.white(info.freeMemory.padEnd(20)) + chalk.white('│'));
        console.log(chalk.white('  │') + chalk.gray(' Used by Bot:    ') + chalk.white(info.usedMemory.padEnd(20)) + chalk.white('│'));
        console.log(chalk.white('  │') + chalk.gray(' System Uptime:  ') + chalk.white(info.uptime.padEnd(20)) + chalk.white('│'));
        console.log(chalk.white('  │') + chalk.gray(' Hostname:       ') + chalk.white(info.hostname.substring(0, 20).padEnd(20)) + chalk.white('│'));
        console.log(chalk.white('  └─────────────────────────────────────┘'));
        
        await pressEnter();
        return 'main';
    },
    
    installDeps: async () => {
        printHeader();
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
        console.log(chalk.cyan('  ║') + chalk.white.bold('  📦 INSTALL DEPENDENCIES') + chalk.cyan('              ║'));
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
        
        const answer = await question('Install/update all dependencies? (y/n): ');
        
        if (answer.toLowerCase() === 'y') {
            const spin = spinner('Installing dependencies...');
            try {
                execSync('npm install', { stdio: 'inherit' });
                spin.succeed('Dependencies installed successfully!');
            } catch (e) {
                spin.fail('Failed to install dependencies');
            }
        }
        
        await pressEnter();
        return 'main';
    },
    
    about: async () => {
        printHeader();
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
        console.log(chalk.cyan('  ║') + chalk.white.bold('  ℹ️  ABOUT UBOT') + chalk.cyan('                       ║'));
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
        
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
        return 'main';
    },
    
    exit: async () => {
        printHeader();
        console.log(chalk.green('\n  👋 Thank you for using UBOT!'));
        console.log(chalk.gray('  See you next time!\n'));
        
        if (isBotRunning()) {
            const answer = await question('Bot is running. Stop it before exit? (y/n): ');
            if (answer.toLowerCase() === 'y') {
                await stopBotProcess();
            }
        }
        
        rl.close();
        process.exit(0);
    },
    
    // Session Menu Actions
    viewSession: async () => {
        printHeader();
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
        console.log(chalk.cyan('  ║') + chalk.white.bold('  🔍 SESSION INFO') + chalk.cyan('                      ║'));
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
        
        const session = getSessionInfo();
        
        if (!session) {
            console.log(chalk.yellow('  ⚠️  No session found.'));
        } else {
            console.log(chalk.white('  ┌─────────────────────────────────────┐'));
            console.log(chalk.white('  │') + chalk.gray(' Registered:     ') + (session.registered ? chalk.green('Yes') : chalk.red('No')).padEnd(28) + chalk.white('│'));
            console.log(chalk.white('  │') + chalk.gray(' Phone:          ') + chalk.white((session.phone || 'Unknown').padEnd(20)) + chalk.white('│'));
            console.log(chalk.white('  │') + chalk.gray(' Platform:       ') + chalk.white((session.platform || 'Unknown').padEnd(20)) + chalk.white('│'));
            console.log(chalk.white('  └─────────────────────────────────────┘'));
        }
        
        await pressEnter();
        return 'session';
    },
    
    deleteSession: async () => {
        printHeader();
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
        console.log(chalk.cyan('  ║') + chalk.white.bold('  🗑️  DELETE SESSION') + chalk.cyan('                    ║'));
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
        
        if (!sessionExists()) {
            console.log(chalk.yellow('  ⚠️  No session to delete.'));
            await pressEnter();
            return 'session';
        }
        
        console.log(chalk.red('  ⚠️  WARNING: This will log out your bot!'));
        const answer = await question('Are you sure? (yes/no): ');
        
        if (answer.toLowerCase() === 'yes') {
            if (isBotRunning()) {
                await stopBotProcess();
            }
            
            const spin = spinner('Deleting session...');
            if (deleteSession()) {
                spin.succeed('Session deleted successfully!');
            } else {
                spin.fail('Failed to delete session');
            }
        } else {
            console.log(chalk.gray('  Cancelled.'));
        }
        
        await pressEnter();
        return 'session';
    },
    
    backupSession: async () => {
        printHeader();
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
        console.log(chalk.cyan('  ║') + chalk.white.bold('  💾 BACKUP SESSION') + chalk.cyan('                    ║'));
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
        
        if (!sessionExists()) {
            console.log(chalk.yellow('  ⚠️  No session to backup.'));
            await pressEnter();
            return 'session';
        }
        
        const spin = spinner('Creating backup...');
        
        try {
            const backupDir = './session_backups';
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(backupDir, `session_${timestamp}`);
            
            fs.cpSync(CONFIG.sessionDir, backupPath, { recursive: true });
            
            spin.succeed(`Backup created: ${backupPath}`);
        } catch (e) {
            spin.fail('Backup failed: ' + e.message);
        }
        
        await pressEnter();
        return 'session';
    },
    
    restoreSession: async () => {
        printHeader();
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
        console.log(chalk.cyan('  ║') + chalk.white.bold('  📥 RESTORE SESSION') + chalk.cyan('                   ║'));
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
        
        const backupDir = './session_backups';
        if (!fs.existsSync(backupDir)) {
            console.log(chalk.yellow('  ⚠️  No backups found.'));
            await pressEnter();
            return 'session';
        }
        
        const backups = fs.readdirSync(backupDir).filter(f => f.startsWith('session_'));
        
        if (backups.length === 0) {
            console.log(chalk.yellow('  ⚠️  No backups found.'));
            await pressEnter();
            return 'session';
        }
        
        console.log(chalk.white('  Available backups:\n'));
        backups.forEach((b, i) => {
            console.log(chalk.gray(`  [${i + 1}] ${b}`));
        });
        console.log(chalk.gray('  [0] Cancel\n'));
        
        const choice = await question('Select backup number: ');
        const idx = parseInt(choice) - 1;
        
        if (idx >= 0 && idx < backups.length) {
            if (isBotRunning()) {
                await stopBotProcess();
            }
            
            const spin = spinner('Restoring session...');
            
            try {
                if (fs.existsSync(CONFIG.sessionDir)) {
                    fs.rmSync(CONFIG.sessionDir, { recursive: true });
                }
                
                fs.cpSync(path.join(backupDir, backups[idx]), CONFIG.sessionDir, { recursive: true });
                spin.succeed('Session restored successfully!');
            } catch (e) {
                spin.fail('Restore failed: ' + e.message);
            }
        } else if (choice !== '0') {
            console.log(chalk.red('  Invalid selection.'));
        }
        
        await pressEnter();
        return 'session';
    },
    
    // Settings Actions
    viewSettings: async () => {
        printHeader();
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'));
        console.log(chalk.cyan('  ║') + chalk.white.bold('  📋 CURRENT SETTINGS') + chalk.cyan('                  ║'));
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'));
        
        try {
            const settings = require('./settings');
            console.log(chalk.white('  ┌─────────────────────────────────────┐'));
            console.log(chalk.white('  │') + chalk.gray(' Bot Name:       ') + chalk.white((settings.botname || 'UBOT').padEnd(20)) + chalk.white('│'));
            console.log(chalk.white('  │') + chalk.gray(' Owner Number:   ') + chalk.white((settings.ownerNumber || 'Not set').padEnd(20)) + chalk.white('│'));
            console.log(chalk.white('  │') + chalk.gray(' Prefix:         ') + chalk.white((settings.prefix || '.').padEnd(20)) + chalk.white('│'));
            console.log(chalk.white('  │') + chalk.gray(' Pack Name:      ') + chalk.white((settings.packname || 'UBot').substring(0, 20).padEnd(20)) + chalk.white('│'));
            console.log(chalk.white('  │') + chalk.gray(' Author:         ') + chalk.white((settings.author || 'Glen').padEnd(20)) + chalk.white('│'));
            console.log(chalk.white('  └─────────────────────────────────────┘'));
        } catch (e) {
            console.log(chalk.red('  ❌ Could not load settings: ' + e.message));
        }
        
        await pressEnter();
        return 'settings';
    },
    
    changeBotName: async () => {
        printHeader();
        const newName = await question('Enter new bot name: ');
        if (newName) {
            console.log(chalk.green(`  ✅ Bot name would be changed to: ${newName}`));
            console.log(chalk.yellow('  ℹ️  Edit settings.js to make permanent changes.'));
        }
        await pressEnter();
        return 'settings';
    },
    
    changePort: async () => {
        printHeader();
        const newPort = await question('Enter new port number: ');
        if (newPort && !isNaN(newPort)) {
            console.log(chalk.green(`  ✅ Port would be changed to: ${newPort}`));
            console.log(chalk.yellow('  ℹ️  Set PORT environment variable or edit settings.'));
        }
        await pressEnter();
        return 'settings';
    },
    
    changeOwner: async () => {
        printHeader();
        const newOwner = await question('Enter owner phone number (with country code): ');
        if (newOwner) {
            console.log(chalk.green(`  ✅ Owner would be changed to: ${newOwner}`));
            console.log(chalk.yellow('  ℹ️  Edit data/owner.json to make permanent changes.'));
        }
        await pressEnter();
        return 'settings';
    },
    
    toggleAutoRead: async () => {
        console.log(chalk.yellow('  ℹ️  Use .autoread command in WhatsApp to toggle.'));
        await pressEnter();
        return 'settings';
    },
    
    togglePublic: async () => {
        console.log(chalk.yellow('  ℹ️  Use .mode public/private command in WhatsApp to toggle.'));
        await pressEnter();
        return 'settings';
    },
    
    back: async () => {
        return 'main';
    },
};

// ============ MAIN LOOP ============
const mainLoop = async () => {
    let currentMenu = 'main';
    
    while (true) {
        printHeader();
        
        let menuItems;
        let menuTitle;
        
        switch (currentMenu) {
            case 'session':
                menuItems = MENUS.session;
                menuTitle = 'SESSION MANAGER';
                break;
            case 'settings':
                menuItems = MENUS.settings;
                menuTitle = 'SETTINGS';
                break;
            default:
                menuItems = MENUS.main;
                menuTitle = 'MAIN MENU';
        }
        
        // Show current status
        const status = getBotStatus();
        console.log(chalk.gray(`  Status: ${status.running ? chalk.green('● Bot Running') : chalk.red('● Bot Stopped')}${status.running ? chalk.gray(' | PID: ' + status.pid + ' | Uptime: ' + status.uptime) : ''}`));
        
        printMenu(menuItems, menuTitle);
        
        const choice = await question('Enter your choice: ');
        const selectedItem = menuItems.find(item => item.key === choice);
        
        if (selectedItem && actions[selectedItem.action]) {
            const result = await actions[selectedItem.action]();
            if (result) currentMenu = result;
        } else {
            console.log(chalk.red('\n  ❌ Invalid option. Please try again.'));
            await sleep(1000);
        }
    }
};

// ============ STARTUP ============
const startup = async () => {
    clearScreen();
    console.log(BANNERS.loading);
    
    // Check required files
    const requiredFiles = ['./settings.js', './main.js', './lib/myfunc.js'];
    const missingFiles = requiredFiles.filter(f => !fs.existsSync(f));
    
    if (missingFiles.length > 0) {
        console.log(chalk.red('\n  ❌ Missing required files:'));
        missingFiles.forEach(f => console.log(chalk.red(`     - ${f}`)));
        console.log(chalk.yellow('\n  Please make sure all bot files are present.'));
        process.exit(1);
    }
    
    await sleep(1000);
    
    // Start main loop
    mainLoop().catch(err => {
        console.error(chalk.red('\n  ❌ Fatal error:'), err);
        process.exit(1);
    });
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n  Shutting down...'));
    if (isBotRunning()) {
        await stopBotProcess();
    }
    rl.close();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error(chalk.red('\n  ❌ Uncaught Exception:'), err.message);
});

process.on('unhandledRejection', (err) => {
    console.error(chalk.red('\n  ❌ Unhandled Rejection:'), err);
});

// Start the CLI
startup();
ENDOFFILE
