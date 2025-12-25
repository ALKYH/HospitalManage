const { expect, sinon, restoreStubs } = require('../../setup');
const request = require('supertest');
const app = require('../../../app');
const doctorService = require('../../../services/doctorService');

describe('doctorController (routes)', () => {
  let stubs = [];

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  it('GET /api/doctor/:id/availability returns mapped data', async () => {
    const fake = [{ id: 10, doctor_id: 5, date: '2025-11-27', slot: '8-10', extra: { capacity_types: { 普通: 2 }, booked_types: { 普通: 0 } } }];
    stubs.push(sinon.stub(doctorService, 'getAvailabilityByDoctor').resolves(fake));

    const res = await request(app).get('/api/doctor/5/availability');
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('success', true);
    expect(res.body.data).to.be.an('array');
  });
});
