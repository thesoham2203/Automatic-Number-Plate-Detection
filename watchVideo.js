const fs = require('fs');
require('log-timestamp');

const fetch = require("node-fetch");
const FormData = require("form-data");
const {
    exec
} = require('child_process');

const {
    Datastore
} = require('@google-cloud/datastore');


let options = {
    stdio: 'pipe'
};


var index = 1;


const buttonPressesLogFile = './flag.txt';

console.log(`Watching for file changes on ${buttonPressesLogFile}`);

fs.watchFile(buttonPressesLogFile, (curr, prev) => {

    // console.log(curr, prev);

    index = 1;


    console.log(`${buttonPressesLogFile} file Changed`);


    console.log("Converting .h264 to .mp4...");
    var result = require('child_process').execSync('"C:\\Users\\soham\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe" -y -framerate 24 -i test.h264 -c copy ./html/output.mp4', options);

    console.log("Converting video to frames...");
    var result1 = require('child_process').execSync('"C:\\Users\\soham\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-7.1.1-full_build\\bin\\ffmpeg.exe" -y -i ./html/output.mp4 -r 0.1 ./html/frames/output_%04d.png', options);

    analyzeImages(index);

});








var analyzeImages = function (index) {

    console.log("Analyze Images Function");
    console.log(index);

    if (index < 4) {


        let image_path = "./html/frames/output_000" + index + ".png";
        console.log(image_path);
        let body = new FormData();
        body.append("upload", fs.createReadStream(image_path));
        // Or body.append('upload', base64Image);

        body.append("regions", "us-ca"); // Change to your country

        fetch("https://api.platerecognizer.com/v1/plate-reader/", {
            method: "POST",
            headers: {
                Authorization: "Token 01b00264cab2f3f6b07a0f31681579cb76",
            },
            body: body,
        })
            .then((res) => res.json())
            .then(function (json) {


                if (!!json.results && !!json.results[0] && !!json.results[0].plate) {
                    console.log(json);
                    const fs = require('fs');
                    const path = require('path');
                    require('log-timestamp');

                    const fetch = require("node-fetch");
                    const FormData = require("form-data");
                    const { exec } = require('child_process');
                    const { Datastore } = require('@google-cloud/datastore');

                    // Configuration
                    const CONFIG = {
                        PLATE_RECOGNIZER_TOKEN: process.env.PLATE_RECOGNIZER_TOKEN || "01b00264cab2f3f6b07a0f31681579cb76",
                        REGION: process.env.ANPR_REGION || "us-ca",
                        MAX_RETRIES: 3,
                        RETRY_DELAY: 2000,
                        OUTPUT_DIR: './html',
                        FRAMES_DIR: './html/frames',
                        LOGS_DIR: './logs',
                        FLAG_FILE: './flag.txt'
                    };

                    // Ensure directories exist
                    [CONFIG.OUTPUT_DIR, CONFIG.FRAMES_DIR, CONFIG.LOGS_DIR].forEach(dir => {
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir, { recursive: true });
                        }
                    });

                    // Enhanced logging
                    const log = (level, message, data = null) => {
                        const timestamp = new Date().toISOString();
                        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

                        console.log(logMessage);

                        if (data) {
                            console.log(JSON.stringify(data, null, 2));
                        }

                        // Write to log file
                        const logFile = path.join(CONFIG.LOGS_DIR, `anpr_${new Date().toISOString().split('T')[0]}.log`);
                        const logEntry = logMessage + (data ? '\n' + JSON.stringify(data, null, 2) : '') + '\n';
                        fs.appendFileSync(logFile, logEntry);
                    };

                    // Toll processing state
                    let tollProcessingState = {
                        currentVehicle: null,
                        processStartTime: null,
                        retryCount: 0,
                        detectedPlates: [],
                        tollAmount: 0,
                        processId: null
                    };

                    // Initialize Google Cloud Datastore
                    const datastore = new Datastore({
                        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
                        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
                    });

                    log('info', 'ANPR Toll Collection System Starting', {
                        config: CONFIG,
                        pid: process.pid,
                        nodeVersion: process.version
                    });

                    log('info', `Watching for file changes on ${CONFIG.FLAG_FILE}`);

                    /**
                     * Enhanced toll calculation based on vehicle type and time
                     */
                    function calculateTollAmount(plateNumber, vehicleType = 'car') {
                        const baseRates = {
                            'motorcycle': 2.50,
                            'car': 5.00,
                            'suv': 6.50,
                            'truck': 12.00,
                            'bus': 15.00
                        };

                        const currentHour = new Date().getHours();
                        const isPeakHour = (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19);
                        const peakMultiplier = isPeakHour ? 1.5 : 1.0;

                        const baseAmount = baseRates[vehicleType] || baseRates['car'];
                        return Math.round((baseAmount * peakMultiplier) * 100) / 100; // Round to 2 decimal places
                    }

                    /**
                     * Check if vehicle is registered and account is valid
                     */
                    async function checkVehicleRegistration(plateNumber) {
                        try {
                            const query = datastore.createQuery('Vehicles')
                                .filter('plateNumber', '=', plateNumber.toUpperCase());

                            const [vehicles] = await datastore.runQuery(query);

                            if (vehicles.length > 0) {
                                const vehicle = vehicles[0];
                                return {
                                    isRegistered: true,
                                    accountBalance: vehicle.accountBalance || 0,
                                    vehicleType: vehicle.vehicleType || 'car',
                                    ownerInfo: {
                                        name: vehicle.ownerName,
                                        phone: vehicle.ownerPhone,
                                        email: vehicle.ownerEmail
                                    }
                                };
                            }

                            return {
                                isRegistered: false,
                                accountBalance: 0,
                                vehicleType: 'car',
                                ownerInfo: null
                            };

                        } catch (error) {
                            log('error', 'Error checking vehicle registration', { error: error.message, plateNumber });
                            return {
                                isRegistered: false,
                                accountBalance: 0,
                                vehicleType: 'car',
                                ownerInfo: null
                            };
                        }
                    }

                    /**
                     * Process toll payment
                     */
                    async function processTollPayment(plateNumber, tollAmount, vehicleInfo) {
                        try {
                            const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                            // Record transaction
                            const transaction = {
                                key: datastore.key(['Transactions', transactionId]),
                                data: {
                                    plateNumber: plateNumber.toUpperCase(),
                                    amount: tollAmount,
                                    timestamp: new Date(),
                                    location: process.env.TOLL_LOCATION || 'Highway-101-North',
                                    vehicleType: vehicleInfo.vehicleType,
                                    transactionId: transactionId,
                                    status: vehicleInfo.accountBalance >= tollAmount ? 'SUCCESS' : 'INSUFFICIENT_FUNDS',
                                    processedBy: 'ANPR_SYSTEM',
                                    ownerInfo: vehicleInfo.ownerInfo
                                }
                            };

                            await datastore.save(transaction);

                            // Update account balance if sufficient funds
                            if (vehicleInfo.isRegistered && vehicleInfo.accountBalance >= tollAmount) {
                                const newBalance = vehicleInfo.accountBalance - tollAmount;

                                // Update vehicle record
                                const vehicleKey = datastore.key(['Vehicles', plateNumber.toUpperCase()]);
                                const [vehicle] = await datastore.get(vehicleKey);

                                if (vehicle) {
                                    vehicle.accountBalance = newBalance;
                                    vehicle.lastTollDate = new Date();
                                    vehicle.totalTollsPaid = (vehicle.totalTollsPaid || 0) + tollAmount;
                                    vehicle.transactionCount = (vehicle.transactionCount || 0) + 1;

                                    await datastore.save({
                                        key: vehicleKey,
                                        data: vehicle
                                    });
                                }

                                log('info', 'Toll payment processed successfully', {
                                    plateNumber,
                                    tollAmount,
                                    transactionId,
                                    newBalance
                                });

                                return {
                                    success: true,
                                    transactionId,
                                    newBalance,
                                    message: 'Payment processed successfully'
                                };
                            } else {
                                log('warn', 'Toll payment failed - insufficient funds or unregistered vehicle', {
                                    plateNumber,
                                    tollAmount,
                                    accountBalance: vehicleInfo.accountBalance,
                                    isRegistered: vehicleInfo.isRegistered
                                });

                                return {
                                    success: false,
                                    transactionId,
                                    message: vehicleInfo.isRegistered ? 'Insufficient funds' : 'Vehicle not registered'
                                };
                            }

                        } catch (error) {
                            log('error', 'Error processing toll payment', { error: error.message, plateNumber, tollAmount });
                            return {
                                success: false,
                                message: 'Payment processing error'
                            };
                        }
                    }

                    /**
                     * Save detected plate data with enhanced information
                     */
                    async function saveDetectedPlate(plateData, frameIndex, processingResults) {
                        try {
                            const plateNumber = plateData.plate.toUpperCase();
                            const processId = tollProcessingState.processId || `PROC_${Date.now()}`;

                            // Check vehicle registration
                            const vehicleInfo = await checkVehicleRegistration(plateNumber);

                            // Calculate toll amount
                            const tollAmount = calculateTollAmount(plateNumber, vehicleInfo.vehicleType);

                            // Process payment
                            const paymentResult = await processTollPayment(plateNumber, tollAmount, vehicleInfo);

                            // Save detection record
                            const detectionKey = datastore.key(['PlateDetections']);
                            const detectionData = {
                                plateNumber: plateNumber,
                                confidence: plateData.score || 0,
                                detectionTime: new Date(),
                                frameIndex: frameIndex,
                                processId: processId,
                                location: process.env.TOLL_LOCATION || 'Highway-101-North',
                                vehicleInfo: vehicleInfo,
                                tollAmount: tollAmount,
                                paymentResult: paymentResult,
                                boundingBox: plateData.box,
                                processingTime: Date.now() - tollProcessingState.processStartTime,
                                systemInfo: {
                                    nodeVersion: process.version,
                                    platform: process.platform,
                                    hostname: require('os').hostname()
                                }
                            };

                            await datastore.save({
                                key: detectionKey,
                                data: detectionData
                            });

                            // Update processing state
                            tollProcessingState.detectedPlates.push({
                                plateNumber,
                                confidence: plateData.score,
                                tollAmount,
                                paymentSuccess: paymentResult.success
                            });

                            log('info', 'Plate detection saved successfully', {
                                plateNumber,
                                confidence: plateData.score,
                                tollAmount,
                                paymentSuccess: paymentResult.success,
                                processId
                            });

                            // Trigger barrier control
                            await controlTollBarrier(paymentResult.success);

                            return {
                                success: true,
                                plateNumber,
                                tollAmount,
                                paymentResult
                            };

                        } catch (error) {
                            log('error', 'Error saving plate detection', {
                                error: error.message,
                                plateData: plateData.plate,
                                frameIndex
                            });

                            return {
                                success: false,
                                error: error.message
                            };
                        }
                    }

                    /**
                     * Control toll barrier based on payment status
                     */
                    async function controlTollBarrier(paymentSuccess) {
                        try {
                            if (paymentSuccess) {
                                log('info', 'Opening toll barrier - payment successful');

                                // In a real implementation, this would control actual hardware
                                // For now, we'll simulate the barrier control
                                const barrierCommand = process.env.BARRIER_OPEN_COMMAND || 'echo "BARRIER_OPEN"';

                                exec(barrierCommand, (error, stdout, stderr) => {
                                    if (error) {
                                        log('error', 'Error controlling barrier', { error: error.message });
                                    } else {
                                        log('info', 'Barrier opened successfully', { stdout, stderr });
                                    }
                                });

                                // Close barrier after delay
                                setTimeout(async () => {
                                    const closeCommand = process.env.BARRIER_CLOSE_COMMAND || 'echo "BARRIER_CLOSE"';
                                    exec(closeCommand, (error, stdout, stderr) => {
                                        if (error) {
                                            log('error', 'Error closing barrier', { error: error.message });
                                        } else {
                                            log('info', 'Barrier closed successfully', { stdout, stderr });
                                        }
                                    });
                                }, 10000); // Close after 10 seconds

                            } else {
                                log('warn', 'Barrier remains closed - payment failed');

                                // Trigger alert/notification system
                                await sendPaymentFailureNotification();
                            }

                        } catch (error) {
                            log('error', 'Error in barrier control', { error: error.message });
                        }
                    }

                    /**
                     * Send notification for payment failures
                     */
                    async function sendPaymentFailureNotification() {
                        try {
                            // In a real implementation, this would send SMS/email notifications
                            log('info', 'Payment failure notification sent');

                            // Record the violation
                            const violationKey = datastore.key(['Violations']);
                            const violationData = {
                                timestamp: new Date(),
                                type: 'PAYMENT_FAILURE',
                                location: process.env.TOLL_LOCATION || 'Highway-101-North',
                                processId: tollProcessingState.processId,
                                detectedPlates: tollProcessingState.detectedPlates
                            };

                            await datastore.save({
                                key: violationKey,
                                data: violationData
                            });

                        } catch (error) {
                            log('error', 'Error sending payment failure notification', { error: error.message });
                        }
                    }

                    /**
                     * Enhanced image analysis with better error handling and retry logic
                     */
                    async function analyzeFrame(frameIndex) {
                        if (frameIndex >= 4) {
                            log('info', 'Frame analysis complete', {
                                totalFrames: frameIndex,
                                detectedPlates: tollProcessingState.detectedPlates.length,
                                processingTime: Date.now() - tollProcessingState.processStartTime
                            });

                            // Reset state for next vehicle
                            tollProcessingState = {
                                currentVehicle: null,
                                processStartTime: null,
                                retryCount: 0,
                                detectedPlates: [],
                                tollAmount: 0,
                                processId: null
                            };

                            return;
                        }

                        const imagePath = `./html/frames/output_${frameIndex.toString().padStart(4, '0')}.png`;

                        if (!fs.existsSync(imagePath)) {
                            log('warn', `Frame not found: ${imagePath}`);
                            setTimeout(() => analyzeFrame(frameIndex + 1), CONFIG.RETRY_DELAY);
                            return;
                        }

                        log('info', `Analyzing frame: ${imagePath}`);

                        try {
                            const formData = new FormData();
                            formData.append("upload", fs.createReadStream(imagePath));
                            formData.append("regions", CONFIG.REGION);

                            const response = await fetch("https://api.platerecognizer.com/v1/plate-reader/", {
                                method: "POST",
                                headers: {
                                    Authorization: `Token ${CONFIG.PLATE_RECOGNIZER_TOKEN}`,
                                },
                                body: formData,
                            });

                            const result = await response.json();

                            if (result.results && result.results.length > 0 && result.results[0].plate) {
                                const plateData = result.results[0];

                                log('info', 'License plate detected', {
                                    plate: plateData.plate,
                                    confidence: plateData.score,
                                    frameIndex: frameIndex
                                });

                                // Save detected plate and process toll
                                const saveResult = await saveDetectedPlate(plateData, frameIndex, result);

                                if (saveResult.success) {
                                    // Continue analyzing remaining frames for verification
                                    setTimeout(() => analyzeFrame(frameIndex + 1), 1000);
                                } else {
                                    log('error', 'Failed to save plate detection, retrying...', saveResult);
                                    setTimeout(() => analyzeFrame(frameIndex), CONFIG.RETRY_DELAY);
                                }

                            } else {
                                log('debug', `No plate detected in frame ${frameIndex}`, { result });
                                setTimeout(() => analyzeFrame(frameIndex + 1), 1000);
                            }

                        } catch (error) {
                            log('error', `Error analyzing frame ${frameIndex}`, {
                                error: error.message,
                                imagePath,
                                retryCount: tollProcessingState.retryCount
                            });

                            if (tollProcessingState.retryCount < CONFIG.MAX_RETRIES) {
                                tollProcessingState.retryCount++;
                                setTimeout(() => analyzeFrame(frameIndex), CONFIG.RETRY_DELAY);
                            } else {
                                log('error', `Max retries reached for frame ${frameIndex}, skipping`);
                                setTimeout(() => analyzeFrame(frameIndex + 1), 1000);
                            }
                        }
                    }

                    /**
                     * Process captured video with enhanced error handling
                     */
                    function processVideo() {
                        log('info', 'Starting video processing');

                        try {
                            // Initialize processing state
                            tollProcessingState = {
                                currentVehicle: null,
                                processStartTime: Date.now(),
                                retryCount: 0,
                                detectedPlates: [],
                                tollAmount: 0,
                                processId: `PROC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                            };

                            const options = { stdio: 'pipe' };

                            // Convert H.264 to MP4
                            log('info', 'Converting .h264 to .mp4...');
                            exec('ffmpeg -y -framerate 24 -i test.h264 -c copy ./html/output.mp4', options, (error, stdout, stderr) => {
                                if (error) {
                                    log('error', 'Error converting video', { error: error.message, stderr });
                                    return;
                                }

                                log('info', 'Video conversion completed', { stdout });

                                // Extract frames
                                log('info', 'Converting video to frames...');
                                exec('ffmpeg -y -i ./html/output.mp4 -r 0.1 ./html/frames/output_%04d.png', options, (error, stdout, stderr) => {
                                    if (error) {
                                        log('error', 'Error extracting frames', { error: error.message, stderr });
                                        return;
                                    }

                                    log('info', 'Frame extraction completed', { stdout });

                                    // Start frame analysis
                                    analyzeFrame(1);
                                });
                            });

                        } catch (error) {
                            log('error', 'Error in video processing', { error: error.message });
                        }
                    }

                    // File watcher for vehicle detection trigger
                    fs.watchFile(CONFIG.FLAG_FILE, (curr, prev) => {
                        log('info', `${CONFIG.FLAG_FILE} file changed - vehicle detected`);
                        processVideo();
                    });

                    // Graceful shutdown
                    process.on('SIGINT', () => {
                        log('info', 'ANPR system shutting down gracefully...');
                        process.exit(0);
                    });

                    process.on('SIGTERM', () => {
                        log('info', 'ANPR system terminated');
                        process.exit(0);
                    });

                    // Health check endpoint (if running as a service)
                    if (process.env.NODE_ENV === 'production') {
                        const http = require('http');
                        const server = http.createServer((req, res) => {
                            if (req.url === '/health') {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    status: 'healthy',
                                    timestamp: new Date().toISOString(),
                                    uptime: process.uptime(),
                                    processId: tollProcessingState.processId,
                                    detectedPlates: tollProcessingState.detectedPlates.length
                                }));
                            } else {
                                res.writeHead(404);
                                res.end('Not Found');
                            }
                        });

                        const port = process.env.HEALTH_CHECK_PORT || 3001;
                        server.listen(port, () => {
                            log('info', `Health check server running on port ${port}`);
                        });
                    }

                    log('info', 'ANPR Toll Collection System initialized and ready');
                    console.log(json.results[0].plate)


                    saveData(json.results[0].plate, index);

                } else {


                    console.log(json, index);
                    (async function () {

                        await new Promise(resolve => setTimeout(resolve, 1750));
                        // analyzeImages(index);
                        index = index + 1;
                        analyzeImages(index);

                    }())


                }


            })
            .catch((err) => {
                console.log(err);
            });


    } else {
        index = 1;

    }


}





var saveData = function (data, index) {

    console.log("Save data");
    console.log(index);

    // Imports the Google Cloud client library


    // Creates a client
    const datastore = new Datastore();

    async function quickstart() {
        // The kind for the new entity
        const kind = 'License_Plates';

        // The name/ID for the new entity
        const name = data;

        // The Cloud Datastore key for the new entity
        const taskKey = datastore.key([kind, name]);

        var currentdate = new Date();
        var datetime = currentdate.getDate() + "/" +
            (currentdate.getMonth() + 1) + "/" +
            currentdate.getFullYear() + " @ " +
            currentdate.getHours() + ":" +
            currentdate.getMinutes() + ":" +
            currentdate.getSeconds();

        // Prepares the new entity
        const task = {
            key: taskKey,
            data: {
                location: 'Miami',
                plate: data,
                Date: datetime
            },
        };

        // Saves the entity
        await datastore.save(task);
        console.log(`Saved ${task.key.name}`);



        index = index + 1;
        analyzeImages(index);





    }
    quickstart();



}
