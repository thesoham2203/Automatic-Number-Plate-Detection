# Next-Gen Toll Collection: ANPR-Driven Automation with RFID Redundancy

## Overview

This project implements a modern toll management system to streamline and automate toll collection. Leveraging Automatic Number Plate Recognition (ANPR) for vehicle identification and RFID technology as a fallback, the system aims to reduce waiting times and congestion at toll booths. By utilizing IoT technologies and cloud-based processing, the solution ensures high efficiency, scalability, and robust security.

## Features

ANPR-based Automation: Detects and recognizes vehicle number plates using a high-definition camera and machine learning.

RFID Redundancy: Ensures smooth operation even if number plate recognition fails.

Cloud Integration: Utilizes Google Cloud for real-time video processing and data storage.

IoT Implementation: Integrates Raspberry Pi, ultrasonic sensors, and actuators for seamless device communication.

Data Analytics: Provides insights into traffic patterns, revenue, and system performance.

Scalability: Designed to support multiple toll lanes and handle peak traffic efficiently.

Secure Transactions: Ensures encrypted data transfer and user authentication.

## System Components

### Hardware:

Raspberry Pi 4: Core processing unit.

USB Webcam: Real-time video capture.

Ultrasonic Sensor: Vehicle detection.

RFID Reader: Backup identification.

Relay Module: Boom barrier control.

Power Supply and SD Card: For system operation.

### Software:

Plate Recognizer API: For ANPR.

Google Cloud Storage: For video handling.

Node.js: For backend scripting.

REST APIs: For communication.

### Workflow

Vehicle Detection: The ultrasonic sensor detects a vehicle's presence.

ANPR Processing:

Camera captures video footage.

Footage is sent to Google Cloud and processed using Plate Recognizer API.

Fallback (if ANPR fails):

RFID reader scans the vehicle tag.

RFID data is matched with the pre-registered vehicle database.

Payment Processing: Toll fee is automatically deducted from the associated account.

Boom Barrier Operation: Relay module controls the barrier based on successful payment confirmation.

System Architecture

(Add your architecture diagram here)

Prerequisites

Hardware setup as mentioned above.

Google Cloud account.

Plate Recognizer API key.

Node.js environment.

Installation and Setup

Clone this repository:

git clone https://github.com/rasikathakur/anpr.git
cd anpr

Install required dependencies:

npm install

Configure the API keys and cloud credentials in the config.json file.

Run the system:

node watchVideo.js

Use Cases

Highway Toll Booths: Automates toll collection for high traffic lanes.

Smart Cities: Integrates with broader IoT ecosystems to provide real-time traffic monitoring.

Secure Facilities: Controls access to restricted areas using ANPR and RFID.

## Demo

Click here to watch the demo video (Replace # with the actual video link)
