const { expect, sinon, restoreStubs } = require('../../setup');
const doctorService = require('../../../services/doctorService');
const db = require('../../../db');

describe('doctorService', () => {
  let stubs = [];

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  it('maps availability rows and computes available_by_type from extra', async () => {
    const sampleRow = {
      id: 1,
      doctor_id: 2,
      date: '2025-11-27',
      slot: '8-10',
      capacity: 5,
      booked: 2,
      extra: JSON.stringify({ capacity_types: { 普通: 3, 专家: 2 }, booked_types: { 普通: 1, 专家: 1 } })
    };
    // 使用 stub 拦截 db.query，返回模拟的排班数据
    stubs.push(sinon.stub(db, 'query').resolves([[sampleRow]]));

    const result = await doctorService.getAvailabilityByDoctor(2, '2025-11-27');
    expect(result).to.be.an('array').with.length(1);
    const mapped = result[0];
    expect(mapped).to.have.property('available_by_type');
    expect(mapped.available_by_type['普通']).to.equal(2); // 3 - 1：普通号 剩余 2 个
    expect(mapped.available_by_type['专家']).to.equal(1); // 2 - 1：专家号 剩余 1 个
  });

  it('falls back to default when extra missing', async () => {
    const sampleRow = {
      id: 2,
      doctor_id: 3,
      date: '2025-11-28',
      slot: '10-12',
      capacity: 4,
      booked: 1,
      extra: null
    };
    stubs.push(sinon.stub(db, 'query').resolves([[sampleRow]]));
    const result = await doctorService.getAvailabilityByDoctor(3, '2025-11-28');
    expect(result).to.be.an('array').with.length(1);
    const mapped = result[0];
    expect(mapped.available_by_type['默认']).to.equal(3);
  });

});
