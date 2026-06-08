const WebSocket = require('ws');

const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port }, () => {
  console.log(`WebSocket server is listening on port ${port}`);
});

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('close', () => {
    console.log('Client disconnected gracefully');
  });

  ws.on('error', (error) => {
    console.error('WebSocket connection error:', error);
  });
});
