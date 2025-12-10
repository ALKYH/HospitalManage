const { expect, sinon } = require('../setup');
const registrationService = require('../../services/registrationService');
const db = require('../../db');
const mqPublisher = require('../../mq/publisher');

describe('registrationService - 挂号服务测试', () => {
  let stubs = [];
  
  beforeEach(() => {
    stubs = [];
    sinon.restore();
  });
  
  afterEach(() => {
    stubs.forEach(stub => stub.restore && stub.restore());
    stubs = [];
  });
  
  // 辅助函数
  const createMockConnection = () => ({
    beginTransaction: sinon.stub().resolves(),
    commit: sinon.stub().resolves(),
    rollback: sinon.stub().resolves(),
    release: sinon.stub().resolves(),
    query: sinon.stub()
  });
  
  // 1. 常规挂号测试
  describe('createRegistration - 创建挂号', () => {
    it('库存充足时应创建确认订单', async () => {
      const payload = {
        account_id: 100,
        department_id: 1,
        doctor_id: 1,
        date: '2025-11-27',
        slot: '8-10',
        note: '测试'
      };
      
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
      
      mockConn.query
        .onCall(0).resolves([[{ id: 1, capacity: 10, booked: 5 }]]) // 查询号源
        .onCall(1).resolves([{ affectedRows: 1 }]) // 更新库存
        .onCall(2).resolves([{ insertId: 100 }]) // 插入订单
        .onCall(3).resolves([[{ id: 100, status: 'confirmed', is_waitlist: false }]]); // 查询订单
      
      const result = await registrationService.createRegistration(payload);
      
      expect(result.status).to.equal('confirmed');
      expect(result.is_waitlist).to.be.false;
      expect(mockConn.commit.calledOnce).to.be.true;
    });
    
    it('库存不足时应创建候补订单', async () => {
      const payload = {
        account_id: 101,
        department_id: 1,
        doctor_id: 1,
        date: '2025-11-27',
        slot: '8-10',
        note: '测试'
      };
      
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
      
      mockConn.query
        .onCall(0).resolves([[{ id: 1, capacity: 10, booked: 10 }]]) // 已满
        .onCall(1).resolves([{ insertId: 101 }]) // 插入订单
        .onCall(2).resolves([[{ id: 101, status: 'waiting', is_waitlist: true }]]);
      
      const result = await registrationService.createRegistration(payload);
      
      expect(result.status).to.equal('waiting');
      expect(result.is_waitlist).to.be.true;
    });
    
    it('强制候补时应创建候补订单', async () => {
      const payload = {
        account_id: 102,
        department_id: 1,
        doctor_id: 1,
        date: '2025-11-27',
        slot: '8-10',
        note: '测试',
        force_waitlist: true
      };
      
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
      
      mockConn.query
        .onCall(0).resolves([[{ id: 1, capacity: 10, booked: 5 }]])
        .onCall(1).resolves([{ insertId: 102 }])
        .onCall(2).resolves([[{ id: 102, status: 'waiting', is_waitlist: true }]]);
      
      const result = await registrationService.createRegistration(payload);
      
      expect(result.status).to.equal('waiting');
      expect(result.is_waitlist).to.be.true;
    });
  });
  
  // 2. 取消订单测试
  describe('cancelRegistration - 取消挂号', () => {
    it('取消确认订单应减少库存并提升候补', async () => {
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
      
      mockConn.query
        .onCall(0).resolves([[{ id: 200, doctor_id: 1, date: '2025-11-27', status: 'confirmed' }]]) // 查询订单
        .onCall(1).resolves([{ affectedRows: 1 }]) // 更新订单状态
        .onCall(2).resolves([[{ booked: 6 }]]) // 查询库存
        .onCall(3).resolves([{ affectedRows: 1 }]) // 减少库存
        .onCall(4).resolves([[{ id: 300, status: 'waiting', is_waitlist: true }]]) // 查询候补
        .onCall(5).resolves([{ affectedRows: 1 }]) // 提升候补
        .onCall(6).resolves([{ affectedRows: 1 }]) // 恢复库存
        .onCall(7).resolves([[{ id: 300, status: 'confirmed' }]]); // 查询提升后的订单
      
      const result = await registrationService.cancelRegistration(200, 'patient');
      
      expect(result.success).to.be.true;
      expect(mockConn.commit.calledOnce).to.be.true;
    });
    
    it('取消候补订单不应影响库存', async () => {
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
      
      mockConn.query
        .onCall(0).resolves([[{ id: 301, status: 'waiting', is_waitlist: true }]])
        .onCall(1).resolves([{ affectedRows: 1 }]);
      
      const result = await registrationService.cancelRegistration(301, 'patient');
      
      expect(result.success).to.be.true;
      // 只有2次查询，没有库存操作
      expect(mockConn.query.callCount).to.equal(2);
    });
    
    it('取消已取消订单应幂等返回', async () => {
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      
      mockConn.query
        .onCall(0).resolves([[{ id: 302, status: 'cancelled' }]]);
      
      const result = await registrationService.cancelRegistration(302, 'patient');
      
      expect(result.status).to.equal('cancelled');
      expect(mockConn.commit.calledOnce).to.be.true;
    });
  });
  
  // 3. 订单一致性测试
  describe('订单一致性', () => {
    it('取消订单后库存应保持正确', async () => {
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
      
      const initialBooked = 5;
      
      mockConn.query
        .onCall(0).resolves([[{ id: 400, doctor_id: 1, date: '2025-11-27', status: 'confirmed' }]])
        .onCall(1).resolves([{ affectedRows: 1 }])
        .onCall(2).resolves([[{ booked: initialBooked }]])
        .onCall(3).resolves([{ affectedRows: 1 }]) // 减少到4
        .onCall(4).resolves([[{ id: 401, status: 'waiting' }]])
        .onCall(5).resolves([{ affectedRows: 1 }])
        .onCall(6).resolves([{ affectedRows: 1 }]) // 增加到5
        .onCall(7).resolves([[{ id: 401, status: 'confirmed' }]]);
      
      await registrationService.cancelRegistration(400, 'patient');
      
      // 验证库存先减后加，最终不变
      expect(mockConn.query.getCall(3).args[1][0]).to.equal(initialBooked - 1); // 4
      expect(mockConn.query.getCall(6).args[1][0]).to.equal(initialBooked); // 5
    });
    
    it('没有候补时取消订单只减少库存', async () => {
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
      
      mockConn.query
        .onCall(0).resolves([[{ id: 500, doctor_id: 1, date: '2025-11-27', status: 'confirmed' }]])
        .onCall(1).resolves([{ affectedRows: 1 }])
        .onCall(2).resolves([[{ booked: 3 }]])
        .onCall(3).resolves([{ affectedRows: 1 }])
        .onCall(4).resolves([[]]); // 没有候补
      
      const result = await registrationService.cancelRegistration(500, 'patient');
      
      expect(result.success).to.be.true;
      expect(mockConn.query.callCount).to.equal(5);
    });
  });
  
  // 4. 错误处理测试
  describe('错误处理', () => {
    it('订单不存在时应抛出错误', async () => {
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      
      mockConn.query.onCall(0).resolves([[]]);
      
      try {
        await registrationService.cancelRegistration(999, 'patient');
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('order not found');
        expect(mockConn.rollback.calledOnce).to.be.true;
      }
    });
    
    it('事务失败时应回滚', async () => {
      const payload = {
        account_id: 600,
        department_id: 1,
        doctor_id: 1,
        date: '2025-11-27',
        slot: '8-10',
        note: '测试'
      };
      
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      
      mockConn.query
        .onCall(0).resolves([[{ id: 1, capacity: 10, booked: 5 }]])
        .onCall(1).rejects(new Error('更新失败'));
      
      try {
        await registrationService.createRegistration(payload);
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('更新失败');
        expect(mockConn.rollback.calledOnce).to.be.true;
      }
    });
  });
  
  // 5. 简单并发场景
  describe('简单并发场景', () => {
    it('两个用户同时挂号应都能成功', async () => {
      const mockConn1 = createMockConnection();
      const mockConn2 = createMockConnection();
      
      let callCount = 0;
      stubs.push(sinon.stub(db, 'getConnection').callsFake(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? mockConn1 : mockConn2);
      }));
      
      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
      
      // 用户1看到 booked=5
      mockConn1.query
        .onCall(0).resolves([[{ id: 1, capacity: 10, booked: 5 }]])
        .onCall(1).resolves([{ affectedRows: 1 }])
        .onCall(2).resolves([{ insertId: 700 }])
        .onCall(3).resolves([[{ id: 700, status: 'confirmed' }]]);
      
      // 用户2看到 booked=6（已增加）
      mockConn2.query
        .onCall(0).resolves([[{ id: 1, capacity: 10, booked: 6 }]])
        .onCall(1).resolves([{ affectedRows: 1 }])
        .onCall(2).resolves([{ insertId: 701 }])
        .onCall(3).resolves([[{ id: 701, status: 'confirmed' }]]);
      
      const payload = {
        account_id: 700,
        department_id: 1,
        doctor_id: 1,
        date: '2025-11-27',
        slot: '8-10',
        note: '测试'
      };
      
      const payload2 = { ...payload, account_id: 701 };
      
      const result1 = await registrationService.createRegistration(payload);
      const result2 = await registrationService.createRegistration(payload2);
      
      expect(result1.status).to.equal('confirmed');
      expect(result2.status).to.equal('confirmed');
    });
  });
});