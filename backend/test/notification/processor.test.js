const path = require('path');
const sinon = require('sinon');
const { expect } = require('chai');

describe('notification-service processor', () => {
  let smtpStub, redisStub, mqStub, dbCalls;

  beforeEach(() => {
    dbCalls = [];

    // stub smtp provider
    smtpStub = { send: sinon.stub().resolves() };
    const smtpPath = path.resolve(__dirname, '../../notification-service/providers/smtp.js');
    require.cache[smtpPath] = { id: smtpPath, filename: smtpPath, exports: smtpStub };

    // stub redis provider
    redisStub = { setIfNotExists: sinon.stub().resolves(true) };
    const redisPath = path.resolve(__dirname, '../../notification-service/providers/redis.js');
    require.cache[redisPath] = { id: redisPath, filename: redisPath, exports: redisStub };

    // stub mqClient (capture publishes)
    mqStub = { publish: sinon.stub().resolves(), connect: sinon.stub().resolves(), subscribe: sinon.stub().resolves() };
    const mqPath = path.resolve(__dirname, '../../notification-service/mqClient.js');
    require.cache[mqPath] = { id: mqPath, filename: mqPath, exports: mqStub };

    // stub dbClient (simple recorder)
    const dbStub = {
      query: async function(sql, params) {
        dbCalls.push({ sql, params });
        if (/INSERT INTO notifications/i.test(sql)) {
          return [{ insertId: 123 }];
        }
        return [{}];
      }
    };
    const dbPath = path.resolve(__dirname, '../../notification-service/dbClient.js');
    require.cache[dbPath] = { id: dbPath, filename: dbPath, exports: dbStub };
  });

  afterEach(() => {
    // clear injected modules from cache
    const injected = [
      '../../notification-service/providers/smtp.js',
      '../../notification-service/providers/redis.js',
      '../../notification-service/mqClient.js',
      '../../notification-service/dbClient.js'
    ].map(p => path.resolve(__dirname, p));
    injected.forEach(p => { try { delete require.cache[p]; } catch (e) {} });
    sinon.restore();
  });

  it('sends email when recipient has email', async () => {
    const processor = require('../../notification-service/processor');

    const payload = {
      patientId: 1,
      patientName: 'Alice',
      patientEmail: 'alice@example.com',
      appointmentId: 'a1',
      clinicTime: '2025-12-20 09:00',
      doctorName: 'Dr. Who'
    };

    await processor.processEvent('appointment.created', payload);

    // smtp send should be called
    const smtpPath = path.resolve(__dirname, '../../notification-service/providers/smtp.js');
    const smtp = require.cache[smtpPath].exports;
    expect(smtp.send.called).to.be.true;

    // there should be an INSERT into notifications
    const insertCall = dbCalls.find(c => /INSERT INTO notifications/i.test(c.sql));
    expect(insertCall).to.exist;
  });

  it('skips email send when no email and marks skipped', async () => {
    // override redis to allow dedup
    const processor = require('../../notification-service/processor');

    const payload = {
      patientId: 2,
      patientName: 'Bob',
      appointmentId: 'b1'
    };

    await processor.processEvent('appointment.created', payload);

    const smtpPath = path.resolve(__dirname, '../../notification-service/providers/smtp.js');
    const smtp = require.cache[smtpPath].exports;
    expect(smtp.send.called).to.be.false;

    // expect an insert then an update to 'skipped' (update SQL recorded)
    const updateCall = dbCalls.find(c => /UPDATE notifications SET status/i.test(c.sql));
    // It may update to 'skipped'
    expect(updateCall).to.exist;
  });
});
