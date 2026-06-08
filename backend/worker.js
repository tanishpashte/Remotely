const WebSocket = require('ws');
const { chromium } = require('playwright');

const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port }, () => {
  console.log(`WebSocket server is listening on port ${port}`);
});

wss.on('connection', async (ws) => {
  console.log('Client connected');

  let browser = null;
  let context = null;
  let page = null;
  let isStreaming = true;
  let cleanedUp = false;

  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    isStreaming = false;
    console.log('Cleaning up browser resources for client...');
    try {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      console.log('Browser resources cleaned up successfully');
    } catch (err) {
      console.error('Error closing browser resources:', err);
    }
  };

  ws.on('close', async () => {
    console.log('Client disconnected');
    await cleanup();
  });

  ws.on('error', async (error) => {
    console.error('WebSocket connection error:', error);
    await cleanup();
  });

  try {
    console.log('Launching headless Chromium instance...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    page = await context.newPage();

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'click') {
          const { x, y } = message;
          if (page && !cleanedUp) {
            console.log(`Executing remote click at: (${x}, ${y})`);
            await page.mouse.click(x, y);
          }
        } else if (message.type === 'key') {
          const { key } = message;
          if (page && !cleanedUp) {
            console.log(`Executing remote keyboard press: "${key}"`);
            await page.keyboard.press(key);
          }
        } else if (message.type === 'scroll') {
          const { deltaY } = message;
          if (page && !cleanedUp) {
            console.log(`Executing remote mouse scroll: deltaY=${deltaY}`);
            await page.mouse.wheel(0, deltaY);
          }
        }
      } catch (err) {
        console.error('Error handling client message:', err);
      }
    });

    console.log('Navigating page to https://google.com...');
    await page.goto('https://google.com', { waitUntil: 'domcontentloaded' });
    console.log('Navigation completed successfully. Starting stream...');


    // Asynchronous self-scheduling loop for streaming frames
    const streamFrames = async () => {
      while (isStreaming && ws.readyState === WebSocket.OPEN) {
        const startTime = Date.now();
        try {
          const buffer = await page.screenshot({
            type: 'jpeg',
            quality: 60
          });

          if (isStreaming && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'frame',
              data: buffer.toString('base64')
            }));
          }
        } catch (err) {
          if (isStreaming) {
            console.error('Error capturing screenshot:', err);
          }
        }

        const duration = Date.now() - startTime;
        const delay = Math.max(0, 100 - duration);

        if (isStreaming && ws.readyState === WebSocket.OPEN) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    };

    // Run the stream loop
    streamFrames();

  } catch (err) {
    console.error('Failed to initialize browser or page:', err);
    ws.close();
    await cleanup();
  }
});
