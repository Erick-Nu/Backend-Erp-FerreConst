import type { Response } from 'express';

const SSE_KEEPALIVE_INTERVAL_MS = 15000;

function sendSSEData(res: Response, event: string, data: object): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function createSSEConnection(res: Response, onDisconnect: () => void): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write('event: connected\ndata: {}\n\n');

  const keepAliveId = setInterval(() => {
    res.write(':keepalive\n\n');
  }, SSE_KEEPALIVE_INTERVAL_MS);

  res.on('close', () => {
    clearInterval(keepAliveId);
    onDisconnect();
  });
}

export { createSSEConnection, sendSSEData };
