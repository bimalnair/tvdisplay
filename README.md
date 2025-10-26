I built a Raspberry Pi-based kiosk using standard HTML, CSS, and JavaScript. It runs in a fullscreen web browser and uses the MQTT protocol to receive real-time updates and commands from our central smart home system (Home Assistant)

KIOSK DISPLAY SETUP: Quick Deployment Guide
This guide documents the final working configuration for the stable Chromium Kiosk display running on a Raspberry Pi OS environment.

1. File Structure
Ensure the following files are located inside your main Kiosk directory (e.g., /home/bimal/kiosk/):

kiosk/
├── index.html
├── app.js
├── config.json
├── (images/)
└── (videos/)
2. System Startup Configuration (CRITICAL FOR STABILITY)
The unstable MQTT connection was fixed by correcting the Chromium launch command. We must ensure the local Python web server and the browser start together correctly.

2.1. Startup File (~/.config/autostart/kiosk.desktop)
Create this file in your user's autostart directory and use the exact Exec line below. It includes the directory change, web server background launch, and crucial security flags.

### 2. Initial Setup Commands

Before launching the kiosk for the first time, run these commands in the Raspberry Pi terminal to prepare the environment:

1. **Install Python Web Server (if needed):**
   ```bash
   sudo apt update
   sudo apt install python3 python3-pip -y


File Location: /home/bimal/.config/autostart/kiosk.desktop

Ini, TOML

[Desktop Entry]
Type=Application
Name=Kiosk
# This command starts the web server in the background and then launches Chromium.
# The security flags are ESSENTIAL for stable local MQTT/AJAX/WebSockets.
Exec=sh -c "cd kiosk/ && python3 -m http.server 8000 & while true; do pgrep -x chromium >/dev/null || chromium-browser --kiosk --start-fullscreen --incognito --user-data-dir=~/.config/chromium-data --disable-web-security --no-proxy-server --autoplay-policy=no-user-gesture-required --disable-restore-session-state http://localhost:8000; sleep 10; done"
X-GNOME-Autostart-enabled=true
2.2. Critical System Directory
You must manually create the custom user-data directory required by the new Chromium command:

Bash

mkdir -p ~/.config/chromium-data
