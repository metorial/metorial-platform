# `@lowerdeck/websocket-client`

Auto-reconnecting WebSocket client with exponential backoff. Handles connection failures and provides a familiar event-driven API.

## Installation

```bash
npm install @lowerdeck/websocket-client
yarn add @lowerdeck/websocket-client
bun add @lowerdeck/websocket-client
pnpm add @lowerdeck/websocket-client
```

## Usage

```typescript
import { ReconnectingWebSocketClient } from '@lowerdeck/websocket-client';

// Create client with automatic reconnection
const ws = new ReconnectingWebSocketClient('wss://example.com/socket', {
  protocols: ['v1'],
  maxAttempts: 5,
  timeout: 5000,
  onReconnect: (attempt) => {
    console.log(`Reconnecting... Attempt ${attempt}`);
  }
});

// Listen for events
ws.addEventListener('open', () => {
  console.log('Connected');
});

ws.addEventListener('message', (event) => {
  console.log('Received:', event.data);
});

ws.addEventListener('close', () => {
  console.log('Disconnected');
});

ws.addEventListener('error', (error) => {
  console.error('Error:', error);
});

ws.addEventListener('maximum', () => {
  console.error('Max reconnection attempts reached');
});

// Send messages
ws.send('Hello server');
ws.send(JSON.stringify({ type: 'ping' }));

// Close connection
ws.close();

// Check connection state
console.log(ws.readyState); // 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
```

### Reconnection Behavior

- Automatically reconnects on connection loss
- Exponential backoff between attempts
- Maximum retry attempts configurable
- Manual close prevents reconnection

## License

This project is licensed under the Apache License 2.0.

<div align="center">
  <sub>Built with ❤️ by <a href="https://metorial.com">Metorial</a></sub>
</div>
