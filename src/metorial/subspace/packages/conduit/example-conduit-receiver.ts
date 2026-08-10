/**
 * Example usage of the ConduitReceiver high-level API
 * This demonstrates the new interface with per-topic lifecycle management
 */

import type { TopicContext } from './src/index';
import { createConduit } from './src/index';

console.log('=== ConduitReceiver Example ===\n');

const conduit = createConduit();

// Create a ConduitReceiver with per-topic handlers
const receiver = conduit.createConduitReceiver(async (ctx: TopicContext) => {
  console.log(`📦 New topic assigned: ${ctx.topic}`);

  // Perform async setup work (e.g., load configuration, connect to database)
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log(`  ✓ Setup complete for ${ctx.topic}`);

  // Extend the ownership TTL to 60 seconds
  // This tells the system we want to keep owning this topic
  ctx.extendTtl(60000);

  // Register the message handler
  // This will be called for each message on this topic
  ctx.onMessage(async (data: any) => {
    console.log(`  📨 Received message on ${ctx.topic}:`, data);

    // Process the message
    await new Promise(resolve => setTimeout(resolve, 50));

    // Extend TTL by another 10 seconds on each message
    ctx.extendTtl(10000);

    // Return response
    return {
      processed: true,
      topic: ctx.topic,
      timestamp: Date.now(),
      data
    };
  });

  // Register a cleanup handler
  // This will be called when:
  // - The topic is voluntarily closed (ctx.close())
  // - Ownership is lost (TTL expires)
  // - The receiver is stopped
  ctx.onClose(async () => {
    console.log(`  🔒 Topic ${ctx.topic} is closing`);
    // Perform cleanup (e.g., close connections, save state)
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log(`  ✓ Cleanup complete for ${ctx.topic}`);
  });
});

// Start the receiver
await receiver.start();
console.log('Receiver started\n');

// Create a sender
const sender = conduit.createSender();
console.log('Sender created\n');

// Send some messages
console.log('Sending messages...\n');

const response1 = await sender.send('orders', {
  orderId: 123,
  action: 'create',
  items: ['Widget', 'Gadget']
});
console.log('Response 1:', JSON.stringify(response1.result, null, 2));

await new Promise(resolve => setTimeout(resolve, 200));

const response2 = await sender.send('payments', {
  paymentId: 456,
  amount: 99.99,
  currency: 'USD'
});
console.log('Response 2:', JSON.stringify(response2.result, null, 2));

await new Promise(resolve => setTimeout(resolve, 200));

const response3 = await sender.send('orders', {
  orderId: 789,
  action: 'update',
  status: 'shipped'
});
console.log('Response 3:', JSON.stringify(response3.result, null, 2));

await new Promise(resolve => setTimeout(resolve, 200));

// Check receiver stats
console.log('\nReceiver stats:');
console.log(`- Receiver ID: ${receiver.getReceiverId()}`);
console.log(`- Owned topics: ${receiver.getOwnedTopicCount()}`);
console.log(`- Topics: ${receiver.getOwnedTopics().join(', ')}`);
console.log(`- Handled topics: ${receiver.getHandledTopics().join(', ')}`);

// Cleanup - this will trigger onClose for all topics
console.log('\nCleaning up...');
await receiver.stop();
await sender.close();
await conduit.close();

console.log('Done!');
