const { expect, sinon, restoreStubs } = require('../../setup');
const patientService = require('../../../services/patientService');
const db = require('../../../db');

describe('patientService', () => {
  let stubs = [];

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  describe('getProfileByAccountId', () => {
    it('should return profile if found', async () => {
      const profile = { id: 1, account_id: 100, display_name: 'John Doe' };
      const queryStub = sinon.stub(db, 'query').resolves([ [profile] ]);
      stubs.push(queryStub);

      const result = await patientService.getProfileByAccountId(100);

      expect(queryStub.calledWith('SELECT * FROM profiles WHERE account_id = ?', [100])).to.be.true;
      expect(result).to.deep.equal(profile);
    });

    it('should return null if not found', async () => {
      const queryStub = sinon.stub(db, 'query').resolves([ [] ]);
      stubs.push(queryStub);

      const result = await patientService.getProfileByAccountId(999);

      expect(result).to.be.null;
    });
  });

  describe('verifyAgainstStaffList', () => {
    // verifyAgainstStaffList 使用一个静态 JSON 职工名单，可以直接基于真实文件中的数据进行校验
    // 也可以通过 mock require 实现，但如果不用 proxyquire 之类的库会比较麻烦
    // 该函数逻辑本身很简单：检查输入是否匹配名单中的任意一条记录
    // 这里假定职工名单已经正常加载，主要验证逻辑分支
    // 为了稳健起见，可以认为名单可能有数据，也可能为空
    // 在单元测试中，我们不改动真实文件，而是重点测试未匹配到数据时的返回结果
    
    it('should return false if input is incomplete', () => {
      expect(patientService.verifyAgainstStaffList({})).to.be.false;
      expect(patientService.verifyAgainstStaffList({ name: 'A' })).to.be.false;
    });

    it('should return false if no match found', () => {
      const input = { employeeId: '999999', name: 'NoSuchPerson', idNumber: '000000' };
      expect(patientService.verifyAgainstStaffList(input)).to.be.false;
    });
  });

  describe('saveProfile', () => {
    it('should insert new profile if not exists', async () => {
      const queryStub = sinon.stub(db, 'query');
      
      // 1. getProfileByAccountId -> 返回空结果（不存在档案）
      queryStub.onCall(0).resolves([ [] ]);
      
      // 2. 执行 INSERT 插入新档案
      queryStub.onCall(1).resolves([{ insertId: 123 }]);
      
      // 3. 再次 SELECT 读取新创建的档案
      const newProfile = { id: 123, account_id: 1, display_name: 'Jane Doe' };
      queryStub.onCall(2).resolves([ [newProfile] ]);
      
      stubs.push(queryStub);

      const payload = { display_name: 'Jane Doe', phone: '1234567890' };
      const result = await patientService.saveProfile(1, payload);

      expect(queryStub.callCount).to.equal(3);
      expect(queryStub.firstCall.args[1]).to.deep.equal([1]); // 校验第一次调用是否按 account_id 查询是否存在
      expect(queryStub.secondCall.args[0]).to.include('INSERT INTO profiles');
      expect(result).to.deep.equal(newProfile);
    });

    it('should update profile if exists', async () => {
      const queryStub = sinon.stub(db, 'query');
      
      // 1. getProfileByAccountId -> 返回已存在的档案
      const existing = { id: 123, account_id: 1, display_name: 'Old Name' };
      queryStub.onCall(0).resolves([ [existing] ]);
      
      // 2. 执行 UPDATE 更新档案
      queryStub.onCall(1).resolves([{ affectedRows: 1 }]);
      
      // 3. 再次 SELECT 读取更新后的档案
      const updatedProfile = { id: 123, account_id: 1, display_name: 'New Name' };
      queryStub.onCall(2).resolves([ [updatedProfile] ]);
      
      stubs.push(queryStub);

      const payload = { display_name: 'New Name' };
      const result = await patientService.saveProfile(1, payload);

      expect(queryStub.callCount).to.equal(3);
      expect(queryStub.secondCall.args[0]).to.include('UPDATE profiles SET');
      expect(result).to.deep.equal(updatedProfile);
    });

    it('should truncate long fields', async () => {
      const queryStub = sinon.stub(db, 'query');
      queryStub.onCall(0).resolves([ [] ]); // 档案不存在
      queryStub.onCall(1).resolves([{ insertId: 124 }]);
      queryStub.onCall(2).resolves([ [{ id: 124 }] ]);
      stubs.push(queryStub);

      const longName = 'a'.repeat(200); // 超过长度限制 100 的显示名
      await patientService.saveProfile(2, { display_name: longName });

      const insertArgs = queryStub.secondCall.args[1];
      // display_name 是参数数组中的第二个值（索引 1）
      expect(insertArgs[1].length).to.equal(100);
    });

  });
});
