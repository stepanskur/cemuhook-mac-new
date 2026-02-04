# CEMUhook Motion Server for Mac

A modern, multi-client motion controller server for CEMU emulator. Use your phone's gyroscope as a motion controller!

## ✨ Features

- 🍎 **Mac Compatible** - Works seamlessly on macOS
- 👥 **Multi-Client Support** - Connect up to 4 phones simultaneously
- 🎨 **Beautiful Web Interface** - Modern, responsive design
- 🚀 **No Build Required** - Pure Node.js, runs directly
- 📱 **iOS & Android Support** - Works with any modern mobile browser
- 🎮 **CEMUhook Protocol** - Full compatibility with CEMU emulator

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- macOS, Windows, or Linux
- CEMU emulator (for testing)

### Installation

1. Clone or download this repository:
```bash
git clone https://github.com/stepanskur/cemuhook-mac-new.git
cd cemuhook-mac-new
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

You should see output like:
```
==================================================
  CEMUhook Motion Server v2.0 (Mac Edition)
==================================================

📱 Connect your phone to:
   http://192.168.1.100:8080

🎮 Configure CEMU:
   Options → GamePad motion source → DSU1 → ServerIP: localhost
   Port: 26760 (default)

💡 Supports up to 4 simultaneous phone connections!
==================================================
```

## 📱 Phone Setup

1. **Open the web interface** on your phone's browser using the URL shown in the terminal (e.g., `http://192.168.1.100:8080`)

2. **Enable motion sensors** by tapping the "Enable Motion Sensors" button

3. **Grant permission** when prompted (especially important on iOS 13+)

4. **Keep the screen on** - The app works best with the screen awake

### iOS Notes

- **iOS 12.2+**: Enable 'Settings > Safari > Motion and Orientation access'
- **iOS 13+**: You must grant permission when prompted
- If permission isn't working, try restarting Safari

## 🎮 CEMU Configuration

1. Open CEMU emulator
2. Go to `Options` → `GamePad motion source` → `DSU1`
3. Configure:
   - **Server IP**: `localhost` (or your Mac's IP if CEMU is on another machine)
   - **Server Port**: `26760`
   - Select controller slot (1-4 depending on which phone you want to use)

## 🔧 How It Works

The server creates two main components:

1. **UDP Server** (Port 26760) - Communicates with CEMU using the CEMUhook protocol
2. **HTTP/WebSocket Server** (Port 8080) - Serves the web interface and receives motion data from phones

When a phone connects:
- It's automatically assigned to the next available slot (1-4)
- Motion data from the phone's gyroscope is sent via WebSocket
- The server converts it to CEMUhook protocol and forwards to CEMU
- Multiple phones can connect simultaneously, each assigned to a different slot

## 🎨 Features Comparison

| Feature | Original | This Version |
|---------|----------|--------------|
| Mac Support | ❌ | ✅ |
| Multi-Client | ❌ (1 client) | ✅ (4 clients) |
| Web Interface | Basic | Modern & Beautiful |
| Build Required | ✅ (pkg) | ❌ (Pure Node.js) |
| Sensitivity Control | ✅ | ✅ |
| Visual Feedback | Minimal | Rich |

## 🛠️ Development

The project consists of:
- `app.js` - Main server with UDP and HTTP/WebSocket handling
- `index.html` - Modern web interface with motion controls
- `package.json` - Node.js dependencies

No build step required! Just edit and run with `npm start`.

## 📝 Technical Details

### Protocol
Uses the DSU (DualShock USB) protocol for CEMUhook compatibility. The protocol supports:
- Multiple controller slots (0-3, displayed as 1-4 to users)
- Gyroscope data (pitch, yaw, roll)
- Battery status
- Connection state

### Port Configuration
- **UDP Port 26760**: CEMUhook protocol (standard)
- **HTTP Port 8080**: Web interface and WebSocket

Both ports can be modified in `app.js` if needed.

## 🤝 Credits

Based on [WebGyroForCemuhook](https://github.com/hjmmc/WebGyroForCemuhook) by hjmmc

Original concept from [iOSGyroForCemuhook](https://github.com/denismr/iOSGyroForCemuhook)

## 📄 License

MIT License - Feel free to use and modify!