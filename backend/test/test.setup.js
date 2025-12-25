// test/test.setup.js - 集成测试全局配置
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'hospital_test';
process.env.JWT_SECRET = 'test_jwt_secret_123';

const db = require('../db');

// 强制禁用 MQ
process.env.MQ_DISABLED = 'true';

// 覆盖 mq 模块
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id.includes('mq/index') || id.includes('mq/publisher')) {
    return {
      connect: () => ({ connection: null, channel: null }),
      publish: () => Promise.resolve(true),
      publishOrderEvent: () => Promise.resolve(true),
      subscribe: () => 'disabled-queue',
      ensureQueue: () => 'disabled-queue',
      close: () => {}
    };
  }
  return originalRequire.apply(this, arguments);
};

console.log('🔧 测试环境已设置，MQ已禁用');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  DB_NAME:', process.env.DB_NAME);
console.log('  MQ_DISABLED:', process.env.MQ_DISABLED);

// 全局测试钩子
beforeAll(async () => {
  console.log('🔧 设置测试环境...');
  // 可以在这里初始化测试数据库
});

afterAll(async () => {
  console.log('🧹 清理测试环境...');
  await db.end();
});

// 测试数据库连接
describe('数据库连接测试', () => {
  test('应该能连接到测试数据库', async () => {
    const [result] = await db.execute('SELECT DATABASE() as db_name');
    expect(result[0].db_name).toBe('hospital_test');
  });
});

// 确保MQ在测试环境完全禁用
jest.mock('../mq/publisher', () => ({
  publishOrderEvent: jest.fn().mockResolvedValue(true)
}));

// 覆盖mq/index模块
jest.mock('../mq/index', () => ({
  connect: jest.fn().mockResolvedValue({ connection: null, channel: null }),
  publish: jest.fn().mockResolvedValue(true),
  subscribe: jest.fn().mockReturnValue('disabled-queue'),
  ensureQueue: jest.fn().mockReturnValue('disabled-queue'),
  close: jest.fn()
}));

console.log('✅ MQ已完全禁用（Jest Mock）');