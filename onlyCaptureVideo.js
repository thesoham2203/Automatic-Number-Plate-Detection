const fs = require("fs");
const path = require("path");
const { exec } = require('child_process');

// Configuration
const CONFIG = {
    VIDEO_DURATION: process.env.VIDEO_DURATION || 10000, // 10 seconds
    VIDEO_WIDTH: process.env.VIDEO_WIDTH || 1920,
    VIDEO_HEIGHT: process.env.VIDEO_HEIGHT || 1080,
    OUTPUT_FILE: process.env.OUTPUT_FILE || 'test.h264',
    FLAG_FILE: process.env.FLAG_FILE || './flag.txt',
    LOGS_DIR: './logs',
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000
};

// Ensure logs directory exists
if (!fs.existsSync(CONFIG.LOGS_DIR)) {
    fs.mkdirSync(CONFIG.LOGS_DIR, { recursive: true });
}

// Enhanced logging
const log = (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [CAPTURE] ${message}`;

    console.log(logMessage);

    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }

    // Write to log file
    const logFile = path.join(CONFIG.LOGS_DIR, `capture_${new Date().toISOString().split('T')[0]}.log`);
    const logEntry = logMessage + (data ? '\n' + JSON.stringify(data, null, 2) : '') + '\n';
    fs.appendFileSync(logFile, logEntry);
};

/**
 * Check if camera is available and functioning
 */
function checkCameraAvailability() {
    return new Promise((resolve, reject) => {
        // Test camera with a quick capture
        exec('libcamera-hello --timeout 1000', (error, stdout, stderr) => {
            if (error) {
                log('error', 'Camera not available', { error: error.message });
                resolve(false);
            } else {
                log('info', 'Camera check successful');
                resolve(true);
            }
        });
    });
}

/**
 * Capture video with enhanced error handling and retry logic
 */
async function captureVideo(attempt = 1) {
    log('info', `Starting video capture (attempt ${attempt}/${CONFIG.RETRY_ATTEMPTS})`, {
        duration: CONFIG.VIDEO_DURATION,
        resolution: `${CONFIG.VIDEO_WIDTH}x${CONFIG.VIDEO_HEIGHT}`,
        outputFile: CONFIG.OUTPUT_FILE
    });

    const startTime = Date.now();

    // Check if previous capture file exists and remove it
    if (fs.existsSync(CONFIG.OUTPUT_FILE)) {
        try {
            fs.unlinkSync(CONFIG.OUTPUT_FILE);
            log('info', 'Removed previous capture file');
        } catch (error) {
            log('warn', 'Could not remove previous capture file', { error: error.message });
        }
    }

    return new Promise(async (resolve, reject) => {
        // Check camera availability first
        const cameraAvailable = await checkCameraAvailability();
        if (!cameraAvailable && attempt === 1) {
            log('error', 'Camera not available, aborting capture');
            reject(new Error('Camera not available'));
            return;
        }

        // Construct capture command
        const captureCommand = `libcamera-vid -t ${CONFIG.VIDEO_DURATION} -o ${CONFIG.OUTPUT_FILE} --width ${CONFIG.VIDEO_WIDTH} --height ${CONFIG.VIDEO_HEIGHT} --codec h264 --level 4.2 --bitrate 8000000`;

        log('info', 'Executing capture command', { command: captureCommand });

        const child = exec(captureCommand, { timeout: CONFIG.VIDEO_DURATION + 5000 });

        let stdout_data = '';
        let stderr_data = '';

        child.stdout.on('data', (data) => {
            stdout_data += data;
            log('debug', 'Capture stdout', { data: data.toString().trim() });
        });

        child.stderr.on('data', (data) => {
            stderr_data += data;
            log('debug', 'Capture stderr', { data: data.toString().trim() });
        });

        child.on('exit', async (code, signal) => {
            const endTime = Date.now();
            const captureTime = endTime - startTime;

            log('info', 'Video capture process exited', {
                code,
                signal,
                captureTime: `${captureTime}ms`,
                attempt
            });

            // Check if capture was successful
            if (code === 0 && fs.existsSync(CONFIG.OUTPUT_FILE)) {
                const fileStats = fs.statSync(CONFIG.OUTPUT_FILE);

                if (fileStats.size > 0) {
                    log('info', 'Video capture completed successfully', {
                        fileSize: `${(fileStats.size / 1024 / 1024).toFixed(2)} MB`,
                        captureTime: `${captureTime}ms`
                    });

                    // Create flag file to trigger processing
                    await createProcessingFlag();
                    resolve({
                        success: true,
                        fileSize: fileStats.size,
                        captureTime: captureTime,
                        outputFile: CONFIG.OUTPUT_FILE
                    });
                } else {
                    log('error', 'Captured file is empty', { fileSize: fileStats.size });

                    if (attempt < CONFIG.RETRY_ATTEMPTS) {
                        log('info', `Retrying capture in ${CONFIG.RETRY_DELAY}ms...`);
                        setTimeout(() => {
                            captureVideo(attempt + 1).then(resolve).catch(reject);
                        }, CONFIG.RETRY_DELAY);
                    } else {
                        reject(new Error('Capture failed - empty file after all attempts'));
                    }
                }
            } else {
                log('error', 'Video capture failed', {
                    exitCode: code,
                    signal,
                    fileExists: fs.existsSync(CONFIG.OUTPUT_FILE),
                    stdout: stdout_data,
                    stderr: stderr_data
                });

                if (attempt < CONFIG.RETRY_ATTEMPTS) {
                    log('info', `Retrying capture in ${CONFIG.RETRY_DELAY}ms...`);
                    setTimeout(() => {
                        captureVideo(attempt + 1).then(resolve).catch(reject);
                    }, CONFIG.RETRY_DELAY);
                } else {
                    reject(new Error(`Capture failed after ${CONFIG.RETRY_ATTEMPTS} attempts`));
                }
            }
        });

        child.on('error', (error) => {
            log('error', 'Capture process error', { error: error.message });

            if (attempt < CONFIG.RETRY_ATTEMPTS) {
                log('info', `Retrying capture in ${CONFIG.RETRY_DELAY}ms...`);
                setTimeout(() => {
                    captureVideo(attempt + 1).then(resolve).catch(reject);
                }, CONFIG.RETRY_DELAY);
            } else {
                reject(error);
            }
        });

        // Set a safety timeout
        setTimeout(() => {
            if (!child.killed) {
                log('warn', 'Capture taking too long, killing process');
                child.kill('SIGTERM');
            }
        }, CONFIG.VIDEO_DURATION + 10000); // 10 seconds buffer
    });
}

/**
 * Create processing flag file with metadata
 */
async function createProcessingFlag() {
    try {
        const flagData = {
            timestamp: new Date().toISOString(),
            captureFile: CONFIG.OUTPUT_FILE,
            triggerSource: 'vehicle_detection',
            processId: `CAP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            systemInfo: {
                nodeVersion: process.version,
                platform: process.platform,
                hostname: require('os').hostname(),
                uptime: process.uptime()
            }
        };

        // Write flag file
        fs.writeFileSync(CONFIG.FLAG_FILE, JSON.stringify(flagData, null, 2));

        log('info', 'Processing flag created', { flagFile: CONFIG.FLAG_FILE, flagData });

        // Also create a simple touch file for backward compatibility
        const touchResult = require('child_process').execSync('touch ./flag.txt');

    } catch (error) {
        log('error', 'Error creating processing flag', { error: error.message });
        throw error;
    }
}

/**
 * Main capture function with comprehensive error handling
 */
async function performCapture() {
    try {
        log('info', 'Vehicle detection triggered - starting capture sequence', {
            config: CONFIG,
            timestamp: new Date().toISOString()
        });

        const result = await captureVideo();

        log('info', 'Capture sequence completed successfully', result);

        // Optional: Send notification or update external system
        if (process.env.WEBHOOK_URL) {
            try {
                const fetch = require("node-fetch");
                await fetch(process.env.WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'vehicle_detected',
                        timestamp: new Date().toISOString(),
                        captureResult: result
                    })
                });
                log('info', 'Webhook notification sent');
            } catch (webhookError) {
                log('warn', 'Failed to send webhook notification', { error: webhookError.message });
            }
        }

        return result;

    } catch (error) {
        log('error', 'Capture sequence failed', { error: error.message });

        // Create error flag for monitoring
        try {
            const errorFlag = {
                timestamp: new Date().toISOString(),
                error: error.message,
                type: 'capture_failure'
            };
            fs.writeFileSync('./capture_error.flag', JSON.stringify(errorFlag, null, 2));
        } catch (flagError) {
            log('error', 'Could not create error flag', { error: flagError.message });
        }

        throw error;
    }
}

// Handle different execution modes
if (require.main === module) {
    // Direct execution
    log('info', 'ANPR Video Capture System started');

    performCapture()
        .then((result) => {
            log('info', 'Capture completed successfully', result);
            process.exit(0);
        })
        .catch((error) => {
            log('error', 'Capture failed', { error: error.message });
            process.exit(1);
        });
} else {
    // Module export for use by other scripts
    module.exports = {
        captureVideo: performCapture,
        checkCameraAvailability,
        CONFIG
    };
}

// Graceful shutdown handlers
process.on('SIGINT', () => {
    log('info', 'Capture system shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('info', 'Capture system terminated');
    process.exit(0);
});

// Unhandled error handlers
process.on('uncaughtException', (error) => {
    log('error', 'Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log('error', 'Unhandled promise rejection', { reason, promise });
    process.exit(1);
});

(async function () {

    await new Promise(resolve => setTimeout(resolve, 8750));
    takeVideo();
}())



        


    });
}


takeVideo();