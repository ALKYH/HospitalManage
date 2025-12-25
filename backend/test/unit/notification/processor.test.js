const path = require('path');
const sinon = require('sinon');
const { expect } = require('chai');

describe('notification-service processor', () => {
  let smtpStub, redisStub, mqStub, dbCalls;

  beforeEach(() => {
    dbCalls = [];

    // stub smtp provider：替换 SMTP 提供者为测试桩
    smtpStub = { send: sinon.stub().resolves() };
    const smtpPath = path.resolve(__dirname, '../../../notification-service/providers/smtp.js');
    require.cache[smtpPath] = { id: smtpPath, filename: smtpPath, exports: smtpStub };

    // stub redis provider：替换 Redis 提供者为测试桩
    redisStub = { setIfNotExists: sinon.stub().resolves(true) };
    const redisPath = path.resolve(__dirname, '../../../notification-service/providers/redis.js');
    require.cache[redisPath] = { id: redisPath, filename: redisPath, exports: redisStub };

    // stub mqClient（用于捕获发布事件）
    mqStub = { publish: sinon.stub().resolves(), connect: sinon.stub().resolves(), subscribe: sinon.stub().resolves() };
    const mqPath = path.resolve(__dirname, '../../../notification-service/mqClient.js');
    require.cache[mqPath] = { id: mqPath, filename: mqPath, exports: mqStub };

    // stub dbClient（简单记录 SQL 调用）
    const dbStub = {
      query: async function(sql, params) {
        dbCalls.push({ sql, params });
        if (/INSERT INTO notifications/i.test(sql)) {
          return [{ insertId: 123 }];
        }
        return [{}];
      }
    };
    const dbPath = path.resolve(__dirname, '../../../notification-service/dbClient.js');
    require.cache[dbPath] = { id: dbPath, filename: dbPath, exports: dbStub };
  });

  afterEach(() => {
    // 清理注入到 require.cache 中的测试桩模块
    const injected = [
      '../../../notification-service/providers/smtp.js',
      '../../../notification-service/providers/redis.js',
      '../../../notification-service/mqClient.js',
      '../../../notification-service/dbClient.js'
    ].map(p => path.resolve(__dirname, p));
    injected.forEach(p => { try { delete require.cache[p]; } catch (e) {} });
    sinon.restore();
  });

  it('sends email when recipient has email', async () => {
    const processor = require('../../../notification-service/processor');

    const payload = {
      patientId: 1,
      patientName: 'Alice',
      patientEmail: 'alice@example.com',
      appointmentId: 'a1',
      clinicTime: '2025-12-20 09:00',
      doctorName: 'Dr. Who'
    };

    await processor.processEvent('appointment.created', payload);

    // 应当调用 smtp.send 发送邮件
    const smtpPath = path.resolve(__dirname, '../../../notification-service/providers/smtp.js');
    const smtp = require.cache[smtpPath].exports;
    expect(smtp.send.called).to.be.true;

    // 数据库中应该有一条 INSERT notifications 记录
    const insertCall = dbCalls.find(c => /INSERT INTO notifications/i.test(c.sql));
    expect(insertCall).to.exist;
  });

  it('skips email send when no email and marks skipped', async () => {
    // 覆盖 redis 行为，以便允许去重逻辑正常执行
    const processor = require('../../../notification-service/processor');

    const payload = {
      patientId: 2,
      patientName: 'Bob',
      appointmentId: 'b1'
    };

    await processor.processEvent('appointment.created', payload);

    const smtpPath = path.resolve(__dirname, '../../../notification-service/providers/smtp.js');
    const smtp = require.cache[smtpPath].exports;
    expect(smtp.send.called).to.be.false;

    // 期望先插入一条记录，然后将状态更新为 skipped（检查 UPDATE SQL）
    const updateCall = dbCalls.find(c => /UPDATE notifications SET status/i.test(c.sql));
    // 这里可能将状态更新为 'skipped'
    expect(updateCall).to.exist;
  });
});
