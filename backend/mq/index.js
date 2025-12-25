let amqp;
let MQ_DISABLED = false;
//const MQ_DISABLED = process.env.NODE_ENV === 'test' || false;
try {
  amqp = require('amqplib');
} catch (err) {
  console.warn('amqplib not found. MQ functionality will be disabled. Install amqplib to enable MQ.');
  MQ_DISABLED = true;
}

const MQ_URL = process.env.MQ_URL || 'amqp://guest:guest@localhost:5672';

let connection = null;
let channel = null;
let confirmChannel = null;

async function connect() {
  if (MQ_DISABLED) {
    console.warn('MQ connect skipped because MQ is disabled');
    return { connection: null, channel: null };
  }
  //  if (MQ_DISABLED) {
  //   console.log('MQ功能已禁用（测试环境）');
  //   return null;
  // }

  if (connection && channel) return { connection, channel };

  const maxRetries = parseInt(process.env.MQ_CONNECT_RETRIES || '10');
  const baseDelay = parseInt(process.env.MQ_CONNECT_BASE_DELAY_MS || '1000');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      connection = await amqp.connect(MQ_URL);
      channel = await connection.createChannel();
      // 确认通道用于 publisher confirms
      try {
        confirmChannel = await connection.createConfirmChannel();
      } catch (e) {
        console.warn('Confirm channel not available, falling back to regular channel', e.message);
        confirmChannel = null;
      }
      // 默认声明一个 topic exchange 用于事件广播
      await channel.assertExchange('hospital.events', 'topic', { durable: true });
      if (confirmChannel) await confirmChannel.assertExchange('hospital.events', 'topic', { durable: true });
      console.log('MQ connected to', MQ_URL);
      return { connection, channel };
    } catch (err) {
      const last = attempt === maxRetries;
      console.warn(`MQ connect attempt ${attempt + 1}/${maxRetries + 1} failed: ${err.message}`);
      if (last) {
        console.error('MQ connection failed after retries, disabling MQ functionality');
        MQ_DISABLED = true;
        // Clean up any partial state
        connection = null;
        channel = null;
        confirmChannel = null;
        return { connection: null, channel: null };
      }
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function ensureQueue(queueName, opts = {}) {
  if (MQ_DISABLED) return queueName;
  if (!channel) await connect();
  await channel.assertQueue(queueName, opts);
  return queueName;
}

async function bindQueue(queueName, exchange, routingKey) {
  if (MQ_DISABLED) return;
  if (!channel) await connect();
  await channel.bindQueue(queueName, exchange, routingKey);
}

async function publish(routingKey, message, options = {}) {
  // if (MQ_DISABLED) {
  //   console.warn('MQ publish skipped (disabled). routingKey=', routingKey);
  //   return true;
  // }
  if (MQ_DISABLED) {
    console.log(`[模拟MQ] 发布消息到 ${queue}:`, message);
    return true;
  }
  if (!channel) await connect();
  const payload = Buffer.from(JSON.stringify(message || {}));
  // 如果存在 confirmChannel，使用 confirm publish 并返回 promise
  if (confirmChannel) {
    return new Promise((resolve, reject) => {
      try {
        confirmChannel.publish('hospital.events', routingKey, payload, Object.assign({ persistent: true }, options), (err) => {
          if (err) return reject(err);
          return resolve(true);
        });
      } catch (err) {
        return reject(err);
      }
    });
  }
  // fallback: 普通 publish（不保证交付）
  return channel.publish('hospital.events', routingKey, payload, Object.assign({ persistent: true }, options));
}
// async function publish(routingKey, message, options = {}) {
//   if (MQ_DISABLED) {
//     console.log(`[模拟MQ] 发布消息到 ${routingKey}:`, typeof message === 'object' ? JSON.stringify(message).substring(0, 100) : message);
//     return true; // 在测试环境直接返回成功
//   }
  
//   if (!channel) await connect();
//   if (MQ_DISABLED || !channel) {
//     console.log(`[模拟MQ] MQ已禁用，跳过发布到 ${routingKey}`);
//     return true;
//   }
  
//   const payload = Buffer.from(JSON.stringify(message || {}));
  
//   if (confirmChannel) {
//     return new Promise((resolve, reject) => {
//       try {
//         confirmChannel.publish('hospital.events', routingKey, payload, 
//           Object.assign({ persistent: true }, options), 
//           (err) => err ? reject(err) : resolve(true)
//         );
//       } catch (err) {
//         reject(err);
//       }
//     });
//   }
  
//   return channel.publish('hospital.events', routingKey, payload, 
//     Object.assign({ persistent: true }, options)
//   );
// }

async function subscribe(bindingKey, handler, opts = {}) {
  // If MQ disabled, return a no-op queue name
  if (MQ_DISABLED) {
    console.warn('MQ subscribe skipped (disabled) for bindingKey=', bindingKey);
    return `disabled:${bindingKey}`;
  }
  // 创建独立的匿名队列并绑定到 exchange
  if (!channel) await connect();
  const q = await channel.assertQueue('', { exclusive: true });
  await channel.bindQueue(q.queue, 'hospital.events', bindingKey);
  await channel.consume(q.queue, async (msg) => {
    if (msg !== null) {
      try {
        const body = JSON.parse(msg.content.toString());
        await handler(body, { routingKey: msg.fields.routingKey, msg });
        channel.ack(msg);
      } catch (err) {
        console.error('MQ handler error for', bindingKey, err);
        // Nack -> requeue false to avoid poison messages; real app should implement DLX
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
    console.warn('Error closing MQ', err.message);
  } finally {
    channel = null;
    connection = null;
  }
}

module.exports = { connect, publish, subscribe, ensureQueue, bindQueue, close };
