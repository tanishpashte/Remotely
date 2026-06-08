const http = require('http');
const { exec } = require('child_process');
const WebSocket = require('ws');

const PORT = 4000;

// Set to track connected frontend WebSocket clients
const frontendClients = new Set();
// Global reference to the backend WebSocket client (connecting to Docker container)
let dockerWs = null;

// Helper to close the existing Docker WebSocket connection
function closeDockerWs() {
  if (dockerWs) {
    console.log('Closing existing Docker WebSocket client connection...');
    try {
      dockerWs.terminate();
    } catch (e) {
      console.error('Error closing Docker WebSocket:', e);
    }
    dockerWs = null;
  }
}

// Function to establish WebSocket connection with the Docker container
function connectToDocker() {
  closeDockerWs();

  const url = 'ws://localhost:8080';
  console.log(`Connecting to Docker browser container at ${url}...`);

  dockerWs = new WebSocket(url);

  dockerWs.on('open', () => {
    console.log('Successfully connected to Docker browser WebSocket');
  });

  dockerWs.on('message', (data, isBinary) => {
    // Proxy frames / messages received from Docker container to all frontend clients
    for (const client of frontendClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    }
  });

  dockerWs.on('close', (code, reason) => {
    console.log(`Docker WebSocket connection closed (Code: ${code}, Reason: ${reason})`);
    dockerWs = null;
  });

  dockerWs.on('error', (err) => {
    console.error('Docker WebSocket error:', err.message);
  });
}

// Create HTTP Server
const server = http.createServer((req, res) => {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /start-browser endpoint
  if (req.method === 'POST' && req.url === '/start-browser') {
    console.log('Received /start-browser request');

    // 1. Check if docker container bld-browser-instance exists (running or stopped)
    const checkCmd = 'docker ps -a -q --filter name=^bld-browser-instance$';
    exec(checkCmd, (err, stdout, stderr) => {
      if (err) {
        console.error('Error checking container status:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to check container status', details: stderr }));
        return;
      }

      const containerExists = stdout.trim().length > 0;

      const launchContainer = () => {
        const runCmd = 'docker run -d -p 8080:8080 --name bld-browser-instance bld-browser';
        console.log(`Executing: ${runCmd}`);
        
        exec(runCmd, (runErr, runStdout, runStderr) => {
          if (runErr) {
            console.error('Error launching browser container:', runErr);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to launch browser container', details: runStderr }));
            return;
          }

          console.log(`Container launched successfully. ID: ${runStdout.trim()}`);

          // Send response back immediately to indicate start has initiated
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success', message: 'Browser container starting', containerId: runStdout.trim() }));

          // 2. After a 2-second timeout, connect the backend WebSocket client
          console.log('Waiting 2 seconds for the container to boot...');
          setTimeout(() => {
            connectToDocker();
          }, 2000);
        });
      };

      if (containerExists) {
        console.log('Container bld-browser-instance exists. Force stopping and removing it...');
        closeDockerWs();
        const rmCmd = 'docker rm -f bld-browser-instance';
        
        exec(rmCmd, (rmErr, rmStdout, rmStderr) => {
          if (rmErr) {
            console.warn(`Warning/Error removing container: ${rmStderr || rmErr.message}`);
          }
          launchContainer();
        });
      } else {
        launchContainer();
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

// Setup Main WebSocket Server on port 4000
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Frontend WebSocket client connected');
  frontendClients.add(ws);

  ws.on('message', (data, isBinary) => {
    // Act as straight proxy: forward input frames from frontend to the Docker browser if active
    if (dockerWs && dockerWs.readyState === WebSocket.OPEN) {
      dockerWs.send(data, { binary: isBinary });
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`Frontend client disconnected (Code: ${code}, Reason: ${reason})`);
    frontendClients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('Frontend WebSocket connection error:', err);
    frontendClients.delete(ws);
  });
});

// Start Server on Port 4000
server.listen(PORT, () => {
  console.log(`Host orchestrator server is running on http://localhost:${PORT}`);
  console.log(`Proxy WebSocket server is listening on ws://localhost:${PORT}`);
});
