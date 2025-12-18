const amqp = require('amqplib');

const MQ_URL = process.env.MQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const EXCHANGE = process.env.MQ_EXCHANGE || 'hospital.events';

let connection = null;
let channel = null;

async function connect() {
  if (channel && connection) return { connection, channel };
  connection = await amqp.connect(MQ_URL);
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  return { connection, channel };
}

async function publish(routingKey, message, options = {}) {
  if (!channel) await connect();
  const payload = Buffer.from(JSON.stringify(message || {}));
  return channel.publish(EXCHANGE, routingKey, payload, Object.assign({ persistent: true }, options));
}

async function subscribe(bindingKey, handler, opts = {}) {
  if (!channel) await connect();
  const q = await channel.assertQueue('', { exclusive: true });
  await channel.bindQueue(q.queue, EXCHANGE, bindingKey);
  await channel.consume(q.queue, async (msg) => {
    if (msg !== null) {
      try {
        const body = JSON.parse(msg.content.toString());
        await handler(body, { routingKey: msg.fields.routingKey, msg });
        channel.ack(msg);
      } catch (err) {
        console.error('MQ handler error for', bindingKey, err);
        channel.nack(msg, false, false);
      }
    }
  }, opts);
  return q.queue;
}

async function close() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
  } catch (err) {
    console.warn('Error closing mqClient', err.message);
  } finally {
    channel = null;
    connection = null;
  }
}

module.exports = { connect, publish, subscribe, close };
