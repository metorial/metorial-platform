/**
 * Example usage of the Conduit distributed messaging system
 */

import { createConduit } from './src/index';

console.log('=== Conduit Distributed Messaging Example ===\n');

// Create a Conduit instance with in-memory adapters (for testing)
const conduit = createConduit();

// Create a receiver that processes messages
const receiver = conduit.createReceiver(async (topic, payload) => {
  console.log(`Receiver processing: topic=${topic}, payload=${JSON.stringify(payload)}`);

  // Simulate some processing
  await new Promise(resolve => setTimeout(resolve, 100));

  return { processed: true, topic, originalPayload: payload };
});

// Start the receiver
await receiver.start();
console.log('Receiver started\n');

// Create a sender
const sender = conduit.createSender();
console.log('Sender created\n');

// Send some messages
console.log('Sending messages...\n');

const response1 = await sender.send('orders', { orderId: 123, action: 'create' });
console.log('Response 1:', JSON.stringify(response1, null, 2));

const response2 = await sender.send('payments', { paymentId: 456, amount: 99.99 });
console.log('Response 2:', JSON.stringify(response2, null, 2));

const response3 = await sender.send('orders', { orderId: 789, action: 'update' });
console.log('Response 3:', JSON.stringify(response3, null, 2));

// Check receiver stats
console.log('\nReceiver stats:');
console.log(`- Owned topics: ${receiver.getOwnedTopicCount()}`);
console.log(`- Topics: ${receiver.getOwnedTopics().join(', ')}`);

// Cleanup
console.log('\nCleaning up...');
await receiver.stop();
await sender.close();
await conduit.close();

console.log('Done!');
