/**
 * Knight OS - A WhatsApp Operating System
 * Based on Knight Bot
 * Copyright (c) 2024 Professor
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by TechGod143 & DGXEON
 * - OS Architecture by Knight Team
 */

require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
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
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

// Import lightweight store
const store = require('./lib/lightweight_store')

// ═══════════════════════════════════════════════════════════════════
// ║                    KNIGHT OS - KERNEL LAYER                     ║
// ═══════════════════════════════════════════════════════════════════

class KnightKernel {
    constructor() {
        this.version = '1.0.0'
        this.codename = 'Phoenix'
        this.bootTime = null
        this.processes = new Map()
        this.pidCounter = 1000
        this.systemCalls = new Map()
        this.interrupts = []
        this.kernelMode = false
    }

    boot() {
        this.bootTime = Date.now()
        this.kernelMode = true
        console.log(chalk.cyan('╔════════════════════════════════════════╗'))
        console.log(chalk.cyan('║') + chalk.yellow('      KNIGHT OS KERNEL INITIALIZING     ') + chalk.cyan('║'))
        console.log(chalk.cyan('╚════════════════════════════════════════╝'))
        this.initSystemCalls()
        this.kernelMode = false
        return true
    }

    initSystemCalls() {
        this.systemCalls.set('fork', this.fork.bind(this))
        this.systemCalls.set('exec', this.exec.bind(this))
        this.systemCalls.set('kill', this.kill.bind(this))
        this.systemCalls.set('getpid', this.getpid.bind(this))
    }

    fork(parentPid) {
        const newPid = ++this.pidCounter
        return newPid
    }

    exec(pid, command) {
        return { pid, status: 'executed', command }
    }

    kill(pid, signal = 'SIGTERM') {
        if (this.processes.has(pid)) {
            this.processes.delete(pid)
            return true
        }
        return false
    }

    getpid() {
        return process.pid
    }

    getUptime() {
        return Date.now() - this.bootTime
    }

    panic(reason) {
        console.log(chalk.red('╔════════════════════════════════════════╗'))
        console.log(chalk.red('║         KERNEL PANIC - SYSTEM HALT     ║'))
        console.log(chalk.red('╠════════════════════════════════════════╣'))
        console.log(chalk.red(`║ Reason: ${reason.padEnd(30)}║`))
        console.log(chalk.red('╚════════════════════════════════════════╝'))
        process.exit(1)
    }
}

// ═══════════════════════════════════════════════════════════════════
// ║                 KNIGHT OS - PROCESS MANAGER                     ║
// ═══════════════════════════════════════════════════════════════════

class ProcessManager {
    constructor(kernel) {
        this.kernel = kernel
        this.processes = new Map()
        this.processQueue = []
        this.scheduler = null
    }

    createProcess(name, type, handler, options = {}) {
        const pid = this.kernel.fork(0)
        const process = {
            pid,
            name,
            type, // 'daemon', 'service', 'app', 'system'
            status: 'created',
            priority: options.priority || 5,
            memory: 0,
            cpu: 0,
            createdAt: Date.now(),
            handler,
            parent: options.parent || null,
            children: []
        }
        this.processes.set(pid, process)
        this.kernel.processes.set(pid, process)
        return pid
    }

    startProcess(pid) {
        const proc = this.processes.get(pid)
        if (proc) {
            proc.status = 'running'
            proc.startedAt = Date.now()
            return true
        }
        return false
    }

    stopProcess(pid) {
        const proc = this.processes.get(pid)
        if (proc) {
            proc.status = 'stopped'
            proc.stoppedAt = Date.now()
            return true
        }
        return false
    }

    killProcess(pid) {
        return this.kernel.kill(pid)
    }

    listProcesses() {
        return Array.from(this.processes.values())
    }

    getProcess(pid) {
        return this.processes.get(pid)
    }

    getProcessByName(name) {
        for (const proc of this.processes.values()) {
            if (proc.name === name) return proc
        }
        return null
    }
}

// ═══════════════════════════════════════════════════════════════════
// ║                KNIGHT OS - VIRTUAL FILE SYSTEM                  ║
// ═══════════════════════════════════════════════════════════════════

class VirtualFileSystem {
    constructor() {
        this.root = {
            name: '/',
            type: 'directory',
            children: {},
            permissions: 'rwxr-xr-x',
            owner: 'root',
            created: Date.now()
        }
        this.currentPath = '/'
        this.mountPoints = new Map()
        this.initFileSystem()
    }

    initFileSystem() {
        // Create standard directories
        const standardDirs = [
            '/home', '/bin', '/etc', '/var', '/tmp', '/usr',
            '/usr/apps', '/usr/lib', '/var/log', '/etc/config',
            '/home/user', '/home/user/downloads', '/home/user/documents'
        ]
        
        standardDirs.forEach(dir => this.mkdir(dir))
        
        // Create system files
        this.writeFile('/etc/hostname', 'knight-os')
        this.writeFile('/etc/version', '1.0.0')
        this.writeFile('/etc/motd', 'Welcome to Knight OS!')
        this.writeFile('/var/log/system.log', `[${new Date().toISOString()}] System initialized\n`)
    }

    parsePath(pathStr) {
        if (pathStr.startsWith('/')) {
            return pathStr.split('/').filter(p => p)
        }
        const currentParts = this.currentPath.split('/').filter(p => p)
        const newParts = pathStr.split('/').filter(p => p)
        
        for (const part of newParts) {
            if (part === '..') {
                currentParts.pop()
            } else if (part !== '.') {
                currentParts.push(part)
            }
        }
        return currentParts
    }

    getNode(pathStr) {
        const parts = this.parsePath(pathStr)
        let current = this.root
        
        for (const part of parts) {
            if (current.type !== 'directory' || !current.children[part]) {
                return null
            }
            current = current.children[part]
        }
        return current
    }

    mkdir(pathStr) {
        const parts = this.parsePath(pathStr)
        let current = this.root
        
        for (const part of parts) {
            if (!current.children[part]) {
                current.children[part] = {
                    name: part,
                    type: 'directory',
                    children: {},
                    permissions: 'rwxr-xr-x',
                    owner: 'user',
                    created: Date.now()
                }
            }
            current = current.children[part]
        }
        return true
    }

    writeFile(pathStr, content) {
        const parts = this.parsePath(pathStr)
        const fileName = parts.pop()
        let current = this.root
        
        for (const part of parts) {
            if (!current.children[part]) {
                this.mkdir('/' + parts.slice(0, parts.indexOf(part) + 1).join('/'))
            }
            current = current.children[part]
        }
        
        current.children[fileName] = {
            name: fileName,
            type: 'file',
            content,
            size: content.length,
            permissions: 'rw-r--r--',
            owner: 'user',
            created: Date.now(),
            modified: Date.now()
        }
        return true
    }

    readFile(pathStr) {
        const node = this.getNode(pathStr)
        if (node && node.type === 'file') {
            return node.content
        }
        return null
    }

    deleteFile(pathStr) {
        const parts = this.parsePath(pathStr)
        const fileName = parts.pop()
        let current = this.root
        
        for (const part of parts) {
            if (!current.children[part]) return false
            current = current.children[part]
        }
        
        if (current.children[fileName]) {
            delete current.children[fileName]
            return true
        }
        return false
    }

    listDir(pathStr = this.currentPath) {
        const node = this.getNode(pathStr) || this.root
        if (node.type !== 'directory') return null
        return Object.keys(node.children).map(name => ({
            name,
            type: node.children[name].type,
            size: node.children[name].size || 0,
            permissions: node.children[name].permissions
        }))
    }

    cd(pathStr) {
        const node = this.getNode(pathStr)
        if (node && node.type === 'directory') {
            this.currentPath = '/' + this.parsePath(pathStr).join('/')
            return true
        }
        return false
    }

    pwd() {
        return this.currentPath || '/'
    }

    exists(pathStr) {
        return this.getNode(pathStr) !== null
    }

    getSize(pathStr) {
        const node = this.getNode(pathStr)
        if (!node) return 0
        if (node.type === 'file') return node.size || 0
        
        let totalSize = 0
        const calculateSize = (n) => {
            if (n.type === 'file') {
                totalSize += n.size || 0
            } else {
                Object.values(n.children).forEach(calculateSize)
            }
        }
        calculateSize(node)
        return totalSize
    }
}

// ═══════════════════════════════════════════════════════════════════
// ║                 KNIGHT OS - USER MANAGEMENT                     ║
// ═══════════════════════════════════════════════════════════════════

class UserManager {
    constructor(vfs) {
        this.vfs = vfs
        this.users = new Map()
        this.sessions = new Map()
        this.groups = new Map()
        this.initDefaultUsers()
    }

    initDefaultUsers() {
        this.createUser('root', { role: 'admin', home: '/root' })
        this.createUser('system', { role: 'system', home: '/system' })
        this.createGroup('admin', ['root'])
        this.createGroup('users', [])
    }

    createUser(jid, options = {}) {
        const userId = jid.replace('@s.whatsapp.net', '').replace('@g.us', '')
        const user = {
            id: userId,
            jid,
            role: options.role || 'user',
            home: options.home || `/home/${userId}`,
            created: Date.now(),
            lastLogin: null,
            settings: {
                theme: 'default',
                language: 'en',
                notifications: true
            },
            permissions: options.permissions || ['read', 'write', 'execute'],
            quota: options.quota || 104857600, // 100MB default
            usedSpace: 0
        }
        this.users.set(userId, user)
        this.vfs.mkdir(user.home)
        this.vfs.mkdir(`${user.home}/downloads`)
        this.vfs.mkdir(`${user.home}/documents`)
        this.vfs.mkdir(`${user.home}/.config`)
        return user
    }

    getUser(jid) {
        const userId = jid.replace('@s.whatsapp.net', '').replace('@g.us', '')
        return this.users.get(userId)
    }

    getOrCreateUser(jid) {
        let user = this.getUser(jid)
        if (!user) {
            user = this.createUser(jid)
        }
        return user
    }

    createSession(jid) {
        const user = this.getOrCreateUser(jid)
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const session = {
            id: sessionId,
            userId: user.id,
            jid,
            startTime: Date.now(),
            lastActivity: Date.now(),
            cwd: user.home,
            env: {
                USER: user.id,
                HOME: user.home,
                PATH: '/bin:/usr/bin',
                SHELL: '/bin/ksh'
            },
            history: []
        }
        this.sessions.set(jid, session)
        user.lastLogin = Date.now()
        return session
    }

    getSession(jid) {
        return this.sessions.get(jid)
    }

    getOrCreateSession(jid) {
        let session = this.getSession(jid)
        if (!session) {
            session = this.createSession(jid)
        }
        session.lastActivity = Date.now()
        return session
    }

    endSession(jid) {
        return this.sessions.delete(jid)
    }

    createGroup(name, members = []) {
        this.groups.set(name, { name, members, created: Date.now() })
    }

    isAdmin(jid) {
        const user = this.getUser(jid)
        return user && user.role === 'admin'
    }

    setAdmin(jid) {
        const user = this.getOrCreateUser(jid)
        user.role = 'admin'
        return user
    }
}

// ═══════════════════════════════════════════════════════════════════
// ║                  KNIGHT OS - APP MANAGER                        ║
// ═══════════════════════════════════════════════════════════════════

class AppManager {
    constructor(processManager, vfs) {
        this.processManager = processManager
        this.vfs = vfs
        this.installedApps = new Map()
        this.runningApps = new Map()
        this.appRegistry = new Map()
        this.initSystemApps()
    }

    initSystemApps() {
        // Register built-in system apps
        this.registerApp({
            id: 'terminal',
            name: 'Terminal',
            version: '1.0.0',
            type: 'system',
            icon: '💻',
            description: 'Command line interface',
            commands: ['help', 'clear', 'echo', 'whoami']
        })

        this.registerApp({
            id: 'filemanager',
            name: 'File Manager',
            version: '1.0.0',
            type: 'system',
            icon: '📁',
            description: 'Manage your files',
            commands: ['ls', 'cd', 'pwd', 'mkdir', 'rm', 'cat', 'touch']
        })

        this.registerApp({
            id: 'settings',
            name: 'Settings',
            version: '1.0.0',
            type: 'system',
            icon: '⚙️',
            description: 'System settings',
            commands: ['settings']
        })

        this.registerApp({
            id: 'taskmanager',
            name: 'Task Manager',
            version: '1.0.0',
            type: 'system',
            icon: '📊',
            description: 'View running processes',
            commands: ['ps', 'top', 'kill']
        })

        this.registerApp({
            id: 'appstore',
            name: 'App Store',
            version: '1.0.0',
            type: 'system',
            icon: '🏪',
            description: 'Install and manage apps',
            commands: ['store', 'install', 'uninstall']
        })
    }

    registerApp(appInfo) {
        this.appRegistry.set(appInfo.id, {
            ...appInfo,
            installed: true,
            installDate: Date.now()
        })
        this.installedApps.set(appInfo.id, appInfo)
    }

    installApp(appId, appData) {
        if (this.installedApps.has(appId)) {
            return { success: false, message: 'App already installed' }
        }
        
        const app = {
            ...appData,
            id: appId,
            installed: true,
            installDate: Date.now()
        }
        
        this.installedApps.set(appId, app)
        this.vfs.mkdir(`/usr/apps/${appId}`)
        this.vfs.writeFile(`/usr/apps/${appId}/manifest.json`, JSON.stringify(app, null, 2))
        
        return { success: true, message: `${app.name} installed successfully` }
    }

    uninstallApp(appId) {
        if (!this.installedApps.has(appId)) {
            return { success: false, message: 'App not found' }
        }
        
        const app = this.installedApps.get(appId)
        if (app.type === 'system') {
            return { success: false, message: 'Cannot uninstall system apps' }
        }
        
        this.installedApps.delete(appId)
        this.vfs.deleteFile(`/usr/apps/${appId}`)
        
        return { success: true, message: `${app.name} uninstalled` }
    }

    launchApp(appId, userJid) {
        const app = this.installedApps.get(appId)
        if (!app) {
            return { success: false, message: 'App not found' }
        }
        
        const pid = this.processManager.createProcess(app.name, 'app', null, {
            priority: 5
        })
        this.processManager.startProcess(pid)
        
        this.runningApps.set(`${userJid}_${appId}`, { pid, app, startTime: Date.now() })
        
        return { success: true, pid, app }
    }

    closeApp(appId, userJid) {
        const key = `${userJid}_${appId}`
        const running = this.runningApps.get(key)
        
        if (running) {
            this.processManager.killProcess(running.pid)
            this.runningApps.delete(key)
            return { success: true }
        }
        return { success: false, message: 'App not running' }
    }

    getInstalledApps() {
        return Array.from(this.installedApps.values())
    }

    getRunningApps(userJid) {
        const apps = []
        for (const [key, value] of this.runningApps) {
            if (key.startsWith(userJid)) {
                apps.push(value)
            }
        }
        return apps
    }
}

// ═══════════════════════════════════════════════════════════════════
// ║                  KNIGHT OS - SHELL INTERFACE                    ║
// ═══════════════════════════════════════════════════════════════════

class KnightShell {
    constructor(os) {
        this.os = os
        this.commands = new Map()
        this.aliases = new Map()
        this.initCommands()
    }

    initCommands() {
        // File system commands
        this.registerCommand('ls', this.cmd_ls.bind(this))
        this.registerCommand('cd', this.cmd_cd.bind(this))
        this.registerCommand('pwd', this.cmd_pwd.bind(this))
        this.registerCommand('mkdir', this.cmd_mkdir.bind(this))
        this.registerCommand('touch', this.cmd_touch.bind(this))
        this.registerCommand('cat', this.cmd_cat.bind(this))
        this.registerCommand('rm', this.cmd_rm.bind(this))
        this.registerCommand('cp', this.cmd_cp.bind(this))
        this.registerCommand('mv', this.cmd_mv.bind(this))

        // System commands
        this.registerCommand('help', this.cmd_help.bind(this))
        this.registerCommand('whoami', this.cmd_whoami.bind(this))
        this.registerCommand('clear', this.cmd_clear.bind(this))
        this.registerCommand('echo', this.cmd_echo.bind(this))
        this.registerCommand('date', this.cmd_date.bind(this))
        this.registerCommand('uptime', this.cmd_uptime.bind(this))
        this.registerCommand('neofetch', this.cmd_neofetch.bind(this))
        this.registerCommand('sysinfo', this.cmd_sysinfo.bind(this))

        // Process commands
        this.registerCommand('ps', this.cmd_ps.bind(this))
        this.registerCommand('top', this.cmd_top.bind(this))
        this.registerCommand('kill', this.cmd_kill.bind(this))

        // App commands
        this.registerCommand('apps', this.cmd_apps.bind(this))
        this.registerCommand('launch', this.cmd_launch.bind(this))
        this.registerCommand('store', this.cmd_store.bind(this))
        this.registerCommand('install', this.cmd_install.bind(this))

        // User commands
        this.registerCommand('settings', this.cmd_settings.bind(this))
        this.registerCommand('logout', this.cmd_logout.bind(this))
        this.registerCommand('reboot', this.cmd_reboot.bind(this))
        this.registerCommand('shutdown', this.cmd_shutdown.bind(this))

        // Set aliases
        this.aliases.set('dir', 'ls')
        this.aliases.set('cls', 'clear')
        this.aliases.set('info', 'sysinfo')
    }

    registerCommand(name, handler) {
        this.commands.set(name, handler)
    }

    async execute(input, session) {
        const parts = input.trim().split(/\s+/)
        let command = parts[0].toLowerCase()
        const args = parts.slice(1)

        // Check for aliases
        if (this.aliases.has(command)) {
            command = this.aliases.get(command)
        }

        // Add to history
        session.history.push({ command: input, time: Date.now() })

        const handler = this.commands.get(command)
        if (handler) {
            return await handler(args, session)
        }
        
        return `ksh: ${command}: command not found\nType 'help' for available commands`
    }

    // ═══════════════ FILE SYSTEM COMMANDS ═══════════════

    cmd_ls(args, session) {
        const path = args[0] || session.cwd
        const items = this.os.vfs.listDir(path)
        
        if (!items) return `ls: cannot access '${path}': No such directory`
        if (items.length === 0) return '(empty directory)'

        let output = `📂 Contents of ${path}\n${'─'.repeat(40)}\n`
        items.forEach(item => {
            const icon = item.type === 'directory' ? '📁' : '📄'
            const size = item.type === 'file' ? ` (${item.size}B)` : ''
            output += `${icon} ${item.name}${size}\n`
        })
        return output
    }

    cmd_cd(args, session) {
        if (!args[0]) {
            const user = this.os.userManager.getUser(session.jid)
            session.cwd = user.home
            return `Changed to home directory: ${session.cwd}`
        }
        
        let targetPath = args[0]
        if (!targetPath.startsWith('/')) {
            targetPath = `${session.cwd}/${targetPath}`
        }
        
        if (this.os.vfs.cd(targetPath)) {
            session.cwd = this.os.vfs.pwd()
            return `📂 ${session.cwd}`
        }
        return `cd: ${args[0]}: No such directory`
    }

    cmd_pwd(args, session) {
        return `📂 ${session.cwd}`
    }

    cmd_mkdir(args, session) {
        if (!args[0]) return 'Usage: mkdir <directory_name>'
        
        let path = args[0]
        if (!path.startsWith('/')) {
            path = `${session.cwd}/${path}`
        }
        
        this.os.vfs.mkdir(path)
        return `📁 Created directory: ${path}`
    }

    cmd_touch(args, session) {
        if (!args[0]) return 'Usage: touch <filename>'
        
        let path = args[0]
        if (!path.startsWith('/')) {
            path = `${session.cwd}/${path}`
        }
        
        this.os.vfs.writeFile(path, '')
        return `📄 Created file: ${path}`
    }

    cmd_cat(args, session) {
        if (!args[0]) return 'Usage: cat <filename>'
        
        let path = args[0]
        if (!path.startsWith('/')) {
            path = `${session.cwd}/${path}`
        }
        
        const content = this.os.vfs.readFile(path)
        if (content === null) return `cat: ${args[0]}: No such file`
        return content || '(empty file)'
    }

    cmd_rm(args, session) {
        if (!args[0]) return 'Usage: rm <filename>'
        
        let path = args[0]
        if (!path.startsWith('/')) {
            path = `${session.cwd}/${path}`
        }
        
        if (this.os.vfs.deleteFile(path)) {
            return `🗑️ Deleted: ${path}`
        }
        return `rm: ${args[0]}: No such file or directory`
    }

    cmd_cp(args, session) {
        if (args.length < 2) return 'Usage: cp <source> <destination>'
        
        let src = args[0], dest = args[1]
        if (!src.startsWith('/')) src = `${session.cwd}/${src}`
        if (!dest.startsWith('/')) dest = `${session.cwd}/${dest}`
        
        const content = this.os.vfs.readFile(src)
        if (content === null) return `cp: ${args[0]}: No such file`
        
        this.os.vfs.writeFile(dest, content)
        return `📋 Copied ${args[0]} to ${args[1]}`
    }

    cmd_mv(args, session) {
        if (args.length < 2) return 'Usage: mv <source> <destination>'
        
        let src = args[0], dest = args[1]
        if (!src.startsWith('/')) src = `${session.cwd}/${src}`
        if (!dest.startsWith('/')) dest = `${session.cwd}/${dest}`
        
        const content = this.os.vfs.readFile(src)
        if (content === null) return `mv: ${args[0]}: No such file`
        
        this.os.vfs.writeFile(dest, content)
        this.os.vfs.deleteFile(src)
        return `📦 Moved ${args[0]} to ${args[1]}`
    }

    // ═══════════════ SYSTEM COMMANDS ═══════════════

    cmd_help(args, session) {
        return `
╔══════════════════════════════════════════════════╗
║           🏰 KNIGHT OS - HELP MENU 🏰           ║
╠══════════════════════════════════════════════════╣
║  📁 FILE SYSTEM                                  ║
║  ├─ ls [path]     - List directory contents      ║
║  ├─ cd <path>     - Change directory             ║
║  ├─ pwd           - Print working directory      ║
║  ├─ mkdir <name>  - Create directory             ║
║  ├─ touch <file>  - Create empty file            ║
║  ├─ cat <file>    - Display file contents        ║
║  ├─ rm <file>     - Remove file                  ║
║  ├─ cp <src><dst> - Copy file                    ║
║  └─ mv <src><dst> - Move file                    ║
║                                                  ║
║  💻 SYSTEM                                       ║
║  ├─ help          - Show this help               ║
║  ├─ whoami        - Display current user         ║
║  ├─ clear         - Clear screen                 ║
║  ├─ echo <text>   - Print text                   ║
║  ├─ date          - Show current date            ║
║  ├─ uptime        - Show system uptime           ║
║  ├─ neofetch      - System information           ║
║  └─ sysinfo       - Detailed system info         ║
║                                                  ║
║  📊 PROCESSES                                    ║
║  ├─ ps            - List processes               ║
║  ├─ top           - Process monitor              ║
║  └─ kill <pid>    - Terminate process            ║
║                                                  ║
║  📱 APPS                                         ║
║  ├─ apps          - List installed apps          ║
║  ├─ launch <app>  - Launch application           ║
║  ├─ store         - Open app store               ║
║  └─ install <app> - Install application          ║
║                                                  ║
║  ⚙️ OTHER                                        ║
║  ├─ settings      - User settings                ║
║  ├─ logout        - End session                  ║
║  ├─ reboot        - Restart system               ║
║  └─ shutdown      - Power off                    ║
║                                                  ║
║  💡 Use bot commands with . or ! prefix          ║
╚══════════════════════════════════════════════════╝`
    }

    cmd_whoami(args, session) {
        const user = this.os.userManager.getUser(session.jid)
        return `👤 ${user.id}\n📍 Role: ${user.role}\n🏠 Home: ${user.home}`
    }

    cmd_clear(args, session) {
        return '🧹 Screen cleared\n\n\n\n\n'
    }

    cmd_echo(args, session) {
        return args.join(' ') || ''
    }

    cmd_date(args, session) {
        return `📅 ${new Date().toLocaleString()}`
    }

    cmd_uptime(args, session) {
        const uptime = this.os.kernel.getUptime()
        const hours = Math.floor(uptime / 3600000)
        const minutes = Math.floor((uptime % 3600000) / 60000)
        const seconds = Math.floor((uptime % 60000) / 1000)
        return `⏱️ System uptime: ${hours}h ${minutes}m ${seconds}s`
    }

    cmd_neofetch(args, session) {
        const user = this.os.userManager.getUser(session.jid)
        const uptime = this.os.kernel.getUptime()
        const hours = Math.floor(uptime / 3600000)
        const minutes = Math.floor((uptime % 3600000) / 60000)
        const memUsage = process.memoryUsage()
        
        return `
    ██╗  ██╗███╗   ██╗██╗ ██████╗ ██╗  ██╗████████╗
    ██║ ██╔╝████╗  ██║██║██╔════╝ ██║  ██║╚══██╔══╝
    █████╔╝ ██╔██╗ ██║██║██║  ███╗███████║   ██║   
    ██╔═██╗ ██║╚██╗██║██║██║   ██║██╔══██║   ██║   
    ██║  ██╗██║ ╚████║██║╚██████╔╝██║  ██║   ██║   
    ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   
    ═══════════════════════════════════════════════
    👤 User      : ${user.id}
    🏠 Home      : ${user.home}
    💻 OS        : Knight OS v${this.os.kernel.version}
    🏷️ Codename  : ${this.os.kernel.codename}
    ⏱️ Uptime    : ${hours}h ${minutes}m
    💾 Memory    : ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB
    📱 Shell     : Knight Shell (ksh)
    📦 Apps      : ${this.os.appManager.getInstalledApps().length} installed
    ═══════════════════════════════════════════════`
    }

    cmd_sysinfo(args, session) {
        const memUsage = process.memoryUsage()
        const cpuUsage = process.cpuUsage()
        
        return `
╔════════════════════════════════════════════════════╗
║              🖥️ SYSTEM INFORMATION                 ║
╠════════════════════════════════════════════════════╣
║  OS Version   : Knight OS v${this.os.kernel.version.padEnd(20)}║
║  Codename     : ${this.os.kernel.codename.padEnd(29)}║
║  Node.js      : ${process.version.padEnd(29)}║
║  Platform     : ${process.platform.padEnd(29)}║
║  Architecture : ${process.arch.padEnd(29)}║
╠════════════════════════════════════════════════════╣
║  📊 MEMORY USAGE                                   ║
║  Heap Used    : ${(memUsage.heapUsed / 1024 / 1024).toFixed(2).padEnd(6)}MB                       ║
║  Heap Total   : ${(memUsage.heapTotal / 1024 / 1024).toFixed(2).padEnd(6)}MB                       ║
║  RSS          : ${(memUsage.rss / 1024 / 1024).toFixed(2).padEnd(6)}MB                       ║
║  External     : ${(memUsage.external / 1024 / 1024).toFixed(2).padEnd(6)}MB                       ║
╠════════════════════════════════════════════════════╣
║  📦 PROCESSES : ${String(this.os.processManager.processes.size).padEnd(29)}║
║  👥 USERS     : ${String(this.os.userManager.users.size).padEnd(29)}║
║  📱 APPS      : ${String(this.os.appManager.installedApps.size).padEnd(29)}║
╚════════════════════════════════════════════════════╝`
    }

    // ═══════════════ PROCESS COMMANDS ═══════════════

    cmd_ps(args, session) {
        const processes = this.os.processManager.listProcesses()
        
        if (processes.length === 0) return 'No processes running'
        
        let output = `
╔════════════════════════════════════════════════════════╗
║                  📊 PROCESS LIST                       ║
╠════════╦══════════════════╦══════════╦═════════════════╣
║  PID   ║       NAME       ║  STATUS  ║      TYPE       ║
╠════════╬══════════════════╬══════════╬═════════════════╣`
        
        processes.forEach(proc => {
            const pid = String(proc.pid).padEnd(6)
            const name = proc.name.substring(0, 16).padEnd(16)
            const status = proc.status.padEnd(8)
            const type = proc.type.padEnd(15)
            output += `\n║ ${pid} ║ ${name} ║ ${status} ║ ${type} ║`
        })
        
        output += '\n╚════════╩══════════════════╩══════════╩═════════════════╝'
        return output
    }

    cmd_top(args, session) {
        const processes = this.os.processManager.listProcesses()
        const memUsage = process.memoryUsage()
        
        return `
╔═══════════════════════════════════════════════════════════╗
║               📊 KNIGHT OS - TASK MANAGER                 ║
╠═══════════════════════════════════════════════════════════╣
║  CPU: [████████░░░░░░░░░░░░] 40%    MEM: ${Math.round(memUsage.heapUsed / memUsage.heapTotal * 100)}%            ║
║  Tasks: ${processes.length} total, ${processes.filter(p => p.status === 'running').length} running                           ║
╠═══════════════════════════════════════════════════════════╣
║  PID    NAME              CPU%    MEM%    STATUS          ║
╠═══════════════════════════════════════════════════════════╣
${processes.slice(0, 10).map(p => 
`║  ${String(p.pid).padEnd(6)} ${p.name.substring(0, 16).padEnd(16)} ${String(Math.random() * 10).substring(0, 4).padEnd(7)} ${String(Math.random() * 5).substring(0, 4).padEnd(7)} ${p.status.padEnd(15)}║`
).join('\n')}
╚═══════════════════════════════════════════════════════════╝`
    }

    cmd_kill(args, session) {
        if (!args[0]) return 'Usage: kill <pid>'
        
        const pid = parseInt(args[0])
        if (isNaN(pid)) return 'Invalid PID'
        
        if (this.os.processManager.killProcess(pid)) {
            return `💀 Process ${pid} terminated`
        }
        return `kill: (${pid}) - No such process`
    }

    // ═══════════════ APP COMMANDS ═══════════════

    cmd_apps(args, session) {
        const apps = this.os.appManager.getInstalledApps()
        
        let output = `
╔════════════════════════════════════════════════════╗
║             📱 INSTALLED APPLICATIONS              ║
╠════════════════════════════════════════════════════╣`
        
        apps.forEach(app => {
            output += `\n║ ${app.icon} ${app.name.padEnd(15)} v${app.version.padEnd(8)} [${app.type}]`.padEnd(53) + '║'
            output += `\n║   ${app.description.substring(0, 45).padEnd(48)}║`
        })
        
        output += '\n╚════════════════════════════════════════════════════╝'
        return output
    }

    cmd_launch(args, session) {
        if (!args[0]) return 'Usage: launch <app_id>'
        
        const result = this.os.appManager.launchApp(args[0], session.jid)
        if (result.success) {
            return `🚀 Launching ${result.app.icon} ${result.app.name} (PID: ${result.pid})`
        }
        return `❌ ${result.message}`
    }

    cmd_store(args, session) {
        return `
╔════════════════════════════════════════════════════╗
║              🏪 KNIGHT APP STORE                   ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║  📦 Featured Apps:                                 ║
║  ├─ 🎵 MusicPlayer  - Play your favorite tunes     ║
║  ├─ 🎮 Games        - Mini games collection        ║
║  ├─ 📝 Notes        - Quick note taking            ║
║  ├─ 🔐 Vault        - Secure file storage          ║
║  └─ 📊 Analytics    - Usage statistics             ║
║                                                    ║
║  💡 Use: install <app_id> to install               ║
║                                                    ║
╚════════════════════════════════════════════════════╝`
    }

    cmd_install(args, session) {
        if (!args[0]) return 'Usage: install <app_id>'
        return `📦 Installing ${args[0]}...\n✅ Installation complete!`
    }

    // ═══════════════ OTHER COMMANDS ═══════════════

    cmd_settings(args, session) {
        const user = this.os.userManager.getUser(session.jid)
        
        if (args[0] && args[1]) {
            // Set a setting
            if (user.settings.hasOwnProperty(args[0])) {
                user.settings[args[0]] = args[1]
                return `✅ Setting '${args[0]}' updated to '${args[1]}'`
            }
            return `❌ Unknown setting: ${args[0]}`
        }
        
        return `
╔════════════════════════════════════════════════════╗
║                 ⚙️ USER SETTINGS                   ║
╠════════════════════════════════════════════════════╣
║  Theme         : ${user.settings.theme.padEnd(28)}║
║  Language      : ${user.settings.language.padEnd(28)}║
║  Notifications : ${String(user.settings.notifications).padEnd(28)}║
╠════════════════════════════════════════════════════╣
║  Usage: settings <key> <value>                     ║
╚════════════════════════════════════════════════════╝`
    }

    cmd_logout(args, session) {
        this.os.userManager.endSession(session.jid)
        return `👋 Session ended. Goodbye!\n\n🔐 Type any message to start a new session.`
    }

    cmd_reboot(args, session) {
        return `
🔄 System reboot initiated...
   Saving session data...
   Stopping services...
   
⚡ Knight OS is restarting...

✅ System ready!
`
    }

    cmd_shutdown(args, session) {
        return `
🔌 System shutdown initiated...

   ███████╗██╗  ██╗██╗   ██╗████████╗██████╗  ██████╗ ██╗    ██╗███╗   ██╗
   ██╔════╝██║  ██║██║   ██║╚══██╔══╝██╔══██╗██╔═══██╗██║    ██║████╗  ██║
   ███████╗███████║██║   ██║   ██║   ██║  ██║██║   ██║██║ █╗ ██║██╔██╗ ██║
   ╚════██║██╔══██║██║   ██║   ██║   ██║  ██║██║   ██║██║███╗██║██║╚██╗██║
   ███████║██║  ██║╚██████╔╝   ██║   ██████╔╝╚██████╔╝╚███╔███╔╝██║ ╚████║
   ╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═════╝  ╚═════╝  ╚══╝╚══╝ ╚═╝  ╚═══╝

💤 It is now safe to close WhatsApp.
`
    }
}

// ═══════════════════════════════════════════════════════════════════
// ║                  KNIGHT OS - MAIN CLASS                         ║
// ═══════════════════════════════════════════════════════════════════

class KnightOS {
    constructor() {
        this.kernel = new KnightKernel()
        this.processManager = new ProcessManager(this.kernel)
        this.vfs = new VirtualFileSystem()
        this.userManager = new UserManager(this.vfs)
        this.appManager = new AppManager(this.processManager, this.vfs)
        this.shell = new KnightShell(this)
        this.booted = false
    }

    boot() {
        console.log(chalk.green(`
    ╔═══════════════════════════════════════════════════════════════════════╗
    ║                                                                       ║
    ║   ██╗  ██╗███╗   ██╗██╗ ██████╗ ██╗  ██╗████████╗     ██████╗ ███████╗║
    ║   ██║ ██╔╝████╗  ██║██║██╔════╝ ██║  ██║╚══██╔══╝    ██╔═══██╗██╔════╝║
    ║   █████╔╝ ██╔██╗ ██║██║██║  ███╗███████║   ██║       ██║   ██║███████╗║
    ║   ██╔═██╗ ██║╚██╗██║██║██║   ██║██╔══██║   ██║       ██║   ██║╚════██║║
    ║   ██║  ██╗██║ ╚████║██║╚██████╔╝██║  ██║   ██║       ╚██████╔╝███████║║
    ║   ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝        ╚═════╝ ╚══════╝║
    ║                                                                       ║
    ║                    WhatsApp Operating System v1.0                     ║
    ╚═══════════════════════════════════════════════════════════════════════╝
        `))

        this.kernel.boot()
        
        // Create system processes
        this.processManager.createProcess('init', 'system', null, { priority: 1 })
        this.processManager.createProcess('kernel', 'system', null, { priority: 1 })
        this.processManager.createProcess('scheduler', 'daemon', null, { priority: 2 })
        this.processManager.createProcess('vfs', 'service', null, { priority: 3 })
        this.processManager.createProcess('usermgr', 'service', null, { priority: 3 })
        this.processManager.createProcess('appmgr', 'service', null, { priority: 4 })
        this.processManager.createProcess('shell', 'service', null, { priority: 5 })

        // Start all processes
        for (const [pid] of this.processManager.processes) {
            this.processManager.startProcess(pid)
        }

        console.log(chalk.green('✅ Knight OS booted successfully!'))
        this.booted = true
        return true
    }

    async handleCommand(input, jid) {
        // Get or create user session
        const session = this.userManager.getOrCreateSession(jid)
        
        // Check if it's a shell command (starts with $ or is a known command)
        const trimmedInput = input.trim()
        
        if (trimmedInput.startsWith('$')) {
            // Execute shell command
            return await this.shell.execute(trimmedInput.substring(1).trim(), session)
        }
        
        // Check if it's a known shell command
        const firstWord = trimmedInput.split(/\s+/)[0].toLowerCase()
        if (this.shell.commands.has(firstWord) || this.shell.aliases.has(firstWord)) {
            return await this.shell.execute(trimmedInput, session)
        }
        
        // Not an OS command, return null to let the bot handle it
        return null
    }

    getWelcomeMessage(jid) {
        const user = this.userManager.getOrCreateUser(jid)
        const session = this.userManager.createSession(jid)
        
        return `
╔═══════════════════════════════════════════════════════════╗
║                    🏰 KNIGHT OS v1.0 🏰                   ║
║                   WhatsApp Operating System               ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  👋 Welcome, ${user.id.substring(0, 20).padEnd(20)}                  ║
║                                                           ║
║  🖥️  Terminal ready                                       ║
║  📁 Home: ${user.home.padEnd(35)}        ║
║  ⏰ ${new Date().toLocaleString().padEnd(40)}    ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║  Quick Commands:                                          ║
║  • help     - Show all commands                           ║
║  • neofetch - System info                                 ║
║  • apps     - List applications                           ║
║  • ls       - List files                                  ║
║                                                           ║
║  💡 Tip: Use $ prefix for shell commands                  ║
║  💡 Bot commands still work with . or ! prefix            ║
╚═══════════════════════════════════════════════════════════╝
${user.id}@knight-os:${session.cwd}$ _`
    }
}

// ═══════════════════════════════════════════════════════════════════
// ║              ORIGINAL KNIGHT BOT CODE (PRESERVED)               ║
// ═══════════════════════════════════════════════════════════════════

// Initialize store
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000)

// Memory monitoring - Restart if RAM gets too high
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.log('⚠️ RAM too high (>400MB), restarting bot...')
        process.exit(1)
    }
}, 30_000)

let phoneNumber = "911234567890"
let owner = JSON.parse(fs.readFileSync('./data/owner.json'))

global.botname = "KNIGHT OS"
global.themeemoji = "•"
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        return Promise.resolve(settings.ownerNumber || phoneNumber)
    }
}

// Initialize Knight OS
const knightOS = new KnightOS()

async function startXeonBotInc() {
    try {
        // Boot the OS first
        if (!knightOS.booted) {
            knightOS.boot()
        }

        let { version, isLatest } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        const msgRetryCounterCache = new NodeCache()

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ["Knight OS", "Chrome", "1.0.0"],
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

        // Attach OS to bot instance
        XeonBotInc.knightOS = knightOS

        XeonBotInc.ev.on('creds.update', saveCreds)
        store.bind(XeonBotInc.ev)

        // Enhanced message handling with OS integration
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages[0]
                if (!mek.message) return
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
                
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    await handleStatus(XeonBotInc, chatUpdate);
                    return;
                }
                
                if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                    if (!isGroup) return
                }
                
                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

                if (XeonBotInc?.msgRetryCounterCache) {
                    XeonBotInc.msgRetryCounterCache.clear()
                }

                // Extract message text
                const messageType = Object.keys(mek.message)[0]
                let messageText = ''
                
                if (messageType === 'conversation') {
                    messageText = mek.message.conversation
                } else if (messageType === 'extendedTextMessage') {
                    messageText = mek.message.extendedTextMessage.text
                }

                // Check for OS commands first
                if (messageText && !messageText.startsWith('.') && !messageText.startsWith('!')) {
                    const osResponse = await knightOS.handleCommand(messageText, mek.key.remoteJid)
                    
                    if (osResponse !== null) {
                        // Send OS response
                        await XeonBotInc.sendMessage(mek.key.remoteJid, {
                            text: osResponse,
                            contextInfo: {
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: '120363161513685998@newsletter',
                                    newsletterName: 'Knight OS',
                                    serverMessageId: -1
                                }
                            }
                        })
                        return
                    }
                }

                // Handle boot/start command for new users
                if (messageText && (messageText.toLowerCase() === 'boot' || messageText.toLowerCase() === 'start' || messageText.toLowerCase() === 'os')) {
                    const welcomeMsg = knightOS.getWelcomeMessage(mek.key.remoteJid)
                    await XeonBotInc.sendMessage(mek.key.remoteJid, {
                        text: welcomeMsg,
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363161513685998@newsletter',
                                newsletterName: 'Knight OS',
                                serverMessageId: -1
                            }
                        }
                    })
                    return
                }

                // Fall through to original bot handlers
                try {
                    await handleMessages(XeonBotInc, chatUpdate, true)
                } catch (err) {
                    console.error("Error in handleMessages:", err)
                    if (mek.key && mek.key.remoteJid) {
                        await XeonBotInc.sendMessage(mek.key.remoteJid, {
                            text: '❌ Knight OS: An error occurred while processing your command.',
                            contextInfo: {
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: '120363161513685998@newsletter',
                                    newsletterName: 'Knight OS',
                                    serverMessageId: -1
                                }
                            }
                        }).catch(console.error);
                    }
                }
            } catch (err) {
                console.error("Error in messages.upsert:", err)
            }
        })

        // Original event handlers preserved
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
            id = XeonBotInc.decodeJid(jid)
            withoutContact = XeonBotInc.withoutContact || withoutContact
            let v
            if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
                v = store.contacts[id] || {}
                if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
                resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
            })
            else v = id === '0@s.whatsapp.net' ? {
                id,
                name: 'WhatsApp'
            } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
                XeonBotInc.user :
                (store.contacts[id] || {})
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
        }

        XeonBotInc.public = true
        XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

        // Pairing code handling (preserved)
        if (pairingCode && !XeonBotInc.authState.creds.registered) {
            if (useMobile) throw new Error('Cannot use pairing code with mobile api')

            let phoneNumber
            if (!!global.phoneNumber) {
                phoneNumber = global.phoneNumber
            } else {
                phoneNumber = await question(chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number 😍\nFormat: 6281376552730 (without + or spaces) : `)))
            }

            phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

            const pn = require('awesome-phonenumber');
            if (!pn('+' + phoneNumber).isValid()) {
                console.log(chalk.red('Invalid phone number. Please enter your full international number.'));
                process.exit(1);
            }

            setTimeout(async () => {
                try {
                    let code = await XeonBotInc.requestPairingCode(phoneNumber)
                    code = code?.match(/.{1,4}/g)?.join("-") || code
                    console.log(chalk.black(chalk.bgGreen(`Your Pairing Code : `)), chalk.black(chalk.white(code)))
                    console.log(chalk.yellow(`\nPlease enter this code in your WhatsApp app:\n1. Open WhatsApp\n2. Go to Settings > Linked Devices\n3. Tap "Link a Device"\n4. Enter the code shown above`))
                } catch (error) {
                    console.error('Error requesting pairing code:', error)
                    console.log(chalk.red('Failed to get pairing code. Please check your phone number and try again.'))
                }
            }, 3000)
        }

        // Connection handling with OS branding
        XeonBotInc.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect, qr } = s
            
            if (qr) {
                console.log(chalk.yellow('📱 QR Code generated. Please scan with WhatsApp.'))
            }
            
            if (connection === 'connecting') {
                console.log(chalk.yellow('🔄 Knight OS connecting to WhatsApp servers...'))
            }
            
            if (connection == "open") {
                console.log(chalk.magenta(` `))
                console.log(chalk.yellow(`🌿 Knight OS Connected => ` + JSON.stringify(XeonBotInc.user, null, 2)))

                try {
                    const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
                    await XeonBotInc.sendMessage(botNumber, {
                        text: `🏰 Knight OS Connected Successfully!\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: System Online\n📊 Processes: ${knightOS.processManager.processes.size} running\n\n💡 Type 'boot' or 'os' to start\n\n✅ Make sure to join below channel`,
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363161513685998@newsletter',
                                newsletterName: 'Knight OS',
                                serverMessageId: -1
                            }
                        }
                    });
                } catch (error) {
                    console.error('Error sending connection message:', error.message)
                }

                await delay(1999)
                console.log(chalk.yellow(`\n\n                  ${chalk.bold.blue(`[ KNIGHT OS ]`)}\n\n`))
                console.log(chalk.cyan(`< ================================================== >`))
                console.log(chalk.magenta(`\n${global.themeemoji || '•'} YT CHANNEL: MR UNIQUE HACKER`))
                console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: mrunqiuehacker`))
                console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`))
                console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: MR UNIQUE HACKER`))
                console.log(chalk.green(`${global.themeemoji || '•'} 🏰 Knight OS Online! ✅`))
                console.log(chalk.blue(`OS Version: ${knightOS.kernel.version} (${knightOS.kernel.codename})`))
            }
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
                const statusCode = lastDisconnect?.error?.output?.statusCode
                
                console.log(chalk.red(`Knight OS connection closed: ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`))
                
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    try {
                        rmSync('./session', { recursive: true, force: true })
                        console.log(chalk.yellow('Session folder deleted. Please re-authenticate.'))
                    } catch (error) {
                        console.error('Error deleting session:', error)
                    }
                    console.log(chalk.red('Session logged out. Please re-authenticate.'))
                }
                
                if (shouldReconnect) {
                    console.log(chalk.yellow('🔄 Knight OS rebooting...'))
                    await delay(5000)
                    startXeonBotInc()
                }
            }
        })

        // Anti-call handler (preserved)
        const antiCallNotified = new Set();

        XeonBotInc.ev.on('call', async (calls) => {
            try {
                const { readState: readAnticallState } = require('./commands/anticall');
                const state = readAnticallState();
                if (!state.enabled) return;
                for (const call of calls) {
                    const callerJid = call.from || call.peerJid || call.chatId;
                    if (!callerJid) continue;
                    try {
                        try {
                            if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
                                await XeonBotInc.rejectCall(call.id, callerJid);
                            } else if (typeof XeonBotInc.sendCallOfferAck === 'function' && call.id) {
                                await XeonBotInc.sendCallOfferAck(call.id, callerJid, 'reject');
                            }
                        } catch {}

                        if (!antiCallNotified.has(callerJid)) {
                            antiCallNotified.add(callerJid);
                            setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                            await XeonBotInc.sendMessage(callerJid, { text: '📵 Knight OS: Calls are disabled. Your call was rejected.' });
                        }
                    } catch {}
                    setTimeout(async () => {
                        try { await XeonBotInc.updateBlockStatus(callerJid, 'block'); } catch {}
                    }, 800);
                }
            } catch (e) {}
        });

        XeonBotInc.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(XeonBotInc, update);
        });

        XeonBotInc.ev.on('messages.upsert', async (m) => {
            if (m.messages[0].key && m.messages[0].key.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, m);
            }
        });

        XeonBotInc.ev.on('status.update', async (status) => {
            await handleStatus(XeonBotInc, status);
        });

        XeonBotInc.ev.on('messages.reaction', async (status) => {
            await handleStatus(XeonBotInc, status);
        });

        return XeonBotInc
    } catch (error) {
        console.error('Knight OS Error:', error)
        await delay(5000)
        startXeonBotInc()
    }
}

// Start Knight OS
startXeonBotInc().catch(error => {
    console.error('Knight OS Fatal error:', error)
    process.exit(1)
})

process.on('uncaughtException', (err) => {
    console.error('Knight OS Uncaught Exception:', err)
})

process.on('unhandledRejection', (err) => {
    console.error('Knight OS Unhandled Rejection:', err)
})

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Knight OS: Hot reload triggered - ${__filename}`))
    delete require.cache[file]
    require(file)
})

// Export OS instance for external access
module.exports = { knightOS }
