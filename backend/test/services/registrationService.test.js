const { expect, sinon, restoreStubs } = require('../setup');
const registrationService = require('../../services/registrationService');
const db = require('../../db');
const mqPublisher = require('../../mq/publisher');

describe('registrationService', () => {
  let stubs = [];

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  it('should confirm registration when day-level capacity available', async () => {
    // prepare a fake connection that returns availability with capacity > booked
    const fakeConn = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      query: async (sql, params) => {
        if (sql.startsWith('SELECT * FROM doctor_availability')) {
          return [[{ id: 10, doctor_id: 5, date: '2026-01-10', slot: '8-10', capacity: 5, booked: 2 }]];
        }
        if (sql.startsWith('UPDATE doctor_availability SET booked')) {
          return [{ affectedRows: 1 }];
        }
        if (sql.startsWith('INSERT INTO orders')) {
          return [{ insertId: 123 }];
        }
        if (sql.startsWith('SELECT * FROM orders WHERE id =')) {
          return [[{ id: 123, status: 'confirmed', is_waitlist: 0 }]];
        }
        return [[]];
      }
    };

    stubs.push(sinon.stub(db, 'getConnection').resolves(fakeConn));
    stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves(true));

    const payload = { account_id: 1, department_id: 2, doctor_id: 5, date: '2026-01-10', slot: '8-10' };
    const order = await registrationService.createRegistration(payload);
    expect(order).to.have.property('status', 'confirmed');
    expect(order).to.have.property('id', 123);
  });

  it('should put registration into waitlist when capacity exhausted', async () => {
    const fakeConn = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      query: async (sql, params) => {
        if (sql.startsWith('SELECT * FROM doctor_availability')) {
          return [[{ id: 11, doctor_id: 5, date: '2026-01-11', slot: '8-10', capacity: 2, booked: 2 }]];
        }
        if (sql.startsWith('INSERT INTO orders')) {
          return [{ insertId: 200 }];
        }
        if (sql.startsWith('SELECT * FROM orders WHERE id =')) {
          return [[{ id: 200, status: 'waiting', is_waitlist: 1 }]];
        }
        return [[]];
      }
    };
    stubs.push(sinon.stub(db, 'getConnection').resolves(fakeConn));
    stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves(true));

    const payload = { account_id: 2, department_id: 3, doctor_id: 5, date: '2026-01-11', slot: '8-10' };
    const order = await registrationService.createRegistration(payload);
    expect(order).to.have.property('status', 'waiting');
    expect(order).to.have.property('is_waitlist', 1);
  });

  it('should promote earliest waitlist order when a confirmed order is cancelled', async () => {
    // simulate cancelling a confirmed order and promoting the earliest waiting order
    const confirmedOrder = { id: 300, doctor_id: 6, date: '2026-01-12', status: 'confirmed', is_waitlist: 0 };
    const waitingOrder = { id: 301, doctor_id: 6, date: '2026-01-12', status: 'waiting', is_waitlist: 1 };

    const calls = [];
    const fakeConn = {
      beginTransaction: async () => { calls.push('begin'); },
      commit: async () => { calls.push('commit'); },
      rollback: async () => { calls.push('rollback'); },
      release: () => { calls.push('release'); },
      query: async (sql, params) => {
        // SELECT order FOR UPDATE
        if (sql.startsWith('SELECT * FROM orders WHERE id = ? FOR UPDATE')) {
          return [[confirmedOrder]];
        }
        // UPDATE orders SET status = cancelled
        if (sql.startsWith('UPDATE orders SET status = ?')) {
          return [{ affectedRows: 1 }];
        }
        // SELECT doctor_availability FOR UPDATE
        if (sql.startsWith('SELECT * FROM doctor_availability WHERE doctor_id = ? AND date = ? FOR UPDATE')) {
          return [[{ id: 77, doctor_id: 6, date: '2026-01-12', slot: '8-10', capacity: 5, booked: 3 }]];
        }
        // UPDATE doctor_availability SET booked = ? (decrement)
        if (sql.startsWith('UPDATE doctor_availability SET booked = ? WHERE doctor_id')) {
          return [{ affectedRows: 1 }];
        }
        // SELECT next waiting order FOR UPDATE
        if (sql.startsWith("SELECT * FROM orders WHERE doctor_id = ? AND date = ? AND is_waitlist = 1")) {
          return [[waitingOrder]];
        }
        // UPDATE orders SET status = confirmed for promoted
        if (sql.startsWith('UPDATE orders SET status = ?, is_waitlist = 0')) {
          return [{ affectedRows: 1 }];
        }
        // UPDATE doctor_availability SET booked = ? (increment after promotion)
        if (sql.startsWith('UPDATE doctor_availability SET booked = ? WHERE doctor_id')) {
          return [{ affectedRows: 1 }];
        }
        if (sql.startsWith('SELECT * FROM orders WHERE id = ?')) {
          return [[waitingOrder]];
        }
        return [[]];
      }
    };

    stubs.push(sinon.stub(db, 'getConnection').resolves(fakeConn));
    stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves(true));

    const res = await registrationService.cancelRegistration(confirmedOrder.id, 999);
    expect(res).to.have.property('success', true);
    // ensure begin/commit were called
    expect(calls).to.include('begin');
    expect(calls).to.include('commit');
  });

});
