const { app, BrowserWindow, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const selfsigned = require('selfsigned');

const APP_PORT = 41731;
const LAN_BRIDGE_PORT = 41732;
const LAN_HTTPS_PORT = 41733;
const DIST_DIR = path.join(__dirname, '..', 'dist');
const SESSION_PIN = String(crypto.randomInt(100000, 999999));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.cer': 'application/pkix-cert',
};

let server = null;
let lanServer = null;
let lanHttpsServer = null;
let activeLanPort = null;
let activeLanHttpsPort = null;
let activeAppPort = null;
let lastPhonePingAt = 0;
let totalLanScans = 0;
const sseClients = new Set();
let mainWindow = null;
let caCertificate = null;
let caPrivateKey = null;
let caFingerprint = null;
let serverCertificate = null;
let serverCertificateIps = [];
let updatePromptOpen = false;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('update-available', async (info) => {
  if (!mainWindow || updatePromptOpen) return;
  updatePromptOpen = true;
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización disponible',
      message: `Hay una nueva versión de TECNOVA (${info.version}).`,
      detail:
        '¿Deseas descargarla ahora? La instalación se completará al reiniciar la aplicación.',
      buttons: ['Descargar actualización', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (result.response === 0) {
      await autoUpdater.downloadUpdate();
    }
  } catch (error) {
    console.error('No se pudo iniciar la descarga de la actualización:', error);
  } finally {
    updatePromptOpen = false;
  }
});

autoUpdater.on('update-downloaded', async (info) => {
  if (!mainWindow || updatePromptOpen) return;
  updatePromptOpen = true;
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización lista',
      message: `TECNOVA ${info.version} se descargó correctamente.`,
      detail: 'Reinicia la aplicación para completar la instalación.',
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  } catch (error) {
    console.error('No se pudo completar la instalación de la actualización:', error);
  } finally {
    updatePromptOpen = false;
  }
});

autoUpdater.on('error', (error) => {
  console.error('Error al comprobar o descargar actualizaciones:', error);
});

function scheduleUpdateChecks() {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return;
  const checkForUpdates = () => {
    void autoUpdater.checkForUpdates().catch((error) => {
      console.error('No se pudo comprobar si hay actualizaciones:', error);
    });
  };
  setTimeout(checkForUpdates, 15000);
  setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
}

function getLanIpv4Addresses() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, list] of Object.entries(interfaces)) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || item.family !== 'IPv4' || item.internal) continue;
      const addr = item.address;
      if (!addr || addr.startsWith('169.254.')) continue;
      let score = 10;
      if (addr.startsWith('192.168.')) score = 100;
      else if (addr.startsWith('10.')) score = 80;
      else if (addr.startsWith('172.')) score = 50;
      if (/wi-fi|wifi|wlan|ethernet/i.test(name)) score += 20;
      if (/virtual|vmware|vbox|hyper-v|vethernet|docker|wsl/i.test(name)) score -= 60;
      candidates.push({ address: addr, name, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return Array.from(new Set(candidates.map((c) => c.address)));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

async function loadOrCreateLocalCa() {
  const certificateDirectory = path.join(app.getPath('userData'), 'lan-scanner-certificates');
  await fs.promises.mkdir(certificateDirectory, { recursive: true });
  const certificatePath = path.join(certificateDirectory, 'ca-cert.pem');
  const privateKeyPath = path.join(certificateDirectory, 'ca-key.pem');

  if (fs.existsSync(certificatePath) && fs.existsSync(privateKeyPath)) {
    caCertificate = await fs.promises.readFile(certificatePath, 'utf8');
    caPrivateKey = await fs.promises.readFile(privateKeyPath, 'utf8');
  } else {
    const notAfterDate = new Date();
    notAfterDate.setFullYear(notAfterDate.getFullYear() + 10);
    const ca = await selfsigned.generate(
      [{ name: 'commonName', value: 'TECNOVA Local Scanner CA' }],
      {
        keySize: 2048,
        algorithm: 'sha256',
        notAfterDate,
        extensions: [
          { name: 'basicConstraints', cA: true, critical: true },
          {
            name: 'keyUsage',
            keyCertSign: true,
            cRLSign: true,
            critical: true,
          },
        ],
      }
    );
    caCertificate = ca.cert;
    caPrivateKey = ca.private;
    await fs.promises.writeFile(certificatePath, caCertificate, { encoding: 'utf8', mode: 0o600 });
    await fs.promises.writeFile(privateKeyPath, caPrivateKey, { encoding: 'utf8', mode: 0o600 });
  }

  caFingerprint = new crypto.X509Certificate(caCertificate).fingerprint256;
}

async function updateServerCertificate(ips) {
  const certificateIps = Array.from(new Set(ips));
  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...certificateIps.map((ip) => ({ type: 7, ip })),
  ];
  const notAfterDate = new Date();
  notAfterDate.setFullYear(notAfterDate.getFullYear() + 2);
  const leaf = await selfsigned.generate(
    [{ name: 'commonName', value: certificateIps[0] || 'localhost' }],
    {
      keySize: 2048,
      algorithm: 'sha256',
      notAfterDate,
      ca: { key: caPrivateKey, cert: caCertificate },
      extensions: [
        { name: 'basicConstraints', cA: false, critical: true },
        {
          name: 'keyUsage',
          digitalSignature: true,
          keyEncipherment: true,
          critical: true,
        },
        { name: 'extKeyUsage', serverAuth: true },
        { name: 'subjectAltName', altNames },
      ],
    }
  );
  serverCertificate = { key: leaf.private, cert: leaf.cert };
  serverCertificateIps = certificateIps;
  if (lanHttpsServer) {
    lanHttpsServer.setSecureContext(serverCertificate);
  }
}

async function refreshServerCertificateForLanIps() {
  const ips = getLanIpv4Addresses();
  if (
    ips.length !== serverCertificateIps.length ||
    ips.some((ip, index) => ip !== serverCertificateIps[index])
  ) {
    await updateServerCertificate(ips);
  }
  return ips;
}

function serveCaCertificate(res) {
  const certificate = new crypto.X509Certificate(caCertificate);
  res.writeHead(200, {
    'Content-Type': 'application/pkix-cert',
    'Content-Disposition': 'attachment; filename="tecnova-local-scanner-ca.cer"',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(certificate.raw);
}

function broadcastScanEvent(eventPayload) {
  const serialized = `event: scan\ndata: ${JSON.stringify(eventPayload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(serialized);
    } catch {
      sseClients.delete(client);
    }
  }
}

function resolveAssetPath(requestUrl) {
  const cleanUrl = (requestUrl || '/').split('?')[0].split('#')[0];
  let decoded = '/';
  try {
    decoded = decodeURIComponent(cleanUrl);
  } catch {
    decoded = '/';
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = path.resolve(DIST_DIR, relative);

  if (!candidate.startsWith(DIST_DIR)) {
    return path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  return path.join(DIST_DIR, 'index.html');
}

function serveStaticFile(req, res) {
  const filePath = resolveAssetPath(req.url);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Archivo no encontrado');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    });
    res.end(content);
  });
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const httpServer = http.createServer((req, res) => {
      serveStaticFile(req, res);
    });

    httpServer.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        httpServer.listen(0, '127.0.0.1', () => {
          const address = httpServer.address();
          resolve({ server: httpServer, port: address.port });
        });
        return;
      }
      reject(err);
    });

    httpServer.listen(APP_PORT, '127.0.0.1', () => {
      const address = httpServer.address();
      resolve({ server: httpServer, port: address.port });
    });
  });
}

function createLanRequestHandler() {
  return async (req, res) => {
      const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
      const pathname = parsedUrl.pathname;

      if (pathname === '/api/lan-scanner/ca.cer' && req.method === 'GET') {
        serveCaCertificate(res);
        return;
      }

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
      }

      if (pathname === '/api/lan-scanner/info' && req.method === 'GET') {
        const remoteAddress = req.socket.remoteAddress;
        const origin = req.headers.origin;
        const isLoopback =
          remoteAddress === '127.0.0.1' ||
          remoteAddress === '::1' ||
          remoteAddress === '::ffff:127.0.0.1';
        if (!isLoopback || origin !== `http://127.0.0.1:${activeAppPort}`) {
          sendJson(res, 403, { ok: false, error: 'Acceso local requerido' });
          return;
        }
        const ips = await refreshServerCertificateForLanIps();
        const port = activeLanPort || LAN_BRIDGE_PORT;
        const httpsPort = activeLanHttpsPort || LAN_HTTPS_PORT;
        const urls = ips.map(
          (ip) => `https://${ip}:${httpsPort}/?mobile-scanner=1&pin=${SESSION_PIN}`
        );
        const caUrls = ips.map(
          (ip) => `http://${ip}:${port}/api/lan-scanner/ca.cer`
        );
        const phoneConnected = Date.now() - lastPhonePingAt < 25000;
        sendJson(res, 200, {
          ok: true,
          port,
          httpsPort,
          pin: SESSION_PIN,
          ips,
          urls,
          caUrls,
          caFingerprint,
          phoneConnected,
          totalScans: totalLanScans,
          clients: sseClients.size,
        });
        return;
      }

      if (pathname === '/api/lan-scanner/verify' && req.method === 'GET') {
        const pin = (parsedUrl.searchParams.get('pin') || '').trim();
        if (pin !== SESSION_PIN) {
          sendJson(res, 401, { ok: false, error: 'PIN incorrecto' });
          return;
        }
        lastPhonePingAt = Date.now();
        sendJson(res, 200, {
          ok: true,
          appName: 'TECNOVA',
          totalScans: totalLanScans,
        });
        return;
      }

      if (pathname === '/api/lan-scanner/stream' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
        sseClients.add(res);

        const heartbeat = setInterval(() => {
          try {
            res.write(': ping\n\n');
          } catch {
            clearInterval(heartbeat);
            sseClients.delete(res);
          }
        }, 15000);

        req.on('close', () => {
          clearInterval(heartbeat);
          sseClients.delete(res);
        });
        return;
      }

      if (pathname === '/api/lan-scanner/push' && req.method === 'POST') {
        let rawBody = '';
        let aborted = false;
        req.on('data', (chunk) => {
          rawBody += chunk;
          if (rawBody.length > 4096) {
            aborted = true;
            sendJson(res, 413, { ok: false, error: 'Solicitud demasiado grande' });
            req.destroy();
          }
        });
        req.on('end', () => {
          if (aborted) return;
          try {
            const parsed = JSON.parse(rawBody || '{}');
            const pin = String(parsed.pin || '').trim();
            const code = String(parsed.code || '').trim().slice(0, 128);
            const mode = parsed.mode === 'pos' ? 'pos' : 'inventory';
            if (pin !== SESSION_PIN) {
              sendJson(res, 401, { ok: false, error: 'PIN de enlace inválido' });
              return;
            }
            if (!code) {
              sendJson(res, 400, { ok: false, error: 'Código vacío' });
              return;
            }
            lastPhonePingAt = Date.now();
            totalLanScans += 1;
            const eventPayload = {
              code,
              mode,
              timestamp: Date.now(),
              id: totalLanScans,
            };
            broadcastScanEvent(eventPayload);
            if (mainWindow && mainWindow.isMinimized()) {
              mainWindow.restore();
            }
            sendJson(res, 200, {
              ok: true,
              delivered: sseClients.size,
              event: eventPayload,
            });
          } catch {
            sendJson(res, 400, { ok: false, error: 'JSON inválido' });
          }
        });
        return;
      }

      serveStaticFile(req, res);
  };
}

function listenWithFallback(serverToStart, preferredPort, host) {
  return new Promise((resolve, reject) => {
    const listen = (port) => {
      const onError = (err) => {
        serverToStart.removeListener('listening', onListening);
        if (err && err.code === 'EADDRINUSE' && port !== 0) {
          listen(0);
          return;
        }
        reject(err);
      };
      const onListening = () => {
        serverToStart.removeListener('error', onError);
        const address = serverToStart.address();
        if (!address || typeof address === 'string') {
          reject(new Error('No se pudo determinar el puerto del puente LAN.'));
          return;
        }
        resolve(address.port);
      };
      serverToStart.once('error', onError);
      serverToStart.once('listening', onListening);
      serverToStart.listen(port, host);
    };
    listen(preferredPort);
  });
}

async function startLanBridgeServer() {
  await loadOrCreateLocalCa();
  await updateServerCertificate(getLanIpv4Addresses());
  const handler = createLanRequestHandler();
  const bridge = http.createServer((req, res) => {
    void handler(req, res).catch((err) => {
      console.error('Error en el puente HTTP del escáner:', err);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Error del puente local' });
      else res.destroy(err);
    });
  });
  const secureBridge = https.createServer(serverCertificate, (req, res) => {
    void handler(req, res).catch((err) => {
      console.error('Error en el puente HTTPS del escáner:', err);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Error del puente local' });
      else res.destroy(err);
    });
  });

  activeLanPort = await listenWithFallback(bridge, LAN_BRIDGE_PORT, '0.0.0.0');
  activeLanHttpsPort = await listenWithFallback(secureBridge, LAN_HTTPS_PORT, '0.0.0.0');
  return { bridge, secureBridge };
}

function createMainWindow(port, lanPort) {
  activeAppPort = port;
  const iconPath = path.join(DIST_DIR, 'pwa-512x512.png');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: 'TECNOVA',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('blob:') || url.startsWith('data:')) {
      return { action: 'allow' };
    }
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const targetUrl = lanPort
    ? `http://127.0.0.1:${port}/?lanBridgePort=${lanPort}`
    : `http://127.0.0.1:${port}/`;
  void mainWindow.loadURL(targetUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      const started = await startStaticServer();
      server = started.server;
      const lanServers = await startLanBridgeServer();
      lanServer = lanServers.bridge;
      lanHttpsServer = lanServers.secureBridge;
      createMainWindow(started.port, activeLanPort);
      scheduleUpdateChecks();
    } catch (err) {
      console.error('Error al iniciar TECNOVA:', err);
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    for (const client of sseClients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    sseClients.clear();
    if (lanServer) {
      lanServer.close();
      lanServer = null;
    }
    if (lanHttpsServer) {
      lanHttpsServer.close();
      lanHttpsServer = null;
    }
    if (server) {
      server.close();
      server = null;
    }
  });
}
