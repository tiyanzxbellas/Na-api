/**
 * Stockfish WebAssembly Loader for Node.js
 * 
 * Memuat Stockfish engine via WebAssembly dengan dukungan multi-threading.
 * Menggunakan port dari niklasf/stockfish.wasm (https://github.com/niklasf/stockfish.wasm)
 * 
 * @module lib/stockfish/index
 */

const fs = require('fs');
const path = require('path');

/**
 * Menemukan path file stockfish.js dan stockfish.wasm dengan multiple fallback.
 * Di Vercel/Next.js, __dirname dan process.cwd() bisa berbeda tergantung bundling.
 */
function findStockfishDir() {
    // Kandidat path yang dicoba (urut dari most likely)
    const candidates = [
        // (1) Berdasarkan __dirname (ideal, jika file tidak di-bundle)
        __dirname,
        // (2) Berdasarkan process.cwd() (untuk Vercel serverless)
        path.join(process.cwd(), 'lib', 'stockfish'),
        // (3) Relative dari process.cwd() tanpa lib prefix (beberapa versi Vercel)
        path.join(process.cwd(), 'stockfish'),
        // (4) Dari .next/server (untuk beberapa build Next.js)
        path.join(process.cwd(), '.next', 'server', 'lib', 'stockfish'),
        // (5) Relative 2 level up dari __dirname (jika di-bundle ke subdir)
        path.join(__dirname, '..', '..', 'stockfish'),
        // (6) Dari .next di parent
        path.join(process.cwd(), '.next', 'lib', 'stockfish'),
    ];

    for (const dir of candidates) {
        const testPath = path.join(dir, 'stockfish.js');
        if (fs.existsSync(testPath)) {
            return dir;
        }
    }

    // Fallback: gunakan __dirname (throw error nanti saat require)
    return __dirname;
}

const STOCKFISH_DIR = findStockfishDir();
const WASM_PATH = path.join(STOCKFISH_DIR, 'stockfish.wasm');
const ENGINE_PATH = path.join(STOCKFISH_DIR, 'stockfish.js');

let stockfishInstance = null;
let engineReady = false;
const messageQueue = [];
let messageHandler = null;
let enginePromise = null;

/**
 * Inisialisasi Stockfish engine
 * @returns {Promise<Object>} Stockfish engine instance
 */
function initEngine() {
    if (enginePromise) return enginePromise;
    
    enginePromise = new Promise((resolve, reject) => {
        try {
            // Baca WASM binary dari file
            let wasmBuffer;
            try {
                wasmBuffer = fs.readFileSync(WASM_PATH);
            } catch (readErr) {
                // Fallback: coba dari __dirname langsung
                const fallbackWasm = path.join(__dirname, 'stockfish.wasm');
                if (fs.existsSync(fallbackWasm)) {
                    wasmBuffer = fs.readFileSync(fallbackWasm);
                } else {
                    throw new Error(
                        `Cannot find stockfish.wasm. Tried:\n` +
                        `  - ${WASM_PATH}\n` +
                        `  - ${fallbackWasm}\n` +
                        `  - CWD: ${process.cwd()}\n` +
                        `  - __dirname: ${__dirname}`
                    );
                }
            }

            // Load stockfish.js - Gunakan static require agar nft tracer bisa follow
            let Stockfish;
            try {
                // Static require (tracer-friendly)
                Stockfish = require('./stockfish.js');
            } catch (requireErr) {
                // Fallback: coba dari ENGINE_PATH
                if (ENGINE_PATH !== path.join(__dirname, 'stockfish.js')) {
                    Stockfish = require(ENGINE_PATH);
                } else {
                    throw requireErr;
                }
            }
            
            Stockfish({
                instantiateWasm: function(info, receiveInstance) {
                    return WebAssembly.instantiate(wasmBuffer, info)
                        .then(result => {
                            receiveInstance(result.instance, result.module);
                            return result.instance.exports;
                        })
                        .catch(err => {
                            console.error('[Stockfish] WASM instantiate error:', err);
                            throw err;
                        });
                }
            }).then(sf => {
                stockfishInstance = sf;
                
                sf.addMessageListener((line) => {
                    if (messageHandler) {
                        messageHandler(line);
                    }
                });
                
                // Kirim UCI initialization
                sf.postMessage('uci');
                
                // Tunggu uciok
                const checkReady = (line) => {
                    if (line === 'uciok') {
                        engineReady = true;
                        // Process queued messages
                        for (const msg of messageQueue) {
                            sf.postMessage(msg);
                        }
                        messageQueue.length = 0;
                        resolve(sf);
                    }
                };
                
                const origHandler = messageHandler;
                messageHandler = (line) => {
                    checkReady(line);
                    if (origHandler) origHandler(line);
                };
                
                // Timeout 10 detik
                setTimeout(() => {
                    if (!engineReady) {
                        reject(new Error('Timeout waiting for Stockfish UCI initialization'));
                    }
                }, 10000);
                
            }).catch(err => {
                console.error('[Stockfish] Failed to initialize:', err);
                reject(err);
            });
        } catch (err) {
            console.error('[Stockfish] Fatal error during init:', {
                message: err.message,
                wasmPath: WASM_PATH,
                enginePath: ENGINE_PATH,
                cwd: process.cwd(),
                dirname: __dirname,
                stack: err.stack
            });
            reject(err);
        }
    });
    
    return enginePromise;
}

/**
 * Kirim perintah UCI ke Stockfish dan dapatkan response
 * @param {string} command - Perintah UCI
 * @param {Function} handler - Handler untuk setiap line response
 * @param {number} [timeout=30000] - Timeout dalam ms
 * @returns {Promise<string[]>} Array of response lines
 */
async function sendCommand(command, handler = null, timeout = 30000) {
    const sf = await initEngine();
    
    return new Promise((resolve, reject) => {
        const lines = [];
        const originalHandler = messageHandler;
        
        const timeoutId = setTimeout(() => {
            messageHandler = originalHandler;
            reject(new Error(`Timeout waiting for response to: ${command}`));
        }, timeout);
        
        messageHandler = (line) => {
            lines.push(line);
            if (handler) handler(line);
            
            // Best move = akhir dari pencarian
            if (line.startsWith('bestmove')) {
                clearTimeout(timeoutId);
                messageHandler = originalHandler;
                resolve(lines);
            }
            
            // UCI OK = siap
            if (line === 'uciok') {
                clearTimeout(timeoutId);
                messageHandler = originalHandler;
                resolve(lines);
            }
            
            // Ready OK
            if (line === 'readyok') {
                clearTimeout(timeoutId);
                messageHandler = originalHandler;
                resolve(lines);
            }
            
            // Error
            if (line.startsWith('error') || line.startsWith('Error')) {
                clearTimeout(timeoutId);
                messageHandler = originalHandler;
                reject(new Error(line));
            }
        };
        
        sf.postMessage(command);
    });
}

/**
 * Mendapatkan best move untuk suatu posisi
 * @param {Object} options
 * @param {string} [options.fen] - FEN string posisi. Jika kosong, gunakan startpos
 * @param {string[]} [options.moves] - Array gerakan dalam format UCI (optional)
 * @param {number} [options.depth] - Depth pencarian (optional, default 15)
 * @param {number} [options.movetime] - Waktu pencarian dalam ms (optional, alternatif depth)
 * @param {number} [options.multiPv] - Jumlah variasi utama (optional, default 1)
 * @returns {Promise<Object>} Hasil analisis
 */
async function getBestMove({ fen, moves, depth, movetime, multiPv = 1 } = {}) {
    const sf = await initEngine();
    
    // Set MultiPV jika perlu
    if (multiPv > 1) {
        sf.postMessage(`setoption name MultiPV value ${multiPv}`);
    }
    
    // Set posisi
    if (fen) {
        sf.postMessage(`position fen ${fen}${moves && moves.length ? ' moves ' + moves.join(' ') : ''}`);
    } else {
        sf.postMessage(`position startpos${moves && moves.length ? ' moves ' + moves.join(' ') : ''}`);
    }
    
    // Mulai pencarian
    if (depth) {
        sf.postMessage(`go depth ${depth}`);
    } else if (movetime) {
        sf.postMessage(`go movetime ${movetime}`);
    } else {
        sf.postMessage('go depth 15');
    }
    
    // Kumpulkan hasil
    const lines = await new Promise((resolve, reject) => {
        const allLines = [];
        const timeout = Math.max((movetime || 30000) + 5000, 35000);
        const timeoutId = setTimeout(() => {
            messageHandler = originalHandler;
            reject(new Error(`Timeout waiting for bestmove`));
        }, timeout);
        
        const originalHandler = messageHandler;
        
        messageHandler = (line) => {
            allLines.push(line);
            
            if (line.startsWith('bestmove')) {
                clearTimeout(timeoutId);
                messageHandler = originalHandler;
                resolve(allLines);
            }
        };
    });
    
    // Parse hasil
    return parseAnalysis(lines, multiPv);
}

/**
 * Parse output Stockfish menjadi structured data
 * @param {string[]} lines - Array of output lines
 * @param {number} multiPv - Jumlah PV
 * @returns {Object} Parsed analysis result
 */
function parseAnalysis(lines, multiPv = 1) {
    const result = {
        bestmove: null,
        ponder: null,
        info: [],
        pvs: []
    };
    
    // Cari bestmove
    for (const line of lines) {
        if (line.startsWith('bestmove')) {
            const parts = line.split(' ');
            result.bestmove = parts[1];
            if (parts.length > 3 && parts[2] === 'ponder') {
                result.ponder = parts[3];
            }
        }
    }
    
    // Parse info lines untuk PV
    const pvMap = {};
    
    for (const line of lines) {
        if (line.startsWith('info')) {
            const info = parseInfoLine(line);
            if (info) {
                result.info.push(info);
                
                // Simpan per multipv
                const pvIndex = info.multipv || 1;
                if (!pvMap[pvIndex] || info.depth > pvMap[pvIndex].depth) {
                    pvMap[pvIndex] = info;
                }
            }
        }
    }
    
    // Konversi ke array
    for (let i = 1; i <= multiPv; i++) {
        if (pvMap[i]) {
            result.pvs.push(pvMap[i]);
        }
    }
    
    // Ambil score dari depth terakhir
    const lastInfo = result.info.filter(i => i.pv).pop();
    if (lastInfo) {
        result.score_cp = lastInfo.score_cp;
        result.score_mate = lastInfo.score_mate;
        result.depth = lastInfo.depth;
        result.seldepth = lastInfo.seldepth;
        result.nodes = lastInfo.nodes;
        result.nps = lastInfo.nps;
        result.hashfull = lastInfo.hashfull;
        result.time = lastInfo.time;
    }
    
    return result;
}

/**
 * Parse satu line info dari Stockfish
 * @param {string} line - Info line dari Stockfish
 * @returns {Object|null} Parsed info
 */
function parseInfoLine(line) {
    if (!line.startsWith('info')) return null;
    
    const parts = line.split(' ');
    const info = {};
    
    for (let i = 1; i < parts.length; i++) {
        switch (parts[i]) {
            case 'depth':
                info.depth = parseInt(parts[++i]);
                break;
            case 'seldepth':
                info.seldepth = parseInt(parts[++i]);
                break;
            case 'multipv':
                info.multipv = parseInt(parts[++i]);
                break;
            case 'score':
                const scoreType = parts[++i];
                if (scoreType === 'cp') {
                    info.score_cp = parseInt(parts[++i]) / 100;
                } else if (scoreType === 'mate') {
                    info.score_mate = parseInt(parts[++i]);
                }
                break;
            case 'nodes':
                info.nodes = parseInt(parts[++i]);
                break;
            case 'nps':
                info.nps = parseInt(parts[++i]);
                break;
            case 'hashfull':
                info.hashfull = parseInt(parts[++i]);
                break;
            case 'time':
                info.time = parseInt(parts[++i]);
                break;
            case 'pv':
                const pvMoves = [];
                for (let j = i + 1; j < parts.length; j++) {
                    if (parts[j].match(/^[a-h][1-8][a-h][1-8]/)) {
                        pvMoves.push(parts[j]);
                    }
                }
                info.pv = pvMoves;
                i = parts.length;
                break;
            case 'string':
                // Abaikan string messages
                i = parts.length;
                break;
            default:
                // Skip unknown
                break;
        }
    }
    
    if (info.depth !== undefined || info.pv) {
        return info;
    }
    
    return null;
}

/**
 * Reset engine ke posisi awal
 */
async function resetGame() {
    const sf = await initEngine();
    sf.postMessage('ucinewgame');
}

/**
 * Set option Stockfish
 * @param {string} name - Nama option
 * @param {string} value - Value option
 */
async function setOption(name, value) {
    const sf = await initEngine();
    sf.postMessage(`setoption name ${name} value ${value}`);
}

/**
 * Get Stockfish engine info
 */
async function getEngineInfo() {
    return {
        name: 'Stockfish',
        version: '140121',
        protocol: 'UCI',
        source: 'https://github.com/niklasf/stockfish.wasm',
        options: {
            threads: { min: 1, max: 32, default: 1 },
            hash: { min: 1, max: 1024, default: 16 },
            multiPV: { min: 1, max: 500, default: 1 },
            skillLevel: { min: 0, max: 20, default: 20 },
            uciElo: { min: 1350, max: 2850, default: 1350 },
            moveOverhead: { min: 0, max: 5000, default: 10 }
        }
    };
}

module.exports = {
    initEngine,
    sendCommand,
    getBestMove,
    resetGame,
    setOption,
    getEngineInfo,
    parseAnalysis
};
