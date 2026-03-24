/**
 * Example demonstrating the topic listener feature
 * This shows how to subscribe to all responses for a topic
 */

import { createConduit } from './src/index';

console.log('=== Conduit Topic Listener Example ===\n');

const conduit = createConduit();

// Create a receiver that processes orders
const receiver = conduit.createReceiver(async (topic, payload: any) => {
  console.log(`📦 Receiver processing ${topic}:`, payload);
  await new Promise(resolve => setTimeout(resolve, 100));

  return {
    orderId: payload.orderId,
    status: 'processed',
    timestamp: Date.now()
  };
});

await receiver.start();
console.log('✓ Receiver started\n');

// Create multiple senders
const sender1 = conduit.createSender();
const sender2 = conduit.createSender();

// Sender 1 subscribes to listen to ALL order responses
console.log('📡 Sender 1 subscribing to "orders" topic...\n');
const subscription = await sender1.subscribeTopic('orders', broadcast => {
  console.log('🔔 Sender 1 received broadcast:');
  console.log(`   Topic: ${broadcast.topic}`);
  console.log(`   Message ID: ${broadcast.messageId}`);
  console.log(`   From Receiver: ${broadcast.receiverId}`);
  console.log(`   Response:`, broadcast.response.result);
  console.log(`   Success: ${broadcast.response.success}`);
  console.log();
});

// Sender 1 sends an order
console.log('📤 Sender 1 sending order #101...');
const response1 = await sender1.send('orders', { orderId: 101, item: 'Widget' });
console.log('✓ Sender 1 received direct response:', response1.result);

await new Promise(resolve => setTimeout(resolve, 100));

// Sender 2 sends an order (Sender 1 will also see this via subscription!)
console.log('\n📤 Sender 2 sending order #102...');
const response2 = await sender2.send('orders', { orderId: 102, item: 'Gadget' });
console.log('✓ Sender 2 received direct response:', response2.result);

await new Promise(resolve => setTimeout(resolve, 100));

// Sender 1 sends another order
console.log('\n📤 Sender 1 sending order #103...');
const response3 = await sender1.send('orders', { orderId: 103, item: 'Doohickey' });
console.log('✓ Sender 1 received direct response:', response3.result);

await new Promise(resolve => setTimeout(resolve, 100));

// Summary
console.log('\n=== Summary ===');
console.log(`Sender 1 sent: 2 messages`);
console.log(`Sender 2 sent: 1 message`);
console.log(`Sender 1 received: 3 broadcasts (all messages on "orders" topic)`);
console.log();

// Demonstrate unsubscribe
console.log('📴 Sender 1 unsubscribing from topic...');
await subscription.unsubscribe();
console.log('✓ Unsubscribed');

// Send one more message - Sender 1 won't receive broadcast
console.log("\n📤 Sender 2 sending order #104 (Sender 1 won't see this)...");
await sender2.send('orders', { orderId: 104, item: 'Thingamajig' });

await new Promise(resolve => setTimeout(resolve, 100));

// Cleanup
console.log('\n🧹 Cleaning up...');
await receiver.stop();
await sender1.close();
await sender2.close();
await conduit.close();

console.log('✓ Done!');
