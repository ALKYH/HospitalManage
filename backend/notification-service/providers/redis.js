const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let client = null;

async function getClient() {
  if (client) return client;
  client = createClient({ url: REDIS_URL });
  client.on('error', (err) => console.error('Redis Client Error', err));
  await client.connect();
  return client;
}

async function setIfNotExists(key, ttlSeconds) {
  const c = await getClient();
  // SET key value NX EX ttl
  const res = await c.set(key, '1', { NX: true, EX: ttlSeconds });
  return res === 'OK';
}

async function del(key) {
  const c = await getClient();
  return c.del(key);
}

module.exports = { getClient, setIfNotExists, del };
