/**
 * Knight Bot - A WhatsApp Bot with Web Interface
 * Copyright (c) 2024 Professor
 * 
 * VPS Hosting Ready - Access via your VPS IP
 */

require('./settings')
const express = require('express')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const path = require('path')
const axios = require('axios')
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
const { rmSync } = require('fs')

// Import lightweight store
const store = require('./lib/lightweight_store')
const settings = require('./settings')

// ============================================
// VPS CONFIGURATION - EDIT THESE VALUES
// ============================================
const CONFIG = {
    PORT: process.env.PORT || 3000,           // Port to run on (use 80 for direct IP access)
    HOST: '0.0.0.0',                           // Listen on all interfaces (required for VPS)
    VPS_IP: process.env.VPS_IP || '172.31.38.194',  // Your VPS IP for display purposes
    USE_HTTPS: false,                          // Set to true if using SSL
    DOMAIN: process.env.DOMAIN || 'netivosolutions.top',          // Optional: your domain name
};
// ============================================

// Initialize store
store.readFromFile()
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000)

// Memory monitoring
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.log('⚠️ RAM too high (>400MB), restarting bot...')
        process.exit(1)
    }
}, 30_000)

// Express app setup
const app = express()

// Trust proxy (important for VPS behind reverse proxy)
app.set('trust proxy', true)

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))

// CORS middleware for API access
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200)
    }
    next()
})

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString()
    console.log(chalk.gray(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`))
    next()
})

// Global state
let globalQR = null
let globalPairingCode = null
let connectionStatus = 'disconnected'
let connectedNumber = null
let XeonBotInc = null
let botStartTime = Date.now()

// Owner data
let owner = []
try {
    owner = JSON.parse(fs.readFileSync('./data/owner.json'))
} catch (e) {
    console.log(chalk.yellow('Owner file not found, using default'))
}

global.botname = settings.botname || "KNIGHT BOT"
global.themeemoji = "•"

// Get server URL
const getServerURL = (req) => {
    if (CONFIG.DOMAIN) {
        return `${CONFIG.USE_HTTPS ? 'https' : 'http'}://${CONFIG.DOMAIN}`
    }
    const host = req?.headers?.host || `${CONFIG.VPS_IP}:${CONFIG.PORT}`
    return `${CONFIG.USE_HTTPS ? 'https' : 'http'}://${host}`
}

// Calculate uptime
const getUptime = () => {
    const uptime = Date.now() - botStartTime
    const seconds = Math.floor(uptime / 1000) % 60
    const minutes = Math.floor(uptime / (1000 * 60)) % 60
    const hours = Math.floor(uptime / (1000 * 60 * 60)) % 24
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24))
    return `${days}d ${hours}h ${minutes}m ${seconds}s`
}

// HTML Template
const getHTML = (req) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Knight Bot MD - WhatsApp Bot</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="icon" type="image/png" href="https://i.ibb.co/4pDNDk1/knight-bot.png">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0d1b2a 100%);
            min-height: 100vh;
            color: #fff;
            overflow-x: hidden;
        }

        /* Animated Background */
        .bg-animation {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            overflow: hidden;
        }

        .bg-animation span {
            position: absolute;
            display: block;
            width: 20px;
            height: 20px;
            background: rgba(0, 212, 255, 0.1);
            animation: move 25s linear infinite;
            bottom: -150px;
            border-radius: 50%;
        }

        .bg-animation span:nth-child(1) { left: 25%; animation-delay: 0s; }
        .bg-animation span:nth-child(2) { left: 10%; animation-delay: 2s; width: 40px; height: 40px; }
        .bg-animation span:nth-child(3) { left: 70%; animation-delay: 4s; }
        .bg-animation span:nth-child(4) { left: 40%; animation-delay: 0s; width: 30px; height: 30px; }
        .bg-animation span:nth-child(5) { left: 65%; animation-delay: 0s; }
        .bg-animation span:nth-child(6) { left: 75%; animation-delay: 3s; width: 50px; height: 50px; }
        .bg-animation span:nth-child(7) { left: 35%; animation-delay: 7s; }
        .bg-animation span:nth-child(8) { left: 50%; animation-delay: 15s; width: 25px; height: 25px; }
        .bg-animation span:nth-child(9) { left: 20%; animation-delay: 2s; width: 15px; height: 15px; }
        .bg-animation span:nth-child(10) { left: 85%; animation-delay: 0s; width: 35px; height: 35px; }

        @keyframes move {
            0% {
                transform: translateY(0) rotate(0deg);
                opacity: 1;
            }
            100% {
                transform: translateY(-1500px) rotate(720deg);
                opacity: 0;
            }
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            position: relative;
            z-index: 1;
        }

        /* Header */
        .header {
            text-align: center;
            padding: 40px 20px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 24px;
            margin-bottom: 30px;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .logo {
            font-size: 4rem;
            margin-bottom: 15px;
            animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }

        .header h1 {
            font-size: 2.8rem;
            font-weight: 700;
            background: linear-gradient(90deg, #00d4ff, #00ff88, #00d4ff);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: gradient 3s linear infinite;
            margin-bottom: 10px;
        }

        @keyframes gradient {
            0% { background-position: 0% center; }
            100% { background-position: 200% center; }
        }

        .header p {
            color: #8892b0;
            font-size: 1.1rem;
        }

        .server-info {
            margin-top: 15px;
            padding: 10px 20px;
            background: rgba(0, 212, 255, 0.1);
            border-radius: 10px;
            display: inline-block;
        }

        .server-info code {
            color: #00d4ff;
            font-family: monospace;
            font-size: 0.9rem;
        }

        /* Status Badge */
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 12px 24px;
            border-radius: 50px;
            font-weight: 600;
            margin-top: 20px;
            font-size: 0.95rem;
            transition: all 0.3s ease;
        }

        .status-badge.connected {
            background: rgba(0, 255, 136, 0.15);
            color: #00ff88;
            border: 2px solid rgba(0, 255, 136, 0.5);
            box-shadow: 0 0 20px rgba(0, 255, 136, 0.2);
        }

        .status-badge.disconnected {
            background: rgba(255, 107, 107, 0.15);
            color: #ff6b6b;
            border: 2px solid rgba(255, 107, 107, 0.5);
            box-shadow: 0 0 20px rgba(255, 107, 107, 0.2);
        }

        .status-badge.connecting {
            background: rgba(255, 193, 7, 0.15);
            color: #ffc107;
            border: 2px solid rgba(255, 193, 7, 0.5);
            box-shadow: 0 0 20px rgba(255, 193, 7, 0.2);
        }

        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        .connected .status-dot { background: #00ff88; }
        .disconnected .status-dot { background: #ff6b6b; }
        .connecting .status-dot { background: #ffc107; }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.1); }
        }

        /* Stats Row */
        .stats-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 25px;
        }

        .stat-item {
            background: rgba(255, 255, 255, 0.05);
            padding: 15px 20px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stat-item i {
            color: #00d4ff;
            font-size: 1.2rem;
            margin-bottom: 5px;
        }

        .stat-item .value {
            font-size: 1.1rem;
            font-weight: 600;
            color: #fff;
        }

        .stat-item .label {
            font-size: 0.8rem;
            color: #8892b0;
        }

        /* Main Content */
        .main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }

        @media (max-width: 900px) {
            .main-content {
                grid-template-columns: 1fr;
            }
        }

        /* Cards */
        .card {
            background: rgba(255, 255, 255, 0.03);
            border-radius: 24px;
            padding: 30px;
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        }

        .card h2 {
            font-size: 1.4rem;
            margin-bottom: 25px;
            display: flex;
            align-items: center;
            gap: 12px;
            color: #fff;
        }

        .card h2 i {
            color: #00d4ff;
            font-size: 1.3rem;
        }

        /* QR Code Section */
        .qr-container {
            text-align: center;
        }

        .qr-box {
            background: #fff;
            padding: 20px;
            border-radius: 20px;
            display: inline-block;
            margin: 20px 0;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .qr-box img {
            max-width: 250px;
            height: auto;
            border-radius: 10px;
        }

        .qr-placeholder {
            width: 250px;
            height: 250px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #666;
            font-size: 0.9rem;
            gap: 15px;
        }

        /* Input Styles */
        .input-group {
            margin-bottom: 20px;
        }

        .input-group label {
            display: block;
            margin-bottom: 8px;
            color: #8892b0;
            font-size: 0.9rem;
            font-weight: 500;
        }

        .input-group input {
            width: 100%;
            padding: 16px 20px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
            font-size: 1rem;
            transition: all 0.3s ease;
        }

        .input-group input:focus {
            outline: none;
            border-color: #00d4ff;
            background: rgba(0, 212, 255, 0.1);
            box-shadow: 0 0 20px rgba(0, 212, 255, 0.1);
        }

        .input-group input::placeholder {
            color: #555;
        }

        /* Buttons */
        .btn {
            width: 100%;
            padding: 16px 30px;
            border: none;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .btn-primary {
            background: linear-gradient(135deg, #00d4ff 0%, #00ff88 100%);
            color: #0f0f23;
        }

        .btn-primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 30px rgba(0, 212, 255, 0.4);
        }

        .btn-danger {
            background: linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%);
            color: #fff;
        }

        .btn-danger:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 30px rgba(255, 107, 107, 0.4);
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none !important;
        }

        /* Pairing Code Display */
        .pairing-code-display {
            background: linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(0, 255, 136, 0.1) 100%);
            border: 2px solid rgba(0, 212, 255, 0.3);
            border-radius: 16px;
            padding: 25px;
            text-align: center;
            margin: 25px 0;
        }

        .pairing-code {
            font-size: 2.8rem;
            font-weight: 700;
            letter-spacing: 8px;
            background: linear-gradient(90deg, #00d4ff, #00ff88);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-family: 'Courier New', monospace;
        }

        .pairing-code-label {
            color: #8892b0;
            margin-top: 10px;
            font-size: 0.9rem;
        }

        /* Tabs */
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 25px;
        }

        .tab {
            flex: 1;
            padding: 14px 20px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            background: transparent;
            color: #8892b0;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.9rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .tab:hover {
            border-color: rgba(0, 212, 255, 0.5);
            color: #00d4ff;
        }

        .tab.active {
            background: rgba(0, 212, 255, 0.1);
            border-color: #00d4ff;
            color: #00d4ff;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Instructions */
        .instructions {
            margin-top: 25px;
            padding-top: 25px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .instructions h3 {
            font-size: 1rem;
            margin-bottom: 15px;
            color: #00d4ff;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .instructions ol {
            padding-left: 25px;
        }

        .instructions li {
            margin-bottom: 12px;
            color: #8892b0;
            line-height: 1.6;
        }

        .instructions li strong {
            color: #fff;
        }

        /* Connected Info */
        .connected-info {
            background: linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(0, 212, 255, 0.1) 100%);
            border: 2px solid rgba(0, 255, 136, 0.3);
            border-radius: 20px;
            padding: 30px;
            text-align: center;
        }

        .connected-info i {
            font-size: 4rem;
            color: #00ff88;
            margin-bottom: 20px;
            animation: bounce 2s infinite;
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }

        .connected-info h3 {
            font-size: 1.5rem;
            margin-bottom: 10px;
            color: #fff;
        }

        .connected-number {
            font-size: 1.2rem;
            color: #00ff88;
            font-weight: 600;
            font-family: monospace;
        }

        /* Info List */
        .info-list {
            margin-top: 10px;
        }

        .info-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .info-item:last-child {
            border-bottom: none;
        }

        .info-item .label {
            color: #8892b0;
            font-size: 0.9rem;
        }

        .info-item .value {
            font-weight: 600;
            color: #fff;
        }

        /* Quick Links */
        .quick-links {
            margin-top: 30px;
        }

        .quick-links h3 {
            margin-bottom: 15px;
            font-size: 1rem;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .quick-links h3 i {
            color: #00d4ff;
        }

        .link-item {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #8892b0;
            text-decoration: none;
            padding: 12px 15px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.03);
            margin-bottom: 10px;
            transition: all 0.3s ease;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .link-item:hover {
            background: rgba(0, 212, 255, 0.1);
            color: #00d4ff;
            transform: translateX(5px);
        }

        /* Features Grid */
        .features {
            margin-top: 30px;
        }

        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-top: 25px;
        }

        .feature-item {
            background: rgba(255, 255, 255, 0.03);
            border-radius: 16px;
            padding: 25px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.3s ease;
        }

        .feature-item:hover {
            background: rgba(255, 255, 255, 0.05);
            transform: translateY(-5px);
            border-color: rgba(0, 212, 255, 0.3);
        }

        .feature-item i {
            font-size: 2.2rem;
            color: #00d4ff;
            margin-bottom: 15px;
        }

        .feature-item h3 {
            font-size: 1.1rem;
            margin-bottom: 10px;
            color: #fff;
        }

        .feature-item p {
            color: #8892b0;
            font-size: 0.9rem;
            line-height: 1.6;
        }

        /* Footer */
        .footer {
            text-align: center;
            padding: 40px 20px;
            margin-top: 40px;
            color: #555;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .footer a {
            color: #00d4ff;
            text-decoration: none;
            transition: color 0.3s ease;
        }

        .footer a:hover {
            color: #00ff88;
        }

        .footer-links {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-bottom: 20px;
        }

        /* Spinner */
        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid rgba(0, 212, 255, 0.2);
            border-left-color: #00d4ff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Toast Notification */
        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 12px;
            color: #fff;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .toast.success {
            background: linear-gradient(135deg, #00ff88, #00d4ff);
            color: #0f0f23;
        }

        .toast.error {
            background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
        }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        /* Responsive */
        @media (max-width: 600px) {
            .header h1 {
                font-size: 2rem;
            }

            .logo {
                font-size: 3rem;
            }

            .pairing-code {
                font-size: 2rem;
                letter-spacing: 4px;
            }

            .stats-row {
                grid-template-columns: 1fr 1fr;
            }

            .tabs {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <!-- Animated Background -->
    <div class="bg-animation">
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span><span></span>
    </div>

    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="logo">⚔️</div>
            <h1>Knight Bot MD</h1>
            <p>Advanced WhatsApp Multi-Device Bot</p>
            
            <div class="server-info">
                <i class="fas fa-server"></i>
                Server: <code>${getServerURL(req)}</code>
            </div>

            <div class="status-badge ${connectionStatus}" id="statusBadge">
                <span class="status-dot"></span>
                <span id="statusText">${connectionStatus === 'connected' ? '● Connected' : connectionStatus === 'connecting' ? '● Connecting...' : '● Disconnected'}</span>
            </div>

            <div class="stats-row">
                <div class="stat-item">
                    <i class="fas fa-clock"></i>
                    <div class="value" id="uptime">${getUptime()}</div>
                    <div class="label">Uptime</div>
                </div>
                <div class="stat-item">
                    <i class="fas fa-memory"></i>
                    <div class="value">${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB</div>
                    <div class="label">Memory</div>
                </div>
                <div class="stat-item">
                    <i class="fas fa-microchip"></i>
                    <div class="value">${require('os').cpus()[0]?.model?.split(' ')[0] || 'CPU'}</div>
                    <div class="label">Processor</div>
                </div>
                <div class="stat-item">
                    <i class="fas fa-network-wired"></i>
                    <div class="value">${CONFIG.PORT}</div>
                    <div class="label">Port</div>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="main-content">
            <!-- Connection Card -->
            <div class="card">
                <h2><i class="fas fa-plug"></i> Connect WhatsApp</h2>
                
                ${connectionStatus === 'connected' ? `
                    <div class="connected-info">
                        <i class="fas fa-check-circle"></i>
                        <h3>Bot Connected Successfully!</h3>
                        <p class="connected-number">+${connectedNumber || 'Unknown'}</p>
                        <p style="color: #8892b0; margin-top: 10px; font-size: 0.9rem;">
                            Your bot is now active and ready to use
                        </p>
                        <button class="btn btn-danger" style="margin-top: 25px;" onclick="logout()">
                            <i class="fas fa-power-off"></i> Disconnect Bot
                        </button>
                    </div>
                ` : `
                    <!-- Tabs -->
                    <div class="tabs">
                        <button class="tab active" onclick="showTab('qr')">
                            <i class="fas fa-qrcode"></i> QR Code
                        </button>
                        <button class="tab" onclick="showTab('pairing')">
                            <i class="fas fa-mobile-alt"></i> Pairing Code
                        </button>
                    </div>

                    <!-- QR Code Tab -->
                    <div class="tab-content active" id="qr-tab">
                        <div class="qr-container">
                            ${globalQR ? `
                                <div class="qr-box">
                                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(globalQR)}&bgcolor=ffffff&color=000000&format=png" alt="QR Code">
                                </div>
                                <p style="color: #8892b0; font-size: 0.95rem;">
                                    <i class="fas fa-mobile-alt"></i> Scan with WhatsApp to connect
                                </p>
                            ` : `
                                <div class="qr-box">
                                    <div class="qr-placeholder">
                                        <div class="spinner"></div>
                                        <span>Generating QR Code...</span>
                                    </div>
                                </div>
                                <p style="color: #8892b0;">Waiting for QR code generation</p>
                            `}
                        </div>
                    </div>

                    <!-- Pairing Code Tab -->
                    <div class="tab-content" id="pairing-tab">
                        <div class="pairing-form">
                            <div class="input-group">
                                <label for="phoneNumber">
                                    <i class="fas fa-phone"></i> Phone Number (with country code)
                                </label>
                                <input type="tel" id="phoneNumber" placeholder="e.g., 919876543210 (without + or spaces)" />
                            </div>
                            <button class="btn btn-primary" onclick="requestPairingCode()" id="pairingBtn">
                                <i class="fas fa-key"></i> Get Pairing Code
                            </button>
                            
                            ${globalPairingCode ? `
                                <div class="pairing-code-display">
                                    <div class="pairing-code">${globalPairingCode}</div>
                                    <p class="pairing-code-label">
                                        <i class="fas fa-info-circle"></i> Enter this code in WhatsApp
                                    </p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `}

                <!-- Instructions -->
                <div class="instructions">
                    <h3><i class="fas fa-list-ol"></i> How to Connect</h3>
                    <ol>
                        <li>Open <strong>WhatsApp</strong> on your phone</li>
                        <li>Go to <strong>Settings → Linked Devices</strong></li>
                        <li>Tap <strong>"Link a Device"</strong></li>
                        <li>Scan the QR code <strong>OR</strong> use "Link with Phone Number" and enter the pairing code</li>
                        <li>Wait for connection confirmation</li>
                    </ol>
                </div>
            </div>

            <!-- Info Card -->
            <div class="card">
                <h2><i class="fas fa-info-circle"></i> Bot Information</h2>
                
                <div class="info-list">
                    <div class="info-item">
                        <span class="label"><i class="fas fa-signal"></i> Status</span>
                        <span class="value" style="color: ${connectionStatus === 'connected' ? '#00ff88' : '#ff6b6b'};">
                            ${connectionStatus === 'connected' ? '🟢 Online' : '🔴 Offline'}
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="label"><i class="fas fa-robot"></i> Bot Name</span>
                        <span class="value">${global.botname || 'Knight Bot'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label"><i class="fas fa-code-branch"></i> Version</span>
                        <span class="value">${settings.version || '1.0.0'}</span>
                    </div>
                    <div class="info-item">
                        <span class="label"><i class="fas fa-terminal"></i> Prefix</span>
                        <span class="value">.</span>
                    </div>
                    <div class="info-item">
                        <span class="label"><i class="fas fa-server"></i> Platform</span>
                        <span class="value">${process.platform}</span>
                    </div>
                    <div class="info-item">
                        <span class="label"><i class="fab fa-node-js"></i> Node.js</span>
                        <span class="value">${process.version}</span>
                    </div>
                </div>

                <!-- Quick Links -->
                <div class="quick-links">
                    <h3><i class="fas fa-external-link-alt"></i> Quick Links</h3>
                    <a href="https://github.com/mruniquehacker/Knightbot-MD" target="_blank" class="link-item">
                        <i class="fab fa-github"></i> GitHub Repository
                    </a>
                    <a href="https://whatsapp.com/channel/0029Va90zAnIHphOuO8Msp3A" target="_blank" class="link-item">
                        <i class="fab fa-whatsapp"></i> WhatsApp Channel
                    </a>
                    <a href="${getServerURL(req)}/status" target="_blank" class="link-item">
                        <i class="fas fa-chart-bar"></i> API Status
                    </a>
                </div>
            </div>
        </div>

        <!-- Features Section -->
        <div class="features card" style="margin-top: 30px;">
            <h2><i class="fas fa-star"></i> Bot Features</h2>
            <div class="features-grid">
                <div class="feature-item">
                    <i class="fas fa-shield-alt"></i>
                    <h3>Group Management</h3>
                    <p>Antilink, antibadword, antitag, welcome/goodbye messages, kick, ban, promote, demote.</p>
                </div>
                <div class="feature-item">
                    <i class="fas fa-download"></i>
                    <h3>Media Download</h3>
                    <p>Download from YouTube, TikTok, Instagram, Facebook, Twitter, and Spotify.</p>
                </div>
                <div class="feature-item">
                    <i class="fas fa-robot"></i>
                    <h3>AI Features</h3>
                    <p>ChatGPT, Gemini AI, image generation with DALL-E, Flux, and more.</p>
                </div>
                <div class="feature-item">
                    <i class="fas fa-gamepad"></i>
                    <h3>Fun & Games</h3>
                    <p>Tic-tac-toe, hangman, trivia, truth/dare, memes, jokes, quotes.</p>
                </div>
                <div class="feature-item">
                    <i class="fas fa-image"></i>
                    <h3>Sticker Maker</h3>
                    <p>Create stickers from images, videos, GIFs with custom pack names.</p>
                </div>
                <div class="feature-item">
                    <i class="fas fa-cogs"></i>
                    <h3>100+ Commands</h3>
                    <p>Extensive command list for moderation, utilities, media, and more.</p>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="footer-links">
                <a href="https://github.com/mruniquehacker" target="_blank">
                    <i class="fab fa-github"></i> GitHub
                </a>
                <a href="https://youtube.com/@MrUniqueHacker" target="_blank">
                    <i class="fab fa-youtube"></i> YouTube
                </a>
                <a href="https://whatsapp.com/channel/0029Va90zAnIHphOuO8Msp3A" target="_blank">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </a>
            </div>
            <p>Made with ❤️ by <a href="https://github.com/mruniquehacker">Mr Unique Hacker</a></p>
            <p style="margin-top: 10px; font-size: 0.85rem;">© 2024 Knight Bot MD. All rights reserved.</p>
        </div>
    </div>

    <script>
        // Tab switching
        function showTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            event.target.closest('.tab').classList.add('active');
            document.getElementById(tabName + '-tab').classList.add('active');
        }

        // Show toast notification
        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            toast.innerHTML = '<i class="fas fa-' + (type === 'success' ? 'check-circle' : 'exclamation-circle') + '"></i> ' + message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        // Request pairing code
        async function requestPairingCode() {
            const phoneInput = document.getElementById('phoneNumber');
            const phoneNumber = phoneInput.value.replace(/[^0-9]/g, '');
            
            if (!phoneNumber || phoneNumber.length < 10) {
                showToast('Please enter a valid phone number with country code', 'error');
                phoneInput.focus();
                return;
            }

            const btn = document.getElementById('pairingBtn');
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div> Requesting...';

            try {
                const response = await fetch('/pair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showToast('Pairing code generated successfully!');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showToast(data.message || 'Failed to get pairing code', 'error');
                }
            } catch (error) {
                showToast('Error requesting pairing code', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-key"></i> Get Pairing Code';
            }
        }

        // Logout
        async function logout() {
            if (!confirm('Are you sure you want to disconnect the bot?')) return;
            
            try {
                const response = await fetch('/logout', { method: 'POST' });
                const data = await response.json();
                
                if (data.success) {
                    showToast('Bot disconnected successfully');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showToast('Failed to logout', 'error');
                }
            } catch (error) {
                showToast('Error logging out', 'error');
            }
        }

        // Update uptime
        function updateUptime() {
            fetch('/status')
                .then(res => res.json())
                .then(data => {
                    if (data.uptime) {
                        document.getElementById('uptime').textContent = data.uptime;
                    }
                })
                .catch(() => {});
        }

        // Auto refresh every 5 seconds for QR/status updates
        setInterval(() => {
            fetch('/status')
                .then(res => res.json())
                .then(data => {
                    // Only reload if status changed
                    const currentStatus = '${connectionStatus}';
                    if (data.status !== currentStatus) {
                        location.reload();
                    } else if (data.qr && data.qr !== '${globalQR || ''}') {
                        location.reload();
                    } else if (data.pairingCode && data.pairingCode !== '${globalPairingCode || ''}') {
                        location.reload();
                    }
                })
                .catch(() => {});
        }, 5000);

        // Update uptime every second
        setInterval(updateUptime, 1000);

        // Enter key to submit pairing code
        document.addEventListener('DOMContentLoaded', () => {
            const phoneInput = document.getElementById('phoneNumber');
            if (phoneInput) {
                phoneInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') requestPairingCode();
                });
            }
        });
    </script>
</body>
</html>
`;

// Routes
app.get('/', (req, res) => {
    res.send(getHTML(req))
})

app.get('/status', (req, res) => {
    res.json({
        success: true,
        status: connectionStatus,
        qr: globalQR,
        pairingCode: globalPairingCode,
        connectedNumber: connectedNumber,
        uptime: getUptime(),
        memory: (process.memoryUsage().rss / 1024 / 1024).toFixed(1) + ' MB',
        platform: process.platform,
        nodeVersion: process.version
    })
})

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: getUptime()
    })
})

app.post('/pair', async (req, res) => {
    const { phoneNumber } = req.body
    
    if (!phoneNumber) {
        return res.json({ success: false, message: 'Phone number required' })
    }

    try {
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '')
        
        const pn = PhoneNumber('+' + cleanNumber)
        if (!pn.isValid()) {
            return res.json({ success: false, message: 'Invalid phone number format' })
        }

        if (XeonBotInc && !XeonBotInc.authState.creds.registered) {
            const code = await XeonBotInc.requestPairingCode(cleanNumber)
            globalPairingCode = code?.match(/.{1,4}/g)?.join("-") || code
            console.log(chalk.green(`✅ Pairing code generated: ${globalPairingCode}`))
            return res.json({ success: true, pairingCode: globalPairingCode })
        } else if (XeonBotInc?.authState.creds.registered) {
            return res.json({ success: false, message: 'Bot is already connected' })
        } else {
            return res.json({ success: false, message: 'Bot not initialized yet, please wait...' })
        }
    } catch (error) {
        console.error('Pairing error:', error)
        return res.json({ success: false, message: error.message || 'Failed to generate pairing code' })
    }
})

app.post('/logout', async (req, res) => {
    try {
        if (XeonBotInc) {
            try {
                await XeonBotInc.logout()
            } catch (e) {
                console.log('Logout error (expected):', e.message)
            }
        }
        
        rmSync('./session', { recursive: true, force: true })
        
        globalQR = null
        globalPairingCode = null
        connectionStatus = 'disconnected'
        connectedNumber = null
        
        console.log(chalk.yellow('🔄 Session cleared, restarting bot...'))
        
        setTimeout(() => {
            startKnightBot()
        }, 2000)
        
        res.json({ success: true, message: 'Logged out successfully' })
    } catch (error) {
        console.error('Logout error:', error)
        res.json({ success: false, message: error.message })
    }
})

// WhatsApp Bot Function
async function startKnightBot() {
    try {
        let { version } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState('./session')
        const msgRetryCounterCache = new NodeCache()

        XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Knight Bot", "Chrome", "20.0.04"],
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

        XeonBotInc.ev.on('creds.update', saveCreds)
        store.bind(XeonBotInc.ev)

        // Connection handling
        XeonBotInc.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update

            if (qr) {
                globalQR = qr
                globalPairingCode = null
                connectionStatus = 'connecting'
                console.log(chalk.yellow('📱 New QR code generated - View at web interface'))
            }

            if (connection === 'connecting') {
                connectionStatus = 'connecting'
                console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))
            }

            if (connection === 'open') {
                connectionStatus = 'connected'
                globalQR = null
                globalPairingCode = null
                connectedNumber = XeonBotInc.user?.id?.split(':')[0] || 'Unknown'
                botStartTime = Date.now()
                
                console.log(chalk.green('═'.repeat(50)))
                console.log(chalk.green('✅ BOT CONNECTED SUCCESSFULLY!'))
                console.log(chalk.cyan(`📱 Number: +${connectedNumber}`))
                console.log(chalk.cyan(`🌐 Web Panel: http://${CONFIG.VPS_IP}:${CONFIG.PORT}`))
                console.log(chalk.green('═'.repeat(50)))

                try {
                    const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net'
                    await XeonBotInc.sendMessage(botNumber, {
                        text: `🤖 *Knight Bot Connected!*\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online\n🌐 Web Panel: http://${CONFIG.VPS_IP}:${CONFIG.PORT}\n\n_Powered by Knight Bot MD_`,
                    })
                } catch (e) {
                    console.error('Error sending connection message:', e.message)
                }
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
                const statusCode = lastDisconnect?.error?.output?.statusCode

                connectionStatus = 'disconnected'
                globalQR = null
                
                console.log(chalk.red(`❌ Connection closed. Status: ${statusCode}`))

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    rmSync('./session', { recursive: true, force: true })
                    console.log(chalk.yellow('🗑️ Session cleared. Please re-authenticate via web panel.'))
                }

                if (shouldReconnect) {
                    console.log(chalk.yellow('🔄 Reconnecting in 5 seconds...'))
                    await delay(5000)
                    startKnightBot()
                }
            }
        })

        // Message handling
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
                
                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
            }
        })

        // Helper functions
        XeonBotInc.decodeJid = (jid) => {
            if (!jid) return jid
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {}
                return decode.user && decode.server && decode.user + '@' + decode.server || jid
            }
            return jid
        }

        XeonBotInc.getName = (jid) => {
            let id = XeonBotInc.decodeJid(jid)
            let v = store.contacts[id] || {}
            return v.name || v.subject || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
        }

        XeonBotInc.public = true
        XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

        XeonBotInc.ev.on('contacts.update', (update) => {
            for (let contact of update) {
                let id = XeonBotInc.decodeJid(contact.id)
                if (store && store.contacts) {
                    store.contacts[id] = { id, name: contact.notify }
                }
            }
        })

        XeonBotInc.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(XeonBotInc, update)
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
                        await XeonBotInc.sendMessage(callerJid, { 
                            text: '📵 Anticall is enabled. Your call was rejected.' 
                        })
                    }
                    
                    setTimeout(async () => {
                        try { 
                            await XeonBotInc.updateBlockStatus(callerJid, 'block') 
                        } catch {}
                    }, 800)
                }
            } catch (e) {}
        })

        return XeonBotInc
    } catch (error) {
        console.error('Error starting bot:', error)
        await delay(5000)
        startKnightBot()
    }
}

// Start server
app.listen(CONFIG.PORT, CONFIG.HOST, () => {
    console.log(chalk.cyan('\n' + '═'.repeat(50)))
    console.log(chalk.cyan('🤖 KNIGHT BOT MD - VPS Edition'))
    console.log(chalk.cyan('═'.repeat(50)))
    console.log(chalk.green(`✅ Web server started successfully!`))
    console.log(chalk.yellow(`\n📡 Server Information:`))
    console.log(chalk.white(`   • Host: ${CONFIG.HOST}`))
    console.log(chalk.white(`   • Port: ${CONFIG.PORT}`))
    console.log(chalk.white(`   • URL:  http://${CONFIG.VPS_IP}:${CONFIG.PORT}`))
    if (CONFIG.DOMAIN) {
        console.log(chalk.white(`   • Domain: ${CONFIG.USE_HTTPS ? 'https' : 'http'}://${CONFIG.DOMAIN}`))
    }
    console.log(chalk.cyan('\n' + '═'.repeat(50)))
    console.log(chalk.yellow('📱 Starting WhatsApp connection...\n'))
    
    startKnightBot()
})

// Error handling
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
})

// Hot reload
let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
})
```__
