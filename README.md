## KIOSK DISPLAY SETUP: Quick Deployment Guide

This document details the stable configuration and setup process for configuring a Raspberry Pi to run the Chromium-based Kiosk Display reliably.

-----

## 1\. System Overview & File Structure

The kiosk is a web application running in a fullscreen Chromium browser on a Raspberry Pi. It communicates with a central server (like Home Assistant) using the **MQTT protocol** for real-time control.

### File Structure (Kiosk Directory)

Ensure your application folder (`kiosk/` in your home directory) contains your code and assets:

```
kiosk/
├── index.html
├── app.js
├── config.json
├── images/
└── videos/
```

-----

## 2\. Initial Raspberry Pi Setup & Dependencies

This setup assumes a clean installation of **Raspberry Pi OS** (with the desktop environment).

1.  **Install Chromium Browser:**

    ```bash
    sudo apt update
    sudo apt install chromium-browser -y
    ```

2.  **Install Python Web Server (Essential Dependency):**
    This server is needed to host your local HTML/JS files.

    ```bash
    sudo apt install python3 python3-pip -y
    ```

3.  **Create Chromium Data Directory (CRITICAL):**
    This directory is required by the `--user-data-dir` flag, which is necessary to run Chromium with stability and disabled web security.

    ```bash
    mkdir -p ~/.config/chromium-data
    ```

-----

## 3\. Advanced Kiosk Autostart: Systemd Service Method (Recommended)

This method provides the most robust solution for long-term stability by running the web server and the browser as separate, monitored services, ensuring proper startup timing.

### 3.1. Create Dedicated Web Server Service (`kiosk-server.service`)

This service starts the Python web server from your `kiosk` directory.

```bash
sudo nano /etc/systemd/system/kiosk-server.service
```

Paste the following content (ensure `User` and `Group` match your Linux username, e.g., `bimal`):

```ini
[Unit]
Description=Kiosk Local Python Web Server
After=network.target

[Service]
User=bimal
Group=bimal
WorkingDirectory=/home/bimal/kiosk
ExecStart=/usr/bin/python3 -m http.server 8000
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

### 3.2. Create Chromium Kiosk Service (`kiosk.service`)

This service launches the Chromium browser, waits for the web server, and sets the graphical environment variables.

```bash
sudo nano /etc/systemd/system/kiosk.service
```

Paste the following content (ensure `User` and `Group` match your Linux username, e.g., `bimal`):

```ini
[Unit]
Description=Kiosk Chromium Browser
# Wait for the network and the local web server to start.
After=network-online.target kiosk-server.service
Wants=network-online.target kiosk-server.service

[Service]
# IMPORTANT: Wait 20 seconds to ensure the network and display are fully ready.
ExecStartPre=/bin/sleep 20
ExecStart=/usr/bin/chromium-browser --kiosk --start-fullscreen --incognito --disable-web-security --no-proxy-server --autoplay-policy=no-user-gesture-required --disable-restore-session-state http://localhost:8000
Restart=always
RestartSec=10s
User=bimal
Group=bimal
Environment="DISPLAY=:0"
Environment="XAUTHORITY=/home/bimal/.Xauthority"

[Install]
WantedBy=graphical.target
```

### 3.3. Enable and Start Services

Reload the daemon, enable the services for boot, and reboot:

```bash
sudo systemctl daemon-reload
sudo systemctl enable kiosk-server.service
sudo systemctl enable kiosk.service
sudo reboot
```

-----

## 4\. Alternate Autostart Method (Legacy/Backup)

This method embeds both the web server and the browser launch into a single shell script, which runs when the user logs into the desktop environment.

### 4.1. Create the Startup File

Create the autostart file:

```bash
nano ~/.config/autostart/kiosk.desktop
```

### 4.2. Add the Code

Paste the following single block, which contains the complete, complex `Exec` command:

```ini
[Desktop Entry]
Type=Application
Name=Kiosk
Exec=sh -c "cd /home/bimal/kiosk && python3 -m http.server 8000 & while true; do pgrep -x chromium >/dev/null || chromium-browser --kiosk --start-fullscreen --incognito --user-data-dir=~/.config/chromium-data --disable-web-security --no-proxy-server --autoplay-policy=no-user-gesture-required --disable-restore-session-state http://localhost:8000; sleep 10; done"
X-GNOME-Autostart-enabled=true
```

-----

## 5\. MQTT Control Topics

These topics are used to control the display in real-time by publishing messages to your MQTT broker.

| MQTT Topic | Function | Payload Type |
| :--- | :--- | :--- |
| **`display/screen/standby`** | Forces the screen to the default **Clock/Weather** view. | Empty/Ignored |
| **`display/screen/image`** | Loads an image from `./images`. | Filename or JSON (with `file`, `duration`) |
| **`display/screen/video`** | Loads a video from `./videos`. | Filename or JSON (with `file`, `duration`) |
| **`display/banner`** | Displays a temporary announcement banner. | Text or JSON (with `title`, `body`, `color`) |
| **`display/clear`** | Hides the banner and returns to Standby. | Empty/Ignored |
| **`display/frame`** | Displays an overlay image/border from `./frames`. | Filename or JSON (with `file`, `fit`, `opacity`) |
| **`display/frame/clear`** | Removes the frame overlay. | Empty/Ignored |
| **`display/ticker`** | Activates the TV-style scrolling news ticker. | Text or JSON (with `text`, `speed`) |
| **`display/ticker/clear`** | Hides the news ticker. | Empty/Ignored |

```
```
