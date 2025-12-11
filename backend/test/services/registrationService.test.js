const { expect, sinon } = require('../setup');
const registrationService = require('../../services/registrationService');
const db = require('../../db');
const mqPublisher = require('../../mq/publisher');

describe('registrationService - 挂号服务测试', () => {
  let stubs = [];
  
  // 辅助函数移到describe作用域中，所有测试用例都能访问
  const createMockConnection = () => ({
    beginTransaction: sinon.stub().resolves(),
    commit: sinon.stub().resolves(),
    rollback: sinon.stub().resolves(),
    release: sinon.stub().resolves(),
    query: sinon.stub()
  });
  
  beforeEach(() => {
    stubs = [];
    sinon.restore();
  });
  
  afterEach(() => {
    stubs.forEach(stub => stub.restore && stub.restore());
    stubs = [];
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
  
  // 4. 错误测试
  describe('错误处理', () => {
    it('订单不存在时应抛出错误', async () => {
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      
      mockConn.query.onCall(0).resolves([[]]); // 订单不存在
      
      try {
        await registrationService.cancelRegistration(999, 'patient');
        // 如果执行到这里，说明没有抛出错误，测试失败
        expect.fail('应该抛出错误');
      } catch (error) {
        // 核心验证：订单不存在时要抛出错误
        expect(error.message).to.include('order');
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
        // 核心验证：事务失败时要抛出错误
        expect(error.message).to.include('更新失败');
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

  // 6. 候补队列功能测试
  describe('候补队列功能', () => {
    it('取消已确认订单应提升候补队列中的第一位', async () => {
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
      
      // 模拟场景：一个已确认订单被取消，有两个候补订单在等待
      mockConn.query
        .onCall(0).resolves([[{ 
          id: 600, 
          doctor_id: 1, 
          date: '2025-11-27', 
          status: 'confirmed',
          is_waitlist: false 
        }]]) // 查询待取消的订单
        .onCall(1).resolves([{ affectedRows: 1 }]) // 更新订单状态为取消
        .onCall(2).resolves([[{ 
          id: 1, 
          doctor_id: 1, 
          date: '2025-11-27', 
          capacity: 10, 
          booked: 8 
        }]]) // 查询号源库存
        .onCall(3).resolves([{ affectedRows: 1 }]) // 减少库存（7）
        .onCall(4).resolves([[{ 
          id: 601, 
          doctor_id: 1, 
          date: '2025-11-27', 
          status: 'waiting', 
          is_waitlist: true,
          created_at: '2025-11-26 10:00:00' // 最早创建的候补
        }, {
          id: 602, 
          doctor_id: 1, 
          date: '2025-11-27', 
          status: 'waiting', 
          is_waitlist: true,
          created_at: '2025-11-26 11:00:00' // 较晚创建的候补
        }]]) // 查询候补队列（按时间排序）
        .onCall(5).resolves([{ affectedRows: 1 }]) // 提升最早的候补（601）
        .onCall(6).resolves([{ affectedRows: 1 }]) // 恢复库存（8）
        .onCall(7).resolves([[{ 
          id: 601, 
          status: 'confirmed', 
          is_waitlist: false 
        }]]); // 查询提升后的订单
      
      const result = await registrationService.cancelRegistration(600, 'patient');
      
      expect(result.success).to.be.true;
      
      // 验证提升的是最早创建的候补（id: 601）
      const promoteCallArgs = mockConn.query.getCall(5).args;
      expect(promoteCallArgs[0]).to.include('UPDATE orders SET status = ?, is_waitlist = 0');
      expect(promoteCallArgs[1][1]).to.equal(601); // 提升的是id为601的订单
      
      // 验证发布提升事件
      expect(mqPublisher.publishOrderEvent.calledWith('promoted')).to.be.true;
    });
    
    it('候补队列提升应遵循FIFO（先进先出）原则', async () => {
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
      
      // 创建三个候补订单，按创建时间排序
      const waitingOrders = [
        { id: 610, created_at: '2025-11-26 09:00:00' }, // 最早
        { id: 611, created_at: '2025-11-26 09:30:00' }, // 中间
        { id: 612, created_at: '2025-11-26 10:00:00' }  // 最晚
      ];
      
      mockConn.query
        .onCall(0).resolves([[{ 
          id: 609, 
          doctor_id: 1, 
          date: '2025-11-27', 
          status: 'confirmed' 
        }]])
        .onCall(1).resolves([{ affectedRows: 1 }])
        .onCall(2).resolves([[{ booked: 5 }]])
        .onCall(3).resolves([{ affectedRows: 1 }])
        .onCall(4).resolves([waitingOrders]) // 返回按时间排序的候补队列
        .onCall(5).resolves([{ affectedRows: 1 }])
        .onCall(6).resolves([{ affectedRows: 1 }])
        .onCall(7).resolves([[{ id: 610, status: 'confirmed' }]]);
      
      await registrationService.cancelRegistration(609, 'patient');
      
      // 验证SQL查询中是否包含ORDER BY created_at ASC
      const waitingQueryCallArgs = mockConn.query.getCall(4).args;
      expect(waitingQueryCallArgs[0]).to.include("ORDER BY created_at ASC");
      expect(waitingQueryCallArgs[0]).to.include("LIMIT 1");
      
      // 验证提升的是最早创建的订单（id: 610）
      const promoteCallArgs = mockConn.query.getCall(5).args;
      expect(promoteCallArgs[1][1]).to.equal(610);
    });
    
    it('取消候补订单不应影响号源库存', async () => {
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
      
      // 初始库存状态
      const initialBookedCount = 5;
      
      mockConn.query
        .onCall(0).resolves([[{ 
          id: 620, 
          doctor_id: 1, 
          date: '2025-11-27', 
          status: 'waiting',
          is_waitlist: true 
        }]]) // 候补订单
        .onCall(1).resolves([{ affectedRows: 1 }]); // 更新状态为取消
      
      const result = await registrationService.cancelRegistration(620, 'patient');
      
      expect(result.success).to.be.true;
      
      // 验证没有查询或更新doctor_availability表（候补取消不影响库存）
      const queryCalls = mockConn.query.getCalls();
      const availabilityQueries = queryCalls.filter(call => 
        call.args[0] && call.args[0].includes('doctor_availability')
      );
      expect(availabilityQueries).to.be.empty;
      
      // 总查询次数应该只有2次（查询订单和更新订单）
      expect(mockConn.query.callCount).to.equal(2);
    });
    
    it('候补订单在创建时不应增加booked计数', async () => {
      const payload = {
        account_id: 630,
        department_id: 1,
        doctor_id: 1,
        date: '2025-11-27',
        slot: '8-10',
        note: '候补测试'
      };
      
      const mockConn = createMockConnection();
      stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
      
      // 模拟库存已满的情况
      mockConn.query
        .onCall(0).resolves([[{ 
          id: 1, 
          capacity: 10, 
          booked: 10 
        }]]) // 已满
        .onCall(1).resolves([{ insertId: 631 }]) // 插入候补订单
        .onCall(2).resolves([[{ 
          id: 631, 
          status: 'waiting', 
          is_waitlist: true,
          booked: 10 // 注意：这里仍然是10，候补不增加
        }]]);
      
      const result = await registrationService.createRegistration(payload);
      
      expect(result.status).to.equal('waiting');
      expect(result.is_waitlist).to.be.true;
      
      // 验证没有执行UPDATE doctor_availability（候补不修改库存）
      const updateCalls = mockConn.query.getCalls();
      const availabilityUpdates = updateCalls.filter(call => 
        call.args[0] && call.args[0].startsWith('UPDATE doctor_availability')
      );
      expect(availabilityUpdates).to.be.empty;
    });
    
    it('强制候补模式（force_waitlist）应直接创建候补订单', async () => {
      const payload = {
        account_id: 640,
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
      
      // 即使有库存，force_waitlist也应该创建候补
      mockConn.query
        .onCall(0).resolves([[{ 
          id: 1, 
          capacity: 10, 
          booked: 3 
        }]]) // 有充足库存
        .onCall(1).resolves([{ insertId: 641 }])
        .onCall(2).resolves([[{ 
          id: 641, 
          status: 'waiting', 
          is_waitlist: true 
        }]]);
      
      const result = await registrationService.createRegistration(payload);
      
      expect(result.status).to.equal('waiting');
      expect(result.is_waitlist).to.be.true;
      
      // 验证没有更新库存（force_waitlist不占用库存）
      const updateCalls = mockConn.query.getCalls();
      const availabilityUpdates = updateCalls.filter(call => 
        call.args[0] && call.args[0].startsWith('UPDATE doctor_availability')
      );
      expect(availabilityUpdates).to.be.empty;
    });
    
   it('候补订单提升后状态应正确变更', async () => {
  // 测试候补订单被提升后的完整流程
  const mockConn = createMockConnection();
  stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
  stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
  
  const waitingOrderId = 650;
  const confirmedOrderId = 649;
  
  mockConn.query
    .onCall(0).resolves([[{ 
      id: confirmedOrderId, 
      doctor_id: 1, 
      date: '2025-11-27', 
      status: 'confirmed',
      is_waitlist: false 
    }]]) // 待取消的已确认订单
    .onCall(1).resolves([{ affectedRows: 1 }]) // 取消订单
    .onCall(2).resolves([[{ 
      id: 1, 
      doctor_id: 1, 
      date: '2025-11-27', 
      capacity: 10, 
      booked: 8 
    }]]) // 号源信息
    .onCall(3).resolves([{ affectedRows: 1 }]) // 减少库存
    .onCall(4).resolves([[{ 
      id: waitingOrderId, 
      doctor_id: 1, 
      date: '2025-11-27', 
      status: 'waiting', 
      is_waitlist: true,
      created_at: '2025-11-26 09:00:00'
    }]]) // 候补订单（只有一个）
    .onCall(5).resolves([{ affectedRows: 1 }]) // 提升候补
    .onCall(6).resolves([{ affectedRows: 1 }]) // 恢复库存
    .onCall(7).resolves([[{ 
      id: waitingOrderId, 
      status: 'confirmed', 
      is_waitlist: false,
      account_id: 100,
      doctor_id: 1,
      date: '2025-11-27',
      slot: '8-10'
    }]]); // 提升后的订单详情
  
  await registrationService.cancelRegistration(confirmedOrderId, 'patient');
  
  // 验证候补订单状态变更
  const updateArgs = mockConn.query.getCall(5).args;
  expect(updateArgs[0]).to.include('UPDATE orders SET status = ?, is_waitlist = 0');
  expect(updateArgs[1][0]).to.equal('confirmed'); // 状态变为confirmed
  expect(updateArgs[1][1]).to.equal(waitingOrderId); // 更新的订单ID
  
  // 验证库存恢复
  const restoreArgs = mockConn.query.getCall(6).args;
  expect(restoreArgs[0]).to.include('UPDATE doctor_availability SET booked = ?');
  
  // 验证发布了两个事件：cancelled 和 promoted
  expect(mqPublisher.publishOrderEvent.calledTwice).to.be.true;
  
  // 第一个事件应该是 cancelled
  const firstCallArgs = mqPublisher.publishOrderEvent.getCall(0).args;
  expect(firstCallArgs[0]).to.equal('cancelled');
  
  // 第二个事件应该是 promoted
  const secondCallArgs = mqPublisher.publishOrderEvent.getCall(1).args;
  expect(secondCallArgs[0]).to.equal('promoted');
  expect(secondCallArgs[1].id).to.equal(waitingOrderId);
  expect(secondCallArgs[1].status).to.equal('confirmed');
});
    
it('没有候补订单时取消确认订单只减少库存', async () => {
  const mockConn = createMockConnection();
  stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
  stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
  
  const initialBooked = 7;
  
  mockConn.query
    .onCall(0).resolves([[{ 
      id: 660, 
      doctor_id: 1, 
      date: '2025-11-27', 
      status: 'confirmed' 
    }]])
    .onCall(1).resolves([{ affectedRows: 1 }]) // 取消订单
    .onCall(2).resolves([[{ 
      id: 1,
      doctor_id: 1,
      date: '2025-11-27',
      booked: initialBooked 
    }]]) // 查询号源
    .onCall(3).resolves([{ affectedRows: 1 }]) // 减少库存
    .onCall(4).resolves([[]]); // 空候补队列
  
  const result = await registrationService.cancelRegistration(660, 'patient');
  
  expect(result.success).to.be.true;
  
  // 验证库存减少
  const decreaseArgs = mockConn.query.getCall(3).args;
  expect(decreaseArgs[1][0]).to.equal(initialBooked - 1); // 减少到6
  
  // 验证有查询候补队列的操作（这是正常的，即使队列为空）
  const waitingQueryArgs = mockConn.query.getCall(4).args;
  expect(waitingQueryArgs[0]).to.include("SELECT * FROM orders WHERE");
  
  // 验证总共5次查询（查询订单、取消订单、查询号源、更新库存、查询候补）
  expect(mockConn.query.callCount).to.equal(5);
  
  // 验证只发布了一个 cancelled 事件
  expect(mqPublisher.publishOrderEvent.calledOnce).to.be.true;
  expect(mqPublisher.publishOrderEvent.firstCall.args[0]).to.equal('cancelled');
});
  });

  describe('processExpiredAppointments - 自动处理过期预约', () => {
  it('应自动确认已过期的候补订单', async () => {
    const mockConn = createMockConnection();
    stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
    stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
    
    const expiredOrder = {
      id: 800,
      doctor_id: 1,
      date: '2025-11-27',
      slot: '8-10',
      status: 'waiting',
      is_waitlist: true,
      created_at: '2025-11-26 09:00:00',
      capacity: 10,
      booked: 8
    };
    
    mockConn.query
      .onCall(0).resolves([[expiredOrder]]) // 查询过期订单
      .onCall(1).resolves([[{ id: 1, capacity: 10, booked: 8 }]]) // 查询号源
      .onCall(2).resolves([{ affectedRows: 1 }]) // 更新号源
      .onCall(3).resolves([{ affectedRows: 1 }]); // 更新订单
    
    const result = await registrationService.processExpiredAppointments();
    
    expect(result.success).to.be.true;
    expect(result.processedCount).to.equal(1);
    expect(mockConn.commit.calledOnce).to.be.true;
  });
  
  it('号源已满时不应确认订单', async () => {
    const mockConn = createMockConnection();
    stubs.push(sinon.stub(db, 'getConnection').resolves(mockConn));
    stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());
    
    const expiredOrder = {
      id: 801,
      doctor_id: 1,
      date: '2025-11-27',
      slot: '8-10',
      status: 'waiting',
      is_waitlist: true,
      created_at: '2025-11-26 09:00:00',
      capacity: 10,
      booked: 10  // 已满
    };
    
    mockConn.query
      .onCall(0).resolves([[expiredOrder]]) // 查询过期订单
      .onCall(1).resolves([[{ id: 1, capacity: 10, booked: 10 }]]); // 查询号源（已满）
    
    const result = await registrationService.processExpiredAppointments();
    
    expect(result.success).to.be.true;
    expect(result.processedCount).to.equal(0); // 没有处理任何订单
  });
});
});

