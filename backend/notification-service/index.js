const mq = require('./mqClient');
const processor = require('./processor');

async function start() {
  console.log('Notification service starting...');

  // Subscribe to relevant event topics
  const bindings = ['appointment.*', 'waitlist.*', 'visit.*'];

  for (const b of bindings) {
    try {
      await mq.subscribe(b, async (body, meta) => {
        try {
          console.log('Received event', meta.routingKey, body.event || body.type || '');
          await processor.processEvent(meta.routingKey || body.event || body.type, body.data || body.payload || body);
        } catch (err) {
          console.error('Processor error', err);
          throw err;
        }
      });
      console.log('Subscribed to', b);
    } catch (err) {
      console.error('Failed to subscribe', b, err.message);
    }
  }

  // graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down notification service...');
    try { await mq.close(); } catch (e) {}
    process.exit(0);
  });
}

start().catch(err => {
  console.error('Notification service failed to start', err);
  process.exit(1);
});
