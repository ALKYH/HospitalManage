const { expect, sinon, restoreStubs } = require('../../setup');
const adminService = require('../../../services/adminService');
const db = require('../../../db');
const AccountModel = require('../../../schemas/accountModels');
const bcrypt = require('bcryptjs');

describe('adminService', () => {
  let stubs = [];

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  describe('Departments', () => {
    it('createDepartment inserts and returns row', async () => {
      const insertRes = { insertId: 10 };
      const row = { id: 10, name: 'Dept A' };
      const s = sinon.stub(db, 'query');
      s.onFirstCall().resolves([insertRes]);
      s.onSecondCall().resolves([[row]]);
      stubs.push(s);

      const res = await adminService.createDepartment({ name: 'Dept A' });
      expect(res).to.deep.equal(row);
      expect(s.firstCall.args[0]).to.include('INSERT INTO departments');
    });
  });

  describe('Doctors', () => {
    it('createDoctor inserts doctor and initial review', async () => {
      const insertRes = { insertId: 5 };
      const row = { id: 5, name: 'Dr. X' };
      const s = sinon.stub(db, 'query');
      s.onCall(0).resolves([insertRes]); // 第一次调用：插入医生记录
      s.onCall(1).resolves([[row]]);     // 第二次调用：查询医生记录
      s.onCall(2).resolves();            // 第三次调用：插入审核记录
      stubs.push(s);

      const res = await adminService.createDoctor({ name: 'Dr. X' });
      expect(res).to.deep.equal(row);
      expect(s.callCount).to.equal(3);
    });

    it('setDoctorPassword updates existing account', async () => {
      const doc = { id: 1, account_id: 100 };
      stubs.push(sinon.stub(db, 'query').resolves([[doc]]));
      stubs.push(sinon.stub(bcrypt, 'hash').resolves('hashed'));
      const updateStub = sinon.stub(AccountModel, 'updatePassword').resolves();
      stubs.push(updateStub);

      const res = await adminService.setDoctorPassword(1, { password: 'new' });
      expect(res.account_id).to.equal(100);
      expect(updateStub.calledWith(100, 'hashed')).to.be.true;
    });

    it('setDoctorPassword creates new account if none linked', async () => {
      const doc = { id: 2, account_id: null };
      const s = sinon.stub(db, 'query');
      s.onFirstCall().resolves([[doc]]); // 第一次调用：查询医生信息
      s.onSecondCall().resolves();       // 第二次调用：更新医生 account_id
      stubs.push(s);

      stubs.push(sinon.stub(bcrypt, 'hash').resolves('hashed'));
      stubs.push(sinon.stub(AccountModel, 'create').resolves(200));

      const res = await adminService.setDoctorPassword(2, { username: 'doc2', password: 'new' });
      expect(res.account_id).to.equal(200);
      expect(res.username).to.equal('doc2');
    });
  });

  describe('Availability', () => {
    it('createOrUpdateAvailability updates existing slot', async () => {
      const fakeConn = {
        beginTransaction: sinon.stub(),
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub(),
        query: sinon.stub()
      };
      stubs.push(sinon.stub(db, 'getConnection').resolves(fakeConn));

      // 模拟执行流程：
      // 1. SELECT ... FOR UPDATE -> 返回已存在的排班记录
      fakeConn.query.onCall(0).resolves([[{ id: 1, doctor_id: 1, date: '2025-01-01', slot: '8-10', capacity: 5 }]]);
      // 2. UPDATE 更新该时段容量和扩展信息
      fakeConn.query.onCall(1).resolves();
      // 3. UPDATE 更新按天统计的容量
      fakeConn.query.onCall(2).resolves();
      // 4. SELECT 查询所有时段信息
      fakeConn.query.onCall(3).resolves([[{ id: 1, capacity: 10 }]]);

      const res = await adminService.createOrUpdateAvailability({ doctor_id: 1, date: '2025-01-01', slot: '8-10', capacity: 10 });
      expect(res).to.be.an('array');
      expect(res[0].capacity).to.equal(10);
      expect(fakeConn.commit.called).to.be.true;
    });

    it('createOrUpdateAvailability inserts new slot when none exist', async () => {
      const fakeConn = {
        beginTransaction: sinon.stub(),
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub(),
        query: sinon.stub()
      };
      stubs.push(sinon.stub(db, 'getConnection').resolves(fakeConn));

      // 1. SELECT ... FOR UPDATE -> 未查询到记录
      fakeConn.query.onCall(0).resolves([[]]);
      // 2. INSERT 插入新的排班记录
      fakeConn.query.onCall(1).resolves([{ insertId: 99 }]);
      // 3. SELECT 查询新插入的记录
      fakeConn.query.onCall(2).resolves([[{ id: 99, capacity: 5 }]]);

      const res = await adminService.createOrUpdateAvailability({ doctor_id: 1, date: '2025-01-01', slot: '8-10', capacity: 5 });
      expect(res[0].id).to.equal(99);
    });
  });

  describe('Doctor Profile Reviews', () => {
    it('approveDoctorProfile updates status', async () => {
      const s = sinon.stub(db, 'query').resolves();
      stubs.push(s);
      
      await adminService.approveDoctorProfile(1, 10);
      // 检查是否使用状态 'approved' 调用了 UPDATE 语句
      const updateCall = s.getCalls().find(c => c.args[0].includes('UPDATE doctor_profile_reviews SET status = ?'));
      expect(updateCall).to.exist;
      expect(updateCall.args[1][0]).to.equal('approved');
    });
  });
});
