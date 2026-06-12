const WebSocket = require('ws');
const fs = require('fs');
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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      acceptDownloads: true
    });

    // Handle PDF requests by forcing attachment download header
    await context.route(/\.pdf(\?|$)/i, async (route) => {
      try {
        console.log(`Intercepting PDF request: ${route.request().url()}`);
        const response = await route.fetch();
        await route.fulfill({
          response,
          headers: {
            ...response.headers(),
            'content-disposition': 'attachment'
          }
        });
      } catch (err) {
        console.error('Error routing PDF request:', err);
        await route.continue().catch(() => {});
      }
    });

    // Monitor and manage multiple pages/tabs dynamically
    const pages = [];
    context.on('page', (newPage) => {
      console.log('New page/tab opened');
      pages.push(newPage);
      page = newPage;

      newPage.on('close', () => {
        console.log('Page/tab closed');
        const index = pages.indexOf(newPage);
        if (index > -1) {
          pages.splice(index, 1);
        }
        if (pages.length > 0) {
          page = pages[pages.length - 1];
          console.log(`Switched active page to: ${page.url()}`);
        } else {
          page = null;
        }
      });
    });

    context.on('download', async (download) => {
      try {
        console.log(`Intercepted download: ${download.suggestedFilename()}`);
        const path = await download.path();
        const buffer = fs.readFileSync(path);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'download', 
            filename: download.suggestedFilename(), 
            data: buffer.toString('base64') 
          }));
          console.log(`Successfully sent download file ${download.suggestedFilename()} to client`);
        }
      } catch (err) {
        console.error('Error handling download event:', err);
      }
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

        // Check if ws.bufferedAmount is greater than 1 MB (1 * 1024 * 1024)
        if (ws.bufferedAmount > 1 * 1024 * 1024) {
          console.log(`[Backpressure] ws.bufferedAmount (${ws.bufferedAmount} bytes) exceeds 1MB limit. Skipping frame.`);
          await new Promise((resolve) => setTimeout(resolve, 50));
          continue;
        }

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
