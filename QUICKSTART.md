# Quick Start Guide

## Installation

```bash
npm install
npm start
```

## Connect Your Phone

1. Make sure your phone and Mac are on the same WiFi network
2. Note the URL shown in the terminal (e.g., `http://192.168.1.100:8080`)
3. Open that URL in your phone's browser (Safari on iOS, Chrome on Android)
4. Tap "Enable Motion Sensors" and grant permission
5. Your phone will be assigned to an available slot (1-4)

## Configure CEMU

1. Open CEMU emulator
2. Navigate to: `Options` → `GamePad motion source` → `DSU1`
3. Set:
   - **Server IP**: `localhost` (if CEMU is on the same Mac)
   - **Server Port**: `26760`
   - **Controller Slot**: Select the slot your phone is using (shown in web interface)

## Tips

- **Keep Screen On**: The app works best when your phone screen stays awake
- **Adjust Sensitivity**: Use the slider in the web interface (1.0 is default)
- **Multiple Phones**: Connect up to 4 phones for multiplayer games
- **iOS 12.2+**: Enable Settings → Safari → Motion & Orientation Access
- **iOS 13+**: Grant permission when prompted (may need to restart Safari if it doesn't work)

## Troubleshooting

**Phone won't connect:**
- Check that both devices are on the same WiFi
- Try accessing the URL in incognito/private browsing mode
- Restart your browser

**Motion not working:**
- Make sure you tapped "Enable Motion Sensors"
- On iOS, check Settings → Safari → Motion & Orientation Access
- Try increasing sensitivity

**CEMU not detecting:**
- Verify server IP is correct (localhost or your Mac's IP)
- Check that port 26760 is not blocked by firewall
- Make sure DSU1 is selected in CEMU settings

## How It Works

```
Phone Browser (Motion Sensors)
    ↓ WebSocket (Socket.IO)
Motion Server (Node.js)
    ↓ UDP (CEMUhook Protocol)
CEMU Emulator (Port 26760)
```

## Advanced

### Using CEMU on a Different Computer

If CEMU is running on a different computer than the server:

1. Find your Mac's IP address (shown in terminal when server starts)
2. In CEMU, set Server IP to your Mac's IP instead of localhost
3. Make sure port 26760 is accessible (check firewall settings)

### Changing Ports

Edit `app.js` to change the ports:
- Line 365: Change `8080` for web interface port
- Line 274: Change `26760` for CEMUhook protocol port

## Support

For issues or questions, please open an issue on GitHub.
