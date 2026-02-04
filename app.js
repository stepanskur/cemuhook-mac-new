const dgram = require("dgram");
const http = require("http");
const fs = require("fs");
const path = require("path");

// CEMUhook protocol constants
const maxProtocolVer = 1001;
const MessageType = {
  DSUC_VersionReq: 0x100000,
  DSUS_VersionRsp: 0x100000,
  DSUC_ListPorts: 0x100001,
  DSUS_PortInfo: 0x100001,
  DSUC_PadDataReq: 0x100002,
  DSUS_PadDataRsp: 0x100002
};

const serverID = Math.floor(Math.random() * 4294967295);
console.log(`Server ID: ${serverID}`);

// Multi-client support
const clients = new Map(); // Map of slot -> { socket, lastData, lastUpdate }
const cemuhookClients = new Map(); // Map of client address -> { address, port, lastRequest, registeredSlots }
const clientTimeoutLimit = 5000;
const maxSlots = 4; // Support up to 4 controllers

// CRC32 calculation
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// CRC32 lookup table
const crc32Table = (() => {
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function char(a) {
  return a.charCodeAt(0);
}

function BeginPacket(data, dlen) {
  let index = 0;
  data[index++] = char("D");
  data[index++] = char("S");
  data[index++] = char("U");
  data[index++] = char("S");

  data.writeUInt16LE(maxProtocolVer, index);
  index += 2;

  data.writeUInt16LE(dlen || data.length - 16, index);
  index += 2;

  data.writeUInt32LE(0, index);
  index += 4;

  data.writeUInt32LE(serverID, index);
  index += 4;

  return index;
}

function FinishPacket(data) {
  data.writeUInt32LE(crc32(data), 8);
}

function SendPacket(client, data) {
  let buffer = Buffer.alloc(16);
  let index = BeginPacket(buffer, data.length);
  buffer = Buffer.concat([buffer, data]);
  FinishPacket(buffer);
  
  udpServer.send(
    buffer,
    0,
    buffer.length,
    client.port,
    client.address,
    (error, bytes) => {
      if (error) {
        console.error("Send packet error:", error.message);
      }
    }
  );
}

// Create UDP server for CEMUhook protocol
const udpServer = dgram.createSocket("udp4");

udpServer.on("error", (err) => {
  console.error(`UDP server error:\n${err.stack}`);
  udpServer.close();
});

udpServer.on("listening", () => {
  const address = udpServer.address();
  console.log(`✓ UDP server listening on ${address.address}:${address.port}`);
});

udpServer.on("message", (data, rinfo) => {
  if (!(
    data[0] === char("D") &&
    data[1] === char("S") &&
    data[2] === char("U") &&
    data[3] === char("C")
  )) return;

  let index = 4;
  let protocolVer = data.readUInt16LE(index);
  index += 2;
  let packetSize = data.readUInt16LE(index);
  index += 2;
  let receivedCrc = data.readUInt32LE(index);
  index += 4;
  let clientId = data.readUInt32LE(index);
  index += 4;
  let msgType = data.readUInt32LE(index);
  index += 4;

  const clientKey = `${rinfo.address}:${rinfo.port}`;

  if (msgType === MessageType.DSUC_VersionReq) {
    // Ignore version requests
  } else if (msgType === MessageType.DSUC_ListPorts) {
    let numOfPadRequests = data.readInt32LE(index);
    index += 4;
    
    for (let i = 0; i < numOfPadRequests; i++) {
      let requestIndex = data[index + i];
      if (requestIndex >= maxSlots) continue;
      
      let outBuffer = Buffer.alloc(16);
      outBuffer.writeUInt32LE(MessageType.DSUS_PortInfo, 0);
      let outIndex = 4;
      outBuffer[outIndex++] = requestIndex; // pad id
      
      // Check if this slot has an active client
      const client = clients.get(requestIndex);
      const isConnected = client && (Date.now() - client.lastUpdate < 5000);
      
      outBuffer[outIndex++] = isConnected ? 0x02 : 0x00; // state (connected/disconnected)
      outBuffer[outIndex++] = 0x03; // model (generic)
      outBuffer[outIndex++] = 0x01; // connection type (usb)
      
      // MAC address
      for (let j = 0; j < 5; j++) {
        outBuffer[outIndex++] = 0;
      }
      outBuffer[outIndex++] = 0xff;
      
      outBuffer[outIndex++] = 0xef; // battery (charged)
      outBuffer[outIndex++] = isConnected ? 0x01 : 0x00; // is active
      
      SendPacket(rinfo, outBuffer);
    }
  } else if (msgType === MessageType.DSUC_PadDataReq) {
    let flags = data[index++];
    let idToRegister = data[index++];
    let macToRegister = [];
    for (let i = 0; i < 6; i++, index++) {
      macToRegister.push(data[index].toString(16).padStart(2, '0'));
    }
    macToRegister = macToRegister.join(":");

    // Register this CEMUhook client
    if (!cemuhookClients.has(clientKey)) {
      cemuhookClients.set(clientKey, {
        address: rinfo.address,
        port: rinfo.port,
        lastRequest: Date.now(),
        registeredSlots: new Set()
      });
    }
    
    const cemuhookClient = cemuhookClients.get(clientKey);
    cemuhookClient.lastRequest = Date.now();
    
    // Register requested slots
    if (flags === 0 || (idToRegister < maxSlots && (flags & 0x01))) {
      cemuhookClient.registeredSlots.add(idToRegister);
    }
    if (macToRegister === "00:00:00:00:00:ff" && (flags & 0x02)) {
      // Register all slots
      for (let i = 0; i < maxSlots; i++) {
        cemuhookClient.registeredSlots.add(i);
      }
    }
  }
});

// Clean up disconnected clients periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean up CEMUhook clients
  for (const [key, client] of cemuhookClients.entries()) {
    if (now - client.lastRequest > clientTimeoutLimit * 2) {
      cemuhookClients.delete(key);
    }
  }
}, 5000);

function Report(slot, motionTimestamp, accelerometer, gyro) {
  const now = Date.now();
  
  // Send to all registered CEMUhook clients
  for (const [key, cemuhookClient] of cemuhookClients.entries()) {
    if (now - cemuhookClient.lastRequest > clientTimeoutLimit) continue;
    if (!cemuhookClient.registeredSlots.has(slot)) continue;

    let outBuffer = Buffer.alloc(100);
    let outIndex = BeginPacket(outBuffer);
    outBuffer.writeUInt32LE(MessageType.DSUS_PadDataRsp, outIndex);
    outIndex += 4;

    outBuffer[outIndex++] = slot; // pad id
    outBuffer[outIndex++] = 0x02; // state (connected)
    outBuffer[outIndex++] = 0x02; // model (generic)
    outBuffer[outIndex++] = 0x01; // connection type (usb)

    // MAC address
    for (let i = 0; i < 5; i++) {
      outBuffer[outIndex++] = 0x00;
    }
    outBuffer[outIndex++] = 0xff;

    outBuffer[outIndex++] = 0xef; // battery (charged)
    outBuffer[outIndex++] = 0x01; // is active (true)

    const client = clients.get(slot);
    const packetCounter = client ? client.packetCounter++ : 0;
    outBuffer.writeUInt32LE(packetCounter, outIndex);
    outIndex += 4;

    // Buttons (all zero for gyro-only)
    for (let i = 0; i < 12; i++) {
      outBuffer[outIndex++] = 0x00;
    }

    // Analog sticks (all zero)
    for (let i = 0; i < 8; i++) {
      outBuffer[outIndex++] = 0x00;
    }

    outIndex++; // padding

    // Touch pad data (inactive)
    outBuffer[outIndex++] = 0x00;
    outBuffer[outIndex++] = 0x00;
    outBuffer.writeUInt16LE(0x0000, outIndex);
    outIndex += 2;
    outBuffer.writeUInt16LE(0x0000, outIndex);
    outIndex += 2;

    outBuffer[outIndex++] = 0x00;
    outBuffer[outIndex++] = 0x00;
    outBuffer.writeUInt16LE(0x0000, outIndex);
    outIndex += 2;
    outBuffer.writeUInt16LE(0x0000, outIndex);
    outIndex += 2;

    // Motion timestamp (microseconds)
    const tsHex = motionTimestamp.toString(16).padStart(16, '0');
    outBuffer.writeUInt32LE(parseInt(tsHex.slice(8), 16), outIndex);
    outIndex += 4;
    outBuffer.writeUInt32LE(parseInt(tsHex.slice(0, 8), 16), outIndex);
    outIndex += 4;

    // Accelerometer
    outBuffer.writeFloatLE(accelerometer.x, outIndex);
    outIndex += 4;
    outBuffer.writeFloatLE(accelerometer.y, outIndex);
    outIndex += 4;
    outBuffer.writeFloatLE(accelerometer.z, outIndex);
    outIndex += 4;

    // Gyroscope
    outBuffer.writeFloatLE(gyro.x, outIndex);
    outIndex += 4;
    outBuffer.writeFloatLE(gyro.y, outIndex);
    outIndex += 4;
    outBuffer.writeFloatLE(gyro.z, outIndex);
    outIndex += 4;

    FinishPacket(outBuffer);
    udpServer.send(
      outBuffer,
      0,
      outBuffer.length,
      cemuhookClient.port,
      cemuhookClient.address
    );
  }
}

udpServer.bind(26760);

// Create HTTP server
const httpServer = http.createServer((request, response) => {
  if (request.url === '/api/clients') {
    // API endpoint for getting connected clients info
    const clientsInfo = [];
    for (const [slot, client] of clients.entries()) {
      clientsInfo.push({
        slot,
        connected: Date.now() - client.lastUpdate < 5000,
        lastUpdate: client.lastUpdate
      });
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(clientsInfo));
    return;
  }

  const filePath = path.join(__dirname, "index.html");
  fs.readFile(filePath, (err, data) => {
    if (err) {
      response.writeHead(500);
      response.end("Error loading page");
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(data);
  });
});

// Get local IP addresses
function getLocalIPs() {
  const interfaces = require("os").networkInterfaces();
  const ips = [];
  for (const k in interfaces) {
    for (const i in interfaces[k]) {
      const iface = interfaces[k][i];
      if (iface.family === "IPv4" && iface.address !== "127.0.0.1") {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

httpServer.listen(8080, () => {
  console.log("\n" + "=".repeat(50));
  console.log("  CEMUhook Motion Server v2.0 (Mac Edition)");
  console.log("=".repeat(50));
  console.log("\n📱 Connect your phone to:");
  const ips = getLocalIPs();
  ips.forEach(ip => {
    console.log(`   http://${ip}:8080`);
  });
  console.log("\n🎮 Configure CEMU:");
  console.log("   Options → GamePad motion source → DSU1 → ServerIP: localhost");
  console.log("   Port: 26760 (default)");
  console.log("\n💡 Supports up to 4 simultaneous phone connections!");
  console.log("=".repeat(50) + "\n");
});

// Setup Socket.IO for WebSocket connections
const io = require('socket.io')(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log(`📱 New phone connected: ${socket.id}`);
  
  // Find available slot
  let assignedSlot = -1;
  for (let i = 0; i < maxSlots; i++) {
    const client = clients.get(i);
    if (!client || Date.now() - client.lastUpdate > 10000) {
      assignedSlot = i;
      break;
    }
  }
  
  if (assignedSlot === -1) {
    console.log(`❌ No available slots for ${socket.id}`);
    socket.emit("error", { message: "No available slots (max 4 clients)" });
    socket.disconnect();
    return;
  }
  
  console.log(`✓ Assigned slot ${assignedSlot} to ${socket.id}`);
  
  clients.set(assignedSlot, {
    socket: socket,
    lastUpdate: Date.now(),
    lastData: null,
    packetCounter: 0
  });
  
  socket.emit("assigned", { slot: assignedSlot });
  
  socket.on("motion", (data) => {
    const client = clients.get(assignedSlot);
    if (!client) return;
    
    client.lastUpdate = Date.now();
    client.lastData = data;
    
    // Send motion data to CEMUhook
    Report(
      assignedSlot,
      data.timestamp * 1000, // Convert to microseconds
      { x: 0, y: 0, z: 0 }, // Accelerometer (not used for now)
      data.gyro
    );
  });
  
  socket.on("disconnect", () => {
    console.log(`📱 Phone disconnected from slot ${assignedSlot}: ${socket.id}`);
    clients.delete(assignedSlot);
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\nShutting down server...");
  udpServer.close();
  httpServer.close();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
