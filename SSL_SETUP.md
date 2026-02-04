# SSL/HTTPS Setup Guide with Let's Encrypt

This guide explains how to set up SSL/HTTPS support using Let's Encrypt certificates for your public IP address.

## Prerequisites

- A public IP address that is accessible from the internet
- Port 80 must be open and forwarded to your server (required for Let's Encrypt HTTP-01 challenge)
- Port 443 (or your chosen HTTPS port) must be open and forwarded to your server
- A domain name pointing to your public IP (optional but recommended)
- Root/administrator access to run the server on ports 80 and 443

## Why SSL/HTTPS?

SSL/HTTPS is required for:
- **iOS 13+**: Motion sensor access requires HTTPS or localhost
- **Secure connections**: Encrypted data transmission
- **Public access**: Safe remote connections over the internet

## Quick Start with SSL

### 1. Using a Domain Name (Recommended)

If you have a domain name pointing to your public IP:

```bash
# Set environment variables
export USE_SSL=true
export SSL_EMAIL=your-email@example.com
export SSL_DOMAIN=motion.yourdomain.com
export HTTP_PORT=80
export HTTPS_PORT=443

# Start the server (may require sudo for ports 80/443)
sudo -E node app.js
```

### 2. Using a Public IP Address

For direct public IP access without a domain:

```bash
# Set environment variables
export USE_SSL=true
export SSL_EMAIL=your-email@example.com
export SSL_DOMAIN=123.45.67.89  # Your public IP address
export HTTP_PORT=80
export HTTPS_PORT=443

# Start the server
sudo -E node app.js
```

**Note**: Let's Encrypt requires port 80 to be accessible for the HTTP-01 challenge. Make sure your firewall and router allow incoming connections on port 80.

### 3. Using Command Line Arguments

Alternatively, you can use command line arguments:

```bash
USE_SSL=true SSL_EMAIL=your-email@example.com SSL_DOMAIN=motion.yourdomain.com sudo -E node app.js --ssl
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `USE_SSL` | Yes | `false` | Enable SSL mode (set to `true`) |
| `SSL_EMAIL` | Yes | - | Email address for Let's Encrypt notifications |
| `SSL_DOMAIN` | Yes | - | Domain name or public IP address |
| `HTTP_PORT` | No | `8080` | HTTP port (use `80` for Let's Encrypt) |
| `HTTPS_PORT` | No | `8443` | HTTPS port (use `443` for standard HTTPS) |
| `CERT_DIR` | No | `./certificates` | Directory to store certificates |

## Certificate Management

### Automatic Renewal

The server automatically:
- Checks certificate validity on startup
- Renews certificates when they have less than 30 days until expiration
- Stores certificates in the `certificates/` directory

### Manual Certificate Check

Certificates are stored in the `certificates/` directory:
- `account.key` - Let's Encrypt account key
- `cert.key` - Certificate private key
- `cert.pem` - SSL certificate
- `chain.pem` - Certificate chain (if available)

To manually renew, simply delete the certificate files and restart the server.

## Firewall and Port Forwarding

### Required Port Access

For SSL mode to work, you need:

1. **Port 80 (HTTP)**: 
   - Must be accessible from the internet
   - Required for Let's Encrypt HTTP-01 challenge
   - The server uses this temporarily during certificate issuance

2. **Port 443 (HTTPS)**:
   - Should be accessible for client connections
   - This is where your HTTPS server will run

### Router/Firewall Configuration

Configure port forwarding on your router:
- Forward external port 80 → internal port 80 (your server)
- Forward external port 443 → internal port 443 (your server)

### Linux Firewall (ufw example)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 26760/udp  # CEMUhook protocol
```

## Troubleshooting

### "Port 80 is already in use"

If another service is using port 80:

1. **Option 1**: Stop the conflicting service temporarily
   ```bash
   sudo systemctl stop nginx  # or apache2
   ```

2. **Option 2**: Use a different port (not recommended as Let's Encrypt requires port 80)
   ```bash
   export HTTP_PORT=8080
   ```
   Note: You'll need to configure your router to forward port 80 to 8080.

### "Challenge failed" or "Cannot obtain certificate"

Common causes:
- Port 80 is not accessible from the internet
- Firewall blocking incoming connections
- Router not forwarding port 80 correctly
- Domain name not pointing to your public IP

Test port 80 accessibility from an external service like https://www.yougetsignal.com/tools/open-ports/

### "Permission denied" when starting server

Ports below 1024 require root access:

```bash
sudo -E node app.js
```

The `-E` flag preserves environment variables.

### Certificate Renewal Issues

If automatic renewal fails:
1. Delete certificate files: `rm -rf certificates/`
2. Restart the server
3. Check that port 80 is accessible

## iOS 13+ Considerations

iOS 13 and later require HTTPS (or localhost) for motion sensor access. With SSL enabled:

1. Your iPhone can access the server from anywhere via HTTPS
2. No need to be on the same local network
3. Motion sensors will work properly over secure HTTPS connection

## Production Deployment

### Using systemd (Linux)

Create a service file `/etc/systemd/system/cemuhook-motion.service`:

```ini
[Unit]
Description=CEMUhook Motion Server with SSL
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/path/to/cemuhook-mac-new
Environment="USE_SSL=true"
Environment="SSL_EMAIL=your-email@example.com"
Environment="SSL_DOMAIN=motion.yourdomain.com"
Environment="HTTP_PORT=80"
Environment="HTTPS_PORT=443"
ExecStart=/usr/bin/node app.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable cemuhook-motion
sudo systemctl start cemuhook-motion
sudo systemctl status cemuhook-motion
```

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'cemuhook-ssl',
    script: 'app.js',
    env: {
      USE_SSL: 'true',
      SSL_EMAIL: 'your-email@example.com',
      SSL_DOMAIN: 'motion.yourdomain.com',
      HTTP_PORT: '80',
      HTTPS_PORT: '443'
    }
  }]
};
EOF

# Start with PM2
sudo pm2 start ecosystem.config.js

# Save configuration
sudo pm2 save
sudo pm2 startup
```

## Security Best Practices

1. **Keep certificates secure**: The `certificates/` directory is in `.gitignore` by default
2. **Use strong email**: Provide a valid email for Let's Encrypt notifications
3. **Monitor expiration**: Certificates are valid for 90 days but auto-renew at 60 days
4. **Regular updates**: Keep Node.js and dependencies updated
5. **Firewall rules**: Only open necessary ports (80, 443, 26760)

## Fallback to HTTP

If SSL setup fails, the server automatically falls back to HTTP mode on the configured `HTTP_PORT`. Check logs for error messages.

## Testing SSL Setup

Once the server is running with SSL:

1. **Check certificate**: Open `https://yourdomain.com:443` (or your configured port) in a browser
2. **Verify security**: Browser should show a valid SSL certificate
3. **Test on iOS**: Motion sensors should work without localhost
4. **Test remotely**: Connect from outside your local network

## Support

For issues or questions:
- Check server logs for error messages
- Verify port forwarding and firewall settings
- Ensure domain points to correct IP address
- Open an issue on GitHub if problems persist
