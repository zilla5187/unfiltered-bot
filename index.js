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
 * Credits:
 * - Baileys Library by @WhiskeySockets
 * - CLI System by Glen
 */

require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const path = require('path')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main')
const PhoneNumber = require('awesome-phonenumber')
const { smsg } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidDecode,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { rmSync } = require('fs')

// Import lightweight store
const store = require('./lib/lightweight_store')
const settings = require('./settings')

// ═══════════════════════════════════════════════════════════════
//                    UBOT CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
    botName: 'UBOT',
    version: '4.0.0',
    author: 'Glen',
    telegram: '@unfilteredg',
    whatsapp: '+25473505427',
    github: 'github.com/zilla5187',
    website: 'netivosolutions.top',
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
        console.log(chalk.red('⚠️ RAM too high (>400MB), restarting...'))
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
let isConnected = false
let connectedNumber = null
let botStartTime = null
let isInMenu = true

// ═══════════════════════════════════════════════════════════════
//                    UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════
const clearScreen = () => {
    console.clear()
}

const formatUptime = (ms) => {
    const s = Math.floor(ms / 1000) % 60
    const m = Math.floor(ms / 60000) % 60
    const h = Math.floor(ms / 3600000) % 24
    const d = Math.floor(ms / 86400000)
    return `${d}d ${h}h ${m}m ${s}s`
}

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const sessionExists = () => {
    return fs.existsSync('./session') && fs.readdirSync('./session').length > 0
}

const deleteSession = () => {
    try {
        if (fs.existsSync('./session')) {
            rmSync('./session', { recursive: true, force: true })
            return true
        }
    } catch (e) {}
    return false
}

// ═══════════════════════════════════════════════════════════════
//                    READLINE SETUP
// ═══════════════════════════════════════════════════════════════
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
})

const question = (text) => {
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            resolve(answer.trim())
        })
    })
}

// ═══════════════════════════════════════════════════════════════
//                    ASCII BANNERS
// ═══════════════════════════════════════════════════════════════
const showBanner = () => {
    console.log(chalk.green(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ${chalk.greenBright('██╗   ██╗')}${chalk.white('██████╗  ██████╗ ████████╗')}                   ║
║   ${chalk.greenBright('██║   ██║')}${chalk.white('██╔══██╗██╔═══██╗╚══██╔══╝')}                   ║
║   ${chalk.greenBright('██║   ██║')}${chalk.white('██████╔╝██║   ██║   ██║   ')}  ${chalk.gray('Unfiltered Bytzz')}  ║
║   ${chalk.greenBright('██║   ██║')}${chalk.white('██╔══██╗██║   ██║   ██║   ')}  ${chalk.gray('WhatsApp Bot')}      ║
║   ${chalk.greenBright('╚██████╔╝')}${chalk.white('██████╔╝╚██████╔╝   ██║   ')}  ${chalk.gray('v' + CONFIG.version)}             ║
║   ${chalk.greenBright(' ╚═════╝ ')}${chalk.white('╚═════╝  ╚═════╝    ╚═╝   ')}                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`))
    console.log(chalk.gray(`  📱 TG: ${CONFIG.telegram} | 💬 WA: ${CONFIG.whatsapp}`))
    console.log(chalk.gray(`  🌐 ${CONFIG.website} | 📦 ${CONFIG.github}\n`))
}

const showMenu = () => {
    const status = isConnected ? chalk.green('● ONLINE') : chalk.red('● OFFLINE')
    const uptime = botStartTime ? formatUptime(Date.now() - botStartTime) : 'N/A'
    const ram = formatBytes(process.memoryUsage().rss)
    const phone = connectedNumber ? '+' + connectedNumber : 'Not connected'
    
    console.log(chalk.gray(`  Status: ${status} | Uptime: ${uptime} | RAM: ${ram}`))
    console.log(chalk.gray(`  Phone: ${phone}\n`))
    
    console.log(chalk.green(`  ╔════════════════════════════════════════╗`))
    console.log(chalk.green(`  ║`) + chalk.white.bold(`  ⚡ UBOT MAIN MENU                     `) + chalk.green(`║`))
    console.log(chalk.green(`  ╠════════════════════════════════════════╣`))
    console.log(chalk.green(`  ║`) + chalk.white(`  [1] 🚀 Start Bot                       `) + chalk.green(`║`))
    console.log(chalk.green(`  ║`) + chalk.white(`  [2] 🛑 Stop Bot                        `) + chalk.green(`║`))
    console.log(chalk.green(`  ║`) + chalk.white(`  [3] 📊 View Status                     `) + chalk.green(`║`))
    console.log(chalk.green(`  ║`) + chalk.white(`  [4] 🗑️  Delete Session                  `) + chalk.green(`║`))
    console.log(chalk.green(`  ║`) + chalk.white(`  [5] 💻 System Info                     `) + chalk.green(`║`))
    console.log(chalk.green(`  ║`) + chalk.white(`  [6] ℹ️  About                           `) + chalk.green(`║`))
    console.log(chalk.green(`  ║`) + chalk.white(`  [0] 👋 Exit                            `) + chalk.green(`║`))
    console.log(chalk.green(`  ╚════════════════════════════════════════╝\n`))
}

// ═══════════════════════════════════════════════════════════════
//                    WHATSAPP BOT CORE
// ═══════════════════════════════════════════════════════════════
async function startUBot() {
    try {
        isInMenu = false
        
        console.log(chalk.cyan('\n  ══════════════════════════════════════'))
        console.log(chalk.cyan('  ║') + chalk.white.bold('  🚀 STARTING UBOT...') + chalk.cyan('                  ║'))
        console.log(chalk.cyan('  ══════════════════════════════════════\n'))
        
        let { version, isLatest } = await fetchLatestBaileysVersion()
        console.log(chalk.gray(`  Baileys Version: ${version.join('.')}`))
        
        const { state, saveCreds } = await useMultiFileAuthState('./session')
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
            console.log(chalk.cyan('\n  ══════════════════════════════════════'))
            console.log(chalk.cyan('  ║') + chalk.white.bold('  📱 PAIRING MODE') + chalk.cyan('                      ║'))
            console.log(chalk.cyan('  ══════════════════════════════════════\n'))
            
            console.log(chalk.yellow('  Enter your WhatsApp number with country code'))
            console.log(chalk.gray('  Example: 254712345678 (without + or spaces)\n'))
            
            const phoneNumber = await question(chalk.green('  ? ') + chalk.white('Phone Number: '))
            const cleanNumber = phoneNumber.replace(/[^0-9]/g, '')
            
            // Validate
            const pn = PhoneNumber('+' + cleanNumber)
            if (!pn.isValid()) {
                console.log(chalk.red('\n  ❌ Invalid phone number!'))
                console.log(chalk.yellow('  Please use format: 254712345678\n'))
                isInMenu = true
                return
            }

            console.log(chalk.yellow('\n  ⏳ Requesting pairing code...\n'))

            // Wait for connection to be ready, then request code
            setTimeout(async () => {
                try {
                    let code = await XeonBotInc.requestPairingCode(cleanNumber)
                    code = code?.match(/.{1,4}/g)?.join("-") || code
                    
                    console.log(chalk.green('  ╔════════════════════════════════════════╗'))
                    console.log(chalk.green('  ║') + chalk.white.bold('  📱 YOUR PAIRING CODE:                 ') + chalk.green('║'))
                    console.log(chalk.green('  ║') + chalk.white('                                        ') + chalk.green('║'))
                    console.log(chalk.green('  ║') + chalk.greenBright.bold(`       ${code}                      `) + chalk.green('║'))
                    console.log(chalk.green('  ║') + chalk.white('                                        ') + chalk.green('║'))
                    console.log(chalk.green('  ╚════════════════════════════════════════╝\n'))
                    
                    console.log(chalk.yellow('  📋 Steps to connect:'))
                    console.log(chalk.gray('  1. Open WhatsApp on your phone'))
                    console.log(chalk.gray('  2. Go to Settings → Linked Devices'))
                    console.log(chalk.gray('  3. Tap "Link a Device"'))
                    console.log(chalk.gray('  4. Enter the code shown above\n'))
                    console.log(chalk.cyan('  ⏳ Waiting for connection...\n'))
                    
                } catch (error) {
                    console.log(chalk.red('\n  ❌ Failed to get pairing code: ' + error.message))
                    console.log(chalk.yellow('  Try scanning the QR code instead.\n'))
                }
            }, 3000)
        }

        // Connection handler
        XeonBotInc.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update
            
            if (qr && XeonBotInc.authState.creds.registered === false) {
                console.log(chalk.yellow('\n  📱 QR Code generated - Scan with WhatsApp\n'))
            }
            
            if (connection === 'connecting') {
                console.log(chalk.yellow('  🔄 Connecting to WhatsApp...'))
            }
            
            if (connection === 'open') {
                isConnected = true
                botStartTime = Date.now()
                connectedNumber = XeonBotInc.user?.id?.split(':')[0]
                
                console.log(chalk.green('\n  ╔════════════════════════════════════════╗'))
                console.log(chalk.green('  ║') + chalk.white.bold('  ✅ UBOT CONNECTED SUCCESSFULLY!       ') + chalk.green('║'))
                console.log(chalk.green('  ╠════════════════════════════════════════╣'))
                console.log(chalk.green('  ║') + chalk.gray(`  Phone: +${connectedNumber || 'Unknown'}`.padEnd(40)) + chalk.green('║'))
                console.log(chalk.green('  ║') + chalk.gray(`  Time: ${new Date().toLocaleString()}`.padEnd(40)) + chalk.green('║'))
                console.log(chalk.green('  ╚════════════════════════════════════════╝\n'))

                // Send connection message
                try {
                    const botNumber = connectedNumber + '@s.whatsapp.net'
                    await XeonBotInc.sendMessage(botNumber, {
                        text: `⚡ *UBOT Connected!*\n\n🤖 Unfiltered Bytzz Bot\n⏰ ${new Date().toLocaleString()}\n✅ Status: Online\n\n📱 Telegram: ${CONFIG.telegram}\n🌐 Website: ${CONFIG.website}\n\n_Type .menu for commands_`
                    })
                } catch (e) {}

                console.log(chalk.green('  ✅ Bot is now running!'))
                console.log(chalk.gray('  Messages will be processed automatically.'))
                console.log(chalk.yellow('\n  Press Ctrl+C to stop the bot\n'))
            }
            
            if (connection === 'close') {
                isConnected = false
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
                const statusCode = lastDisconnect?.error?.output?.statusCode
                
                console.log(chalk.red('\n  ❌ Connection closed'))
                
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    deleteSession()
                    console.log(chalk.yellow('  Session cleared. Please re-authenticate.\n'))
                    isInMenu = true
                    showMainMenu()
                } else if (shouldReconnect) {
                    console.log(chalk.yellow('  🔄 Reconnecting in 5 seconds...\n'))
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

                try {
                    await handleMessages(XeonBotInc, chatUpdate, true)
                } catch (err) {
                    console.error(chalk.red('  ❌ Message error:'), err.message)
                }
            } catch (err) {
                console.error(chalk.red('  ❌ Error:'), err.message)
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

        // Group participants
        XeonBotInc.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(XeonBotInc, update)
        })

        // Status handlers
        XeonBotInc.ev.on('status.update', async (status) => {
            await handleStatus(XeonBotInc, status)
        })

        // Anti-call
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
                        await XeonBotInc.sendMessage(callerJid, { text: '📵 Calls are blocked.' })
                    }
                    
                    setTimeout(async () => {
                        try { await XeonBotInc.updateBlockStatus(callerJid, 'block') } catch {}
                    }, 800)
                }
            } catch {}
        })

        return XeonBotInc
        
    } catch (error) {
        console.error(chalk.red('\n  ❌ Error:'), error.message)
        console.log(chalk.yellow('  Retrying in 5 seconds...\n'))
        await delay(5000)
        return startUBot()
    }
}

// ═══════════════════════════════════════════════════════════════
//                    MENU HANDLERS
// ═══════════════════════════════════════════════════════════════
async function showMainMenu() {
    if (!isInMenu) return
    
    clearScreen()
    showBanner()
    showMenu()
    
    const choice = await question(chalk.green('  ? ') + chalk.white('Enter choice: '))
    
    switch (choice) {
        case '1':
            await startUBot()
            break
            
        case '2':
            if (XeonBotInc && isConnected) {
                console.log(chalk.cyan('\n  🛑 Stopping bot...'))
                try {
                    await XeonBotInc.logout()
                } catch (e) {}
                XeonBotInc = null
                isConnected = false
                botStartTime = null
                connectedNumber = null
                console.log(chalk.green('  ✅ Bot stopped!\n'))
            } else {
                console.log(chalk.yellow('\n  ⚠️ Bot is not running!\n'))
            }
            await question(chalk.gray('  Press ENTER to continue...'))
            showMainMenu()
            break
            
        case '3':
            clearScreen()
            showBanner()
            console.log(chalk.cyan('  ══════════════════════════════════════'))
            console.log(chalk.cyan('  ║') + chalk.white.bold('  📊 BOT STATUS') + chalk.cyan('                        ║'))
            console.log(chalk.cyan('  ══════════════════════════════════════\n'))
            
            console.log(chalk.white('  Status:     ') + (isConnected ? chalk.green('● ONLINE') : chalk.red('● OFFLINE')))
            console.log(chalk.white('  Phone:      ') + (connectedNumber ? '+' + connectedNumber : 'Not connected'))
            console.log(chalk.white('  Uptime:     ') + (botStartTime ? formatUptime(Date.now() - botStartTime) : 'N/A'))
            console.log(chalk.white('  Memory:     ') + formatBytes(process.memoryUsage().rss))
            console.log(chalk.white('  Session:    ') + (sessionExists() ? chalk.green('✓ Exists') : chalk.yellow('✗ None')))
            console.log(chalk.white('  Node.js:    ') + process.version)
            console.log()
            
            await question(chalk.gray('  Press ENTER to continue...'))
            showMainMenu()
            break
            
        case '4':
            console.log(chalk.red('\n  ⚠️ This will delete your session and log out the bot!\n'))
            const confirm = await question(chalk.yellow('  Type "yes" to confirm: '))
            
            if (confirm.toLowerCase() === 'yes') {
                if (XeonBotInc) {
                    try { await XeonBotInc.logout() } catch (e) {}
                    XeonBotInc = null
                }
                isConnected = false
                connectedNumber = null
                botStartTime = null
                
                if (deleteSession()) {
                    console.log(chalk.green('\n  ✅ Session deleted!\n'))
                } else {
                    console.log(chalk.yellow('\n  ⚠️ No session to delete.\n'))
                }
            } else {
                console.log(chalk.gray('\n  Cancelled.\n'))
            }
            
            await question(chalk.gray('  Press ENTER to continue...'))
            showMainMenu()
            break
            
        case '5':
            clearScreen()
            showBanner()
            const os = require('os')
            
            console.log(chalk.cyan('  ══════════════════════════════════════'))
            console.log(chalk.cyan('  ║') + chalk.white.bold('  💻 SYSTEM INFO') + chalk.cyan('                       ║'))
            console.log(chalk.cyan('  ══════════════════════════════════════\n'))
            
            console.log(chalk.white('  Platform:   ') + os.platform())
            console.log(chalk.white('  Arch:       ') + os.arch())
            console.log(chalk.white('  Node.js:    ') + process.version)
            console.log(chalk.white('  CPUs:       ') + os.cpus().length)
            console.log(chalk.white('  Total RAM:  ') + formatBytes(os.totalmem()))
            console.log(chalk.white('  Free RAM:   ') + formatBytes(os.freemem()))
            console.log(chalk.white('  Bot RAM:    ') + formatBytes(process.memoryUsage().rss))
            console.log(chalk.white('  Uptime:     ') + formatUptime(os.uptime() * 1000))
            console.log(chalk.white('  Hostname:   ') + os.hostname())
            console.log()
            
            await question(chalk.gray('  Press ENTER to continue...'))
            showMainMenu()
            break
            
        case '6':
            clearScreen()
            showBanner()
            
            console.log(chalk.green(`
  ⚡ UBOT - Unfiltered Bytzz Bot
  
  ${chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
  
  Version:     ${CONFIG.version}
  Author:      ${CONFIG.author}
  Telegram:    ${CONFIG.telegram}
  WhatsApp:    ${CONFIG.whatsapp}
  GitHub:      ${CONFIG.github}
  Website:     ${CONFIG.website}
  
  ${chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
  
  ${chalk.white('Features:')}
  • 100+ Commands
  • Group Management
  • Media Downloads
  • AI Integration
  • Sticker Maker
  • Games & Fun
  
  ${chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
  
  ${chalk.gray('Made with ❤️ by Glen')}
            `))
            
            await question(chalk.gray('  Press ENTER to continue...'))
            showMainMenu()
            break
            
        case '0':
            console.log(chalk.green('\n  👋 Thanks for using UBot! Goodbye!\n'))
            
            if (isConnected && XeonBotInc) {
                const stopBot = await question(chalk.yellow('  Stop bot before exit? (y/n): '))
                if (stopBot.toLowerCase() === 'y') {
                    try { await XeonBotInc.logout() } catch (e) {}
                }
            }
            
            rl.close()
            process.exit(0)
            break
            
        default:
            console.log(chalk.red('\n  ❌ Invalid option!\n'))
            await delay(1000)
            showMainMenu()
    }
}

// ═══════════════════════════════════════════════════════════════
//                    STARTUP
// ═══════════════════════════════════════════════════════════════
async function startup() {
    clearScreen()
    
    console.log(chalk.green(`
   ╔════════════════════════════════════╗
   ║  ${chalk.white('⚡ UBOT LOADING...')}               ║
   ╚════════════════════════════════════╝
    `))
    
    // Check required files
    const required = ['./settings.js', './main.js', './lib/myfunc.js']
    const missing = required.filter(f => !fs.existsSync(f))
    
    if (missing.length > 0) {
        console.log(chalk.red('\n  ❌ Missing files:'))
        missing.forEach(f => console.log(chalk.red(`     - ${f}`)))
        process.exit(1)
    }
    
    await delay(1500)
    showMainMenu()
}

// ═══════════════════════════════════════════════════════════════
//                    ERROR HANDLING
// ═══════════════════════════════════════════════════════════════
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n  Shutting down...'))
    if (XeonBotInc && isConnected) {
        try { await XeonBotInc.logout() } catch (e) {}
    }
    rl.close()
    process.exit(0)
})

process.on('uncaughtException', (err) => {
    console.error(chalk.red('  ❌ Error:'), err.message)
})

process.on('unhandledRejection', (err) => {
    console.error(chalk.red('  ❌ Error:'), err)
})

// Start
startup()
