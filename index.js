/**
 * ██╗   ██╗██████╗  ██████╗ ████████╗
 * ██║   ██║██╔══██╗██╔═══██╗╚══██╔══╝
 * ██║   ██║██████╔╝██║   ██║   ██║   
 * ██║   ██║██╔══██╗██║   ██║   ██║   
 * ╚██████╔╝██████╔╝╚██████╔╝   ██║   
 *  ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝   
 * 
 * UBot - Unfiltered Bytzz WhatsApp Bot
 * Copyright (c) 2024 Glen (Zilla)
 * 
 * Advanced CLI Management System
 * Credits: Baileys Library, Glen/Zilla
 */

require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main')
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, sleep } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

// Import lightweight store
const store = require('./lib/lightweight_store')
const settings = require('./settings')

// ═══════════════════════════════════════════════════════════════
// ║                    UBOT CONFIGURATION                       ║
// ═══════════════════════════════════════════════════════════════
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
}

// Initialize store
store.readFromFile()
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization
setInterval(() => {
    if (global.gc) {
        global.gc()
    }
}, 60_000)

// Memory monitoring
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.log(chalk.red('  ⚠️ RAM too high (>400MB), restarting...'))
        process.exit(1)
    }
}, 30_000)

// Global variables
let owner = []
try {
    owner = JSON.parse(fs.readFileSync('./data/owner.json'))
} catch (e) {}

global.botname = "UBOT"
global.themeemoji = "⚡"

// Bot state
let XeonBotInc = null
let botStartTime = null
let isConnected = false
let connectedNumber = null

// ═══════════════════════════════════════════════════════════════
// ║                    ASCII ART & BANNERS                      ║
// ═══════════════════════════════════════════════════════════════
const BANNER = {
    main: () => console.log(chalk.green(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   ${chalk.greenBright('██╗   ██╗')}${chalk.white('██████╗  ██████╗ ████████╗')}                                       ║
║   ${chalk.greenBright('██║   ██║')}${chalk.white('██╔══██╗██╔═══██╗╚══██╔══╝')}                                       ║
║   ${chalk.greenBright('██║   ██║')}${chalk.white('██████╔╝██║   ██║   ██║   ')}   ${chalk.gray('Unfiltered Bytzz Bot')}            ║
║   ${chalk.greenBright('██║   ██║')}${chalk.white('██╔══██╗██║   ██║   ██║   ')}   ${chalk.gray('Multi-Device WhatsApp')}           ║
║   ${chalk.greenBright('╚██████╔╝')}${chalk.white('██████╔╝╚██████╔╝   ██║   ')}   ${chalk.gray('v' + CONFIG.version + ' by Glen')}              ║
║   ${chalk.greenBright(' ╚═════╝ ')}${chalk.white('╚═════╝  ╚═════╝    ╚═╝   ')}                                       ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`)),
    
    mini: () => console.log(chalk.green(`
  ┌─────────────────────────────────────────┐
  │  ${chalk.greenBright('⚡')} ${chalk.white.bold('UBOT')} ${chalk.gray('- Unfiltered Bytzz Bot')}       │
  │  ${chalk.gray('Created by Glen | v' + CONFIG.version)}            │
  └─────────────────────────────────────────┘
`)),

    loading: () => console.log(chalk.green(`
   ╔════════════════════════════════════╗
   ║  ${chalk.white('⚡ UBOT LOADING...')}               ║
   ║  ${chalk.gray('Please wait...')}                   ║
   ╚════════════════════════════════════╝
`)),

    connected: (phone) => console.log(chalk.green(`
  ╔═══════════════════════════════════════╗
  ║  ${chalk.white.bold('✅ UBOT CONNECTED SUCCESSFULLY!')}      ║
  ║  ${chalk.gray('Phone: +' + (phone || 'Unknown').padEnd(28))}║
  ║  ${chalk.gray('Time: ' + new Date().toLocaleString().padEnd(30))}║
  ╚═══════════════════════════════════════╝
`)),

    pairing: (code) => console.log(chalk.green(`
  ╔═══════════════════════════════════════╗
  ║  ${chalk.white.bold('📱 YOUR PAIRING CODE:')}                ║
  ║                                       ║
  ║     ${chalk.greenBright.bold(code.padEnd(33))}║
  ║                                       ║
  ║  ${chalk.gray('Enter this code in WhatsApp:')}        ║
  ║  ${chalk.gray('Settings → Linked Devices → Link')}    ║
  ╚═══════════════════════════════════════╝
`)),
}

// ═══════════════════════════════════════════════════════════════
// ║                    UTILITY FUNCTIONS                        ║
// ═══════════════════════════════════════════════════════════════
const clearScreen = () => {
    console.clear()
    process.stdout.write('\x1Bc')
}

const formatUptime = (ms) => {
    const s = Math.floor(ms / 1000) % 60
    const m = Math.floor(ms / 60000) % 60
    const h = Math.floor(ms / 3600000) % 24
    const d = Math.floor(ms / 86400000)
    return `${d}d ${h}h ${m}m ${s}s`
}

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const sessionExists = () => fs.existsSync(CONFIG.sessionDir) && fs.readdirSync(CONFIG.sessionDir).length > 0

const getSessionInfo = () => {
    if (!sessionExists()) return null
    try {
        const credsPath = path.join(CONFIG.sessionDir, 'creds.json')
        if (fs.existsSync(credsPath)) {
            const creds = JSON.parse(fs.readFileSync(credsPath))
            return {
                registered: creds.registered || false,
                phone: creds.me?.id?.split(':')[0] || 'Unknown',
            }
        }
    } catch (e) {}
    return { registered: false, phone: 'Unknown' }
}

const deleteSession = () => {
    try {
        if (fs.existsSync(CONFIG.sessionDir)) {
            rmSync(CONFIG.sessionDir, { recursive: true, force: true })
            return true
        }
    } catch (e) {}
    return false
}

const getSystemInfo = () => {
    const os = require('os')
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
    }
}

// ═══════════════════════════════════════════════════════════════
// ║                    READLINE INTERFACE                       ║
// ═══════════════════════════════════════════════════════════════
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
})

const question = (prompt) => new Promise((resolve) => {
    rl.question(chalk.green('  ? ') + chalk.white(prompt), (answer) => {
        resolve(answer.trim())
    })
})

const pressEnter = () => new Promise((resolve) => {
    rl.question(chalk.gray('\n  Press ENTER to continue...'), () => resolve())
})

// ═══════════════════════════════════════════════════════════════
// ║                    MENU DEFINITIONS                         ║
// ═══════════════════════════════════════════════════════════════
const MENUS = {
    main: [
        { key: '1', label: 'Start Bot', icon: '🚀', desc: 'Start the WhatsApp bot' },
        { key: '2', label: 'Stop Bot', icon: '🛑', desc: 'Stop the running bot' },
        { key: '3', label: 'Restart Bot', icon: '🔄', desc: 'Restart the bot' },
        { key: '4', label: 'Bot Status', icon: '📊', desc: 'View current status' },
        { key: '5', label: 'Session Manager', icon: '🔐', desc: 'Manage sessions' },
        { key: '6', label: 'Settings', icon: '⚙️', desc: 'Configure bot' },
        { key: '7', label: 'System Info', icon: '💻', desc: 'View system info' },
        { key: '8', label: 'Logs', icon: '📜', desc: 'View bot logs' },
        { key: '9', label: 'About', icon: 'ℹ️', desc: 'About UBot' },
        { key: '0', label: 'Exit', icon: '👋', desc: 'Exit CLI' },
    ],
    session: [
        { key: '1', label: 'View Session', icon: '🔍', desc: 'View session info' },
        { key: '2', label: 'Delete Session', icon: '🗑️', desc: 'Delete current session' },
        { key: '3', label: 'Backup Session', icon: '💾', desc: 'Backup session files' },
        { key: '4', label: 'Restore Session', icon: '📥', desc: 'Restore from backup' },
        { key: '0', label: 'Back', icon: '◀️', desc: 'Return to main menu' },
    ],
    settings: [
        { key: '1', label: 'Bot Name', icon: '✏️', desc: 'Change bot name' },
        { key: '2', label: 'Owner Number', icon: '👤', desc: 'Set owner number' },
        { key: '3', label: 'Prefix', icon: '🔣', desc: 'Change command prefix' },
        { key: '4', label: 'Auto Read', icon: '👁️', desc: 'Toggle auto-read' },
        { key: '5', label: 'Public Mode', icon: '🌐', desc: 'Toggle public mode' },
        { key: '6', label: 'View Settings', icon: '📋', desc: 'View all settings' },
        { key: '0', label: 'Back', icon: '◀️', desc: 'Return to main menu' },
    ],
}

const printMenu = (items, title) => {
    console.log(chalk.green('\n  ╔═══════════════════════════════════════════════════╗'))
    console.log(chalk.green('  ║') + chalk.white.bold(`  ${title}`.padEnd(51)) + chalk.green('║'))
    console.log(chalk.green('  ╠═══════════════════════════════════════════════════╣'))
    
    items.forEach(item => {
        const line = `  ${item.icon}  [${item.key}] ${item.label}`
        console.log(chalk.green('  ║') + chalk.white(line.padEnd(51)) + chalk.green('║'))
    })
    
    console.log(chalk.green('  ╚═══════════════════════════════════════════════════╝'))
}

const printStatus = () => {
    const status = isConnected ? chalk.green('● ONLINE') : chalk.red('● OFFLINE')
    const uptime = botStartTime ? formatUptime(Date.now() - botStartTime) : 'N/A'
    const memory = formatBytes(process.memoryUsage().rss)
    const phone = connectedNumber ? '+' + connectedNumber : 'Not connected'
    
    console.log(chalk.gray(`\n  Status: ${status} | Uptime: ${uptime} | RAM: ${memory} | Phone: ${phone}`))
}

// ═══════════════════════════════════════════════════════════════
// ║                    WHATSAPP BOT CORE                        ║
// ═══════════════════════════════════════════════════════════════
async function startUBot() {
    try {
        console.log(chalk.cyan('\n  🚀 Starting UBot...'))
        
        let { version, isLatest } = await fetchLatestBaileysVersion()
        console.log(chalk.gray(`  Using Baileys v${version.join('.')} (Latest: ${isLatest})`))
        
        const { state, saveCreds } = await useMultiFileAuthState(CONFIG.sessionDir)
        const msgRetryCounterCache = new NodeCache()

        XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            browser: ["UBot", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || ""
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        })

        // Save credentials
        XeonBotInc.ev.on('creds.update', saveCreds)
        
        // Bind store
        store.bind(XeonBotInc.ev)

        // Handle pairing code if not registered
        if (!XeonBotInc.authState.creds.registered) {
            console.log(chalk.cyan('\n  ════════════════════════════════════════'))
            console.log(chalk.cyan('  ║') + chalk.white.bold('  📱 UBOT PAIRING MODE') + chalk.cyan('                  ║'))
            console.log(chalk.cyan('  ════════════════════════════════════════\n'))
            
            const phoneNumber = await question('Enter WhatsApp number (with country code): ')
            const cleanNumber = phoneNumber.replace(/[^0-9]/g, '')
            
            // Validate phone number
            const pn = PhoneNumber('+' + cleanNumber)
            if (!pn.isValid()) {
                console.log(chalk.red('\n  ❌ Invalid phone number!'))
                console.log(chalk.yellow('  Format: 254712345678 (country code + number)'))
                return
            }

            setTimeout(async () => {
                try {
                    let code = await XeonBotInc.requestPairingCode(cleanNumber)
                    code = code?.match(/.{1,4}/g)?.join("-") || code
                    BANNER.pairing(code)
                } catch (error) {
                    console.log(chalk.red('\n  ❌ Failed to get pairing code: ' + error.message))
                }
            }, 3000)
        }

        // Connection update handler
        XeonBotInc.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update
            
            if (qr) {
                console.log(chalk.yellow('\n  📱 QR Code generated. Scan with WhatsApp.'))
            }
            
            if (connection === 'connecting') {
                console.log(chalk.yellow('  🔄 Connecting to WhatsApp...'))
            }
            
            if (connection === 'open') {
                isConnected = true
                botStartTime = Date.now()
                connectedNumber = XeonBotInc.user?.id?.split(':')[0]
                
                BANNER.connected(connectedNumber)
                
                // Send connection message
                try {
                    const botNumber = connectedNumber + '@s.whatsapp.net'
                    await XeonBotInc.sendMessage(botNumber, {
                        text: `⚡ *UBOT Connected!*\n\n🤖 Unfiltered Bytzz Bot\n⏰ ${new Date().toLocaleString()}\n✅ Status: Online\n\n📱 Telegram: ${CONFIG.telegram}\n🌐 Website: ${CONFIG.website}\n\n_Type .menu for commands_`
                    })
                } catch (e) {}
                
                console.log(chalk.green('\n  ✅ Bot is now running!'))
                console.log(chalk.gray('  Press Ctrl+C to return to menu\n'))
            }
            
            if (connection === 'close') {
                isConnected = false
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
                const statusCode = lastDisconnect?.error?.output?.statusCode
                
                console.log(chalk.red('\n  ❌ Connection closed'))
                
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    deleteSession()
                    console.log(chalk.yellow('  Session cleared. Please re-authenticate.'))
                }
                
                if (shouldReconnect) {
                    console.log(chalk.yellow('  🔄 Reconnecting in 5 seconds...'))
                    await delay(5000)
                    startUBot()
                }
            }
        })

        // Message handler
        XeonBotInc.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                const mek = chatUpdate.messages[0]
                if (!mek.message) return
                
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') 
                    ? mek.message.ephemeralMessage.message 
                    : mek.message
                
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    await handleStatus(XeonBotInc, chatUpdate)
                    return
                }
                
                if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                    if (!isGroup) return
                }
                
                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

                if (XeonBotInc?.msgRetryCounterCache) {
                    XeonBotInc.msgRetryCounterCache.clear()
                }

                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error(chalk.red('  ❌ Message error:'), err.message)
            }
        })

        // Helper functions
        XeonBotInc.decodeJid = (jid) => {
            if (!jid) return jid
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {}
                return decode.user && decode.server && decode.user + '@' + decode.server || jid
            } else return jid
        }

        XeonBotInc.ev.on('contacts.update', update => {
            for (let contact of update) {
                let id = XeonBotInc.decodeJid(contact.id)
                if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
            }
        })

        XeonBotInc.getName = (jid, withoutContact = false) => {
            let id = XeonBotInc.decodeJid(jid)
            let v
            if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
                v = store.contacts[id] || {}
                if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
                resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
            })
            else v = id === '0@s.whatsapp.net' ? { id, name: 'WhatsApp' } 
                : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ? XeonBotInc.user 
                : (store.contacts[id] || {})
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
        }

        XeonBotInc.public = true
        XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

        // Group participants handler
        XeonBotInc.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(XeonBotInc, update)
        })

        // Anti-call handler
        const antiCallNotified = new Set()
        XeonBotInc.ev.on('call', async (calls) => {
            try {
                const { readState: readAnticallState } = require('./commands/anticall')
                const state = readAnticallState()
                if (!state.enabled) return
                
                for (const call of calls) {
                    const callerJid = call.from || call.peerJid || call.chatId
                    if (!callerJid) continue
                    
                    try {
                        if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
                            await XeonBotInc.rejectCall(call.id, callerJid)
                        }
                    } catch {}

                    if (!antiCallNotified.has(callerJid)) {
                        antiCallNotified.add(callerJid)
                        setTimeout(() => antiCallNotified.delete(callerJid), 60000)
                        await XeonBotInc.sendMessage(callerJid, { text: '📵 Calls are blocked on this bot.' })
                    }
                    
                    setTimeout(async () => {
                        try { await XeonBotInc.updateBlockStatus(callerJid, 'block') } catch {}
                    }, 800)
                }
            } catch {}
        })

        // Status handlers
        XeonBotInc.ev.on('status.update', async (status) => {
            await handleStatus(XeonBotInc, status)
        })

        XeonBotInc.ev.on('messages.reaction', async (status) => {
            await handleStatus(XeonBotInc, status)
        })

        return XeonBotInc
        
    } catch (error) {
        console.error(chalk.red('\n  ❌ Error starting bot:'), error.message)
        console.log(chalk.yellow('  Retrying in 5 seconds...'))
        await delay(5000)
        return startUBot()
    }
}

async function stopUBot() {
    if (!XeonBotInc) {
        console.log(chalk.yellow('\n  ⚠️ Bot is not running!'))
        return false
    }
    
    console.log(chalk.cyan('\n  🛑 Stopping UBot...'))
    
    try {
        await XeonBotInc.logout()
    } catch (e) {}
    
    XeonBotInc = null
    isConnected = false
    botStartTime = null
    connectedNumber = null
    
    console.log(chalk.green('  ✅ Bot stopped successfully!'))
    return true
}

// ═══════════════════════════════════════════════════════════════
// ║                    MENU HANDLERS                            ║
// ═══════════════════════════════════════════════════════════════
const handlers = {
    // Main Menu
    startBot: async () => {
        if (isConnected) {
            console.log(chalk.yellow('\n  ⚠️ Bot is already running!'))
            await pressEnter()
            return
        }
        await startUBot()
    },
    
    stopBot: async () => {
        await stopUBot()
        await pressEnter()
    },
    
    restartBot: async () => {
        console.log(chalk.cyan('\n  🔄 Restarting UBot...'))
        await stopUBot()
        await delay(2000)
        await startUBot()
    },
    
    viewStatus: async () => {
        clearScreen()
        BANNER.mini()
        
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'))
        console.log(chalk.cyan('  ║') + chalk.white.bold('  📊 BOT STATUS') + chalk.cyan('                        ║'))
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'))
        
        const session = getSessionInfo()
        
        console.log(chalk.white('  ┌───────────────────────────────────────┐'))
        console.log(chalk.white('  │') + chalk.gray(' Bot Status:     ') + (isConnected ? chalk.green('● ONLINE') : chalk.red('● OFFLINE')).padEnd(30) + chalk.white('│'))
        
        if (isConnected && botStartTime) {
            console.log(chalk.white('  │') + chalk.gray(' Uptime:         ') + chalk.white(formatUptime(Date.now() - botStartTime).padEnd(22)) + chalk.white('│'))
        }
        
        console.log(chalk.white('  │') + chalk.gray(' Session:        ') + (session?.registered ? chalk.green('✓ Active') : chalk.yellow('✗ Not paired')).padEnd(30) + chalk.white('│'))
        
        if (connectedNumber) {
            console.log(chalk.white('  │') + chalk.gray(' Phone:          ') + chalk.white(('+' + connectedNumber).padEnd(22)) + chalk.white('│'))
        }
        
        console.log(chalk.white('  │') + chalk.gray(' Memory:         ') + chalk.white(formatBytes(process.memoryUsage().rss).padEnd(22)) + chalk.white('│'))
        console.log(chalk.white('  │') + chalk.gray(' Node.js:        ') + chalk.white(process.version.padEnd(22)) + chalk.white('│'))
        console.log(chalk.white('  │') + chalk.gray(' Bot Version:    ') + chalk.white(CONFIG.version.padEnd(22)) + chalk.white('│'))
        console.log(chalk.white('  └───────────────────────────────────────┘'))
        
        await pressEnter()
    },
    
    sessionMenu: async () => {
        while (true) {
            clearScreen()
            BANNER.mini()
            printMenu(MENUS.session, '🔐 SESSION MANAGER')
            
            const choice = await question('Enter choice: ')
            
            switch (choice) {
                case '1': // View Session
                    clearScreen()
                    BANNER.mini()
                    console.log(chalk.cyan('\n  🔍 SESSION INFO\n'))
                    
                    const session = getSessionInfo()
                    if (!session) {
                        console.log(chalk.yellow('  ⚠️ No session found.'))
                    } else {
                        console.log(chalk.white('  Registered: ') + (session.registered ? chalk.green('Yes') : chalk.red('No')))
                        console.log(chalk.white('  Phone: ') + (session.phone || 'Unknown'))
                        
                        if (fs.existsSync(CONFIG.sessionDir)) {
                            const files = fs.readdirSync(CONFIG.sessionDir)
                            console.log(chalk.white('  Files: ') + files.length)
                        }
                    }
                    await pressEnter()
                    break
                    
                case '2': // Delete Session
                    clearScreen()
                    BANNER.mini()
                    console.log(chalk.red('\n  ⚠️ WARNING: This will log out your bot!\n'))
                    
                    const confirm = await question('Type "yes" to confirm: ')
                    if (confirm.toLowerCase() === 'yes') {
                        if (isConnected) {
                            await stopUBot()
                        }
                        if (deleteSession()) {
                            console.log(chalk.green('\n  ✅ Session deleted successfully!'))
                        } else {
                            console.log(chalk.yellow('\n  ⚠️ No session to delete.'))
                        }
                    } else {
                        console.log(chalk.gray('\n  Cancelled.'))
                    }
                    await pressEnter()
                    break
                    
                case '3': // Backup Session
                    clearScreen()
                    BANNER.mini()
                    
                    if (!sessionExists()) {
                        console.log(chalk.yellow('\n  ⚠️ No session to backup.'))
                    } else {
                        const backupDir = './session_backups'
                        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir)
                        
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
                        const backupPath = path.join(backupDir, `session_${timestamp}`)
                        
                        fs.cpSync(CONFIG.sessionDir, backupPath, { recursive: true })
                        console.log(chalk.green(`\n  ✅ Backup created: ${backupPath}`))
                    }
                    await pressEnter()
                    break
                    
                case '4': // Restore Session
                    clearScreen()
                    BANNER.mini()
                    
                    const backupDir = './session_backups'
                    if (!fs.existsSync(backupDir)) {
                        console.log(chalk.yellow('\n  ⚠️ No backups found.'))
                        await pressEnter()
                        break
                    }
                    
                    const backups = fs.readdirSync(backupDir).filter(f => f.startsWith('session_'))
                    if (backups.length === 0) {
                        console.log(chalk.yellow('\n  ⚠️ No backups found.'))
                        await pressEnter()
                        break
                    }
                    
                    console.log(chalk.cyan('\n  📁 Available Backups:\n'))
                    backups.forEach((b, i) => {
                        console.log(chalk.gray(`  [${i + 1}] ${b}`))
                    })
                    console.log(chalk.gray('  [0] Cancel\n'))
                    
                    const backupChoice = await question('Select backup: ')
                    const idx = parseInt(backupChoice) - 1
                    
                    if (idx >= 0 && idx < backups.length) {
                        if (isConnected) await stopUBot()
                        if (fs.existsSync(CONFIG.sessionDir)) {
                            fs.rmSync(CONFIG.sessionDir, { recursive: true })
                        }
                        fs.cpSync(path.join(backupDir, backups[idx]), CONFIG.sessionDir, { recursive: true })
                        console.log(chalk.green('\n  ✅ Session restored!'))
                    }
                    await pressEnter()
                    break
                    
                case '0':
                    return
            }
        }
    },
    
    settingsMenu: async () => {
        while (true) {
            clearScreen()
            BANNER.mini()
            printMenu(MENUS.settings, '⚙️ SETTINGS')
            
            const choice = await question('Enter choice: ')
            
            switch (choice) {
                case '6': // View Settings
                    clearScreen()
                    BANNER.mini()
                    console.log(chalk.cyan('\n  📋 CURRENT SETTINGS\n'))
                    
                    try {
                        const s = require('./settings')
                        console.log(chalk.white('  ┌───────────────────────────────────────┐'))
                        console.log(chalk.white('  │') + chalk.gray(' Bot Name:       ') + chalk.white((s.botname || 'UBOT').padEnd(22)) + chalk.white('│'))
                        console.log(chalk.white('  │') + chalk.gray(' Owner:          ') + chalk.white((s.ownerNumber || 'Not set').padEnd(22)) + chalk.white('│'))
                        console.log(chalk.white('  │') + chalk.gray(' Prefix:         ') + chalk.white((s.prefix || '.').padEnd(22)) + chalk.white('│'))
                        console.log(chalk.white('  │') + chalk.gray(' Pack Name:      ') + chalk.white((s.packname || 'UBot').substring(0, 20).padEnd(22)) + chalk.white('│'))
                        console.log(chalk.white('  │') + chalk.gray(' Author:         ') + chalk.white((s.author || 'Glen').padEnd(22)) + chalk.white('│'))
                        console.log(chalk.white('  └───────────────────────────────────────┘'))
                    } catch (e) {
                        console.log(chalk.red('  ❌ Could not load settings.'))
                    }
                    await pressEnter()
                    break
                    
                case '0':
                    return
                    
                default:
                    console.log(chalk.yellow('\n  ℹ️ Edit settings.js manually to change this setting.'))
                    await pressEnter()
            }
        }
    },
    
    systemInfo: async () => {
        clearScreen()
        BANNER.mini()
        
        const info = getSystemInfo()
        
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'))
        console.log(chalk.cyan('  ║') + chalk.white.bold('  💻 SYSTEM INFORMATION') + chalk.cyan('                ║'))
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'))
        
        console.log(chalk.white('  ┌───────────────────────────────────────┐'))
        console.log(chalk.white('  │') + chalk.gray(' Platform:       ') + chalk.white(info.platform.padEnd(22)) + chalk.white('│'))
        console.log(chalk.white('  │') + chalk.gray(' Architecture:   ') + chalk.white(info.arch.padEnd(22)) + chalk.white('│'))
        console.log(chalk.white('  │') + chalk.gray(' Node.js:        ') + chalk.white(info.nodeVersion.padEnd(22)) + chalk.white('│'))
        console.log(chalk.white('  │') + chalk.gray(' CPU Cores:      ') + chalk.white(String(info.cpus).padEnd(22)) + chalk.white('│'))
        console.log(chalk.white('  │') + chalk.gray(' Total Memory:   ') + chalk.white(info.totalMemory.padEnd(22)) + chalk.white('│'))
        console.log(chalk.white('  │') + chalk.gray(' Free Memory:    ') + chalk.white(info.freeMemory.padEnd(22)) + chalk.white('│'))
        console.log(chalk.white('  │') + chalk.gray(' Used by Bot:    ') + chalk.white(info.usedMemory.padEnd(22)) + chalk.white('│'))
        console.log(chalk.white('  │') + chalk.gray(' System Uptime:  ') + chalk.white(info.uptime.padEnd(22)) + chalk.white('│'))
        console.log(chalk.white('  │') + chalk.gray(' Hostname:       ') + chalk.white(info.hostname.substring(0, 20).padEnd(22)) + chalk.white('│'))
        console.log(chalk.white('  └───────────────────────────────────────┘'))
        
        await pressEnter()
    },
    
    viewLogs: async () => {
        clearScreen()
        BANNER.mini()
        
        console.log(chalk.cyan('\n  ═══════════════════════════════════════'))
        console.log(chalk.cyan('  ║') + chalk.white.bold('  📜 BOT LOGS') + chalk.cyan('                           ║'))
        console.log(chalk.cyan('  ═══════════════════════════════════════\n'))
        
        console.log(chalk.yellow('  ℹ️ Logs are displayed in real-time when bot is running.'))
        console.log(chalk.gray('  Start the bot to see live activity.\n'))
        
        await pressEnter()
    },
    
    about: async () => {
        clearScreen()
        BANNER.main()
        
        console.log(chalk.green(`
    ⚡ UBOT - Unfiltered Bytzz Bot
    
    ${chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
    
    Version:     ${CONFIG.version}
    Author:      ${CONFIG.author}
    Telegram:    ${CONFIG.telegram}
    WhatsApp:    ${CONFIG.whatsapp}
    GitHub:      ${CONFIG.github}
    Website:     ${CONFIG.website}
    
    ${chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
    
    ${chalk.white('Features:')}
    • 100+ Commands
    • Group Management (antilink, antibadword)
    • Media Downloads (YouTube, TikTok, IG)
    • AI Features (ChatGPT, Gemini)
    • Sticker Maker
    • Games & Fun Commands
    • Multi-Device Support
    
    ${chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
    
    ${chalk.gray('Made with ❤️ by Glen')}
        `))
        
        await pressEnter()
    },
    
    exit: async () => {
        clearScreen()
        console.log(chalk.green('\n  👋 Thank you for using UBot!'))
        console.log(chalk.gray('  Goodbye!\n'))
        
        if (isConnected) {
            const confirm = await question('Bot is running. Stop before exit? (y/n): ')
            if (confirm.toLowerCase() === 'y') {
                await stopUBot()
            }
        }
        
        rl.close()
        process.exit(0)
    },
}

// ═══════════════════════════════════════════════════════════════
// ║                    MAIN LOOP                                ║
// ═══════════════════════════════════════════════════════════════
async function mainLoop() {
    while (true) {
        clearScreen()
        BANNER.main()
        printStatus()
        printMenu(MENUS.main, '⚡ UBOT MAIN MENU')
        
        const choice = await question('Enter choice: ')
        
        switch (choice) {
            case '1': await handlers.startBot(); break
            case '2': await handlers.stopBot(); break
            case '3': await handlers.restartBot(); break
            case '4': await handlers.viewStatus(); break
            case '5': await handlers.sessionMenu(); break
            case '6': await handlers.settingsMenu(); break
            case '7': await handlers.systemInfo(); break
            case '8': await handlers.viewLogs(); break
            case '9': await handlers.about(); break
            case '0': await handlers.exit(); break
            default:
                console.log(chalk.red('\n  ❌ Invalid option!'))
                await sleep(1000)
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// ║                    STARTUP                                  ║
// ═══════════════════════════════════════════════════════════════
async function startup() {
    clearScreen()
    BANNER.loading()
    
    // Check required files
    const requiredFiles = ['./settings.js', './main.js', './lib/myfunc.js']
    const missing = requiredFiles.filter(f => !fs.existsSync(f))
    
    if (missing.length > 0) {
        console.log(chalk.red('\n  ❌ Missing required files:'))
        missing.forEach(f => console.log(chalk.red(`     - ${f}`)))
        console.log(chalk.yellow('\n  Please ensure all bot files are present.'))
        process.exit(1)
    }
    
    await sleep(1500)
    mainLoop()
}

// ═══════════════════════════════════════════════════════════════
// ║                    ERROR HANDLING                           ║
// ═══════════════════════════════════════════════════════════════
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n  Shutting down...'))
    if (isConnected) {
        await stopUBot()
    }
    rl.close()
    process.exit(0)
})

process.on('uncaughtException', (err) => {
    console.error(chalk.red('\n  ❌ Uncaught Exception:'), err.message)
})

process.on('unhandledRejection', (err) => {
    console.error(chalk.red('\n  ❌ Unhandled Rejection:'), err)
})

// Hot reload
let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.yellow(`\n  🔄 File updated: ${__filename}`))
    delete require.cache[file]
})

// ═══════════════════════════════════════════════════════════════
// ║                    START                                    ║
// ═══════════════════════════════════════════════════════════════
startup()
