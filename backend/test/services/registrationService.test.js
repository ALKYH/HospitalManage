// test/services/registrationService.test.js
const { expect, sinon, restoreStubs } = require('../setup');
const registrationService = require('../../services/registrationService');
const db = require('../../db');
const mqPublisher = require('../../mq/publisher');

describe('registrationService - 挂号服务测试', () => {
  let stubs = [];

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  describe('createRegistration 方法 - 订单一致性测试', () => {
    describe('常规挂号（库存充足）', () => {
      it('应成功创建已确认的挂号订单并增加 booked 计数', async () => {
        const payload = {
          account_id: 100,
          department_id: 1,
          doctor_id: 1,
          date: '2025-11-27',
          slot: '8-10',
          note: '头痛、发烧'
        };

        // Mock 数据库连接和事务
        const mockConnection = {
          beginTransaction: sinon.stub(),
          commit: sinon.stub(),
          rollback: sinon.stub(),
          release: sinon.stub(),
          query: sinon.stub()
        };

        stubs.push(sinon.stub(db, 'getConnection').resolves(mockConnection));
        stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());

        // 模拟查询 doctor_availability（返回有库存）
        mockConnection.query.onCall(0).resolves([[{
          id: 1,
          doctor_id: 1,
          date: '2025-11-27',
          slot: '8-10',
          capacity: 10,
          booked: 5
        }]]);

        // 模拟更新 booked
        mockConnection.query.onCall(1).resolves([{ affectedRows: 1 }]);

        // 模拟插入订单
        mockConnection.query.onCall(2).resolves([{ insertId: 500 }]);

        // 模拟查询新订单
        mockConnection.query.onCall(3).resolves([[
          {
            id: 500,
            account_id: 100,
            doctor_id: 1,
            date: '2025-11-27',
            slot: '8-10',
            status: 'confirmed',
            is_waitlist: false,
            note: '头痛、发烧'
          }
        ]]);

        const result = await registrationService.createRegistration(payload);

        // 验证事务正确执行
        expect(mockConnection.beginTransaction.calledOnce).to.be.true;
        expect(mockConnection.commit.calledOnce).to.be.true;
        expect(mockConnection.rollback.called).to.be.false;

        // 验证 booked 被更新（从 5 增加到 6）
        const updateQuery = mockConnection.query.getCall(1);
        expect(updateQuery.args[0]).to.equal(
          'UPDATE doctor_availability SET booked = ? WHERE doctor_id = ? AND date = ?'
        );
        expect(updateQuery.args[1]).to.deep.equal([6, 1, '2025-11-27']);

        // 验证订单正确创建
        expect(result.id).to.equal(500);
        expect(result.status).to.equal('confirmed');
        expect(result.is_waitlist).to.be.false;

        // 验证 MQ 事件发布
        expect(mqPublisher.publishOrderEvent.calledOnce).to.be.true;
        expect(mqPublisher.publishOrderEvent.firstCall.args[0]).to.equal('created');
      });

      it('应正确处理日期格式转换', async () => {
        const payload = {
          account_id: 100,
          department_id: 1,
          doctor_id: 1,
          date: '2025-11-27T00:00:00.000Z', // ISO 格式
          slot: '8-10',
          note: '测试'
        };

        const mockConnection = {
          beginTransaction: sinon.stub(),
          commit: sinon.stub(),
          rollback: sinon.stub(),
          release: sinon.stub(),
          query: sinon.stub()
        };

        stubs.push(sinon.stub(db, 'getConnection').resolves(mockConnection));
        stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());

        mockConnection.query.onCall(0).resolves([[{
          id: 1,
          capacity: 10,
          booked: 5
        }]]);

        mockConnection.query.onCall(1).resolves([{ affectedRows: 1 }]);
        mockConnection.query.onCall(2).resolves([{ insertId: 501 }]);
        mockConnection.query.onCall(3).resolves([[
          { id: 501, status: 'confirmed' }
        ]]);

        await registrationService.createRegistration(payload);

        // 验证查询时使用了转换后的日期
        const queryCall = mockConnection.query.getCall(0);
        expect(queryCall.args[1][1]).to.equal('2025-11-27'); // 应该是转换后的日期
      });
    });

    describe('候补挂号（库存不足）', () => {
      it('应在库存不足时创建候补订单（不增加 booked）', async () => {
        const payload = {
          account_id: 101,
          department_id: 1,
          doctor_id: 1,
          date: '2025-11-27',
          slot: '8-10',
          note: '咳嗽'
        };

        const mockConnection = {
          beginTransaction: sinon.stub(),
          commit: sinon.stub(),
          rollback: sinon.stub(),
          release: sinon.stub(),
          query: sinon.stub()
        };

        stubs.push(sinon.stub(db, 'getConnection').resolves(mockConnection));
        stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());

        // 模拟查询 doctor_availability（已订满）
        mockConnection.query.onCall(0).resolves([[{
          id: 1,
          doctor_id: 1,
          date: '2025-11-27',
          capacity: 10,
          booked: 10  // 已满
        }]]);

        // 模拟插入候补订单（不应该调用更新 booked）
        mockConnection.query.onCall(1).resolves([{ insertId: 600 }]);

        // 模拟查询新订单
        mockConnection.query.onCall(2).resolves([[
          {
            id: 600,
            account_id: 101,
            status: 'waiting',
            is_waitlist: true
          }
        ]]);

        const result = await registrationService.createRegistration(payload);

        // 验证没有更新 booked（因为已满）
        const updateCall = mockConnection.query.getCall(1);
        expect(updateCall.args[0]).to.include('INSERT INTO orders');
        expect(updateCall.args[0]).not.to.include('UPDATE doctor_availability');

        // 验证订单状态
        expect(result.status).to.equal('waiting');
        expect(result.is_waitlist).to.be.true;

        // 验证 MQ 事件
        expect(mqPublisher.publishOrderEvent.calledOnce).to.be.true;
        expect(mqPublisher.publishOrderEvent.firstCall.args[0]).to.equal('waiting');
      });

      it('应支持强制创建候补订单（force_waitlist）', async () => {
        const payload = {
          account_id: 102,
          department_id: 1,
          doctor_id: 1,
          date: '2025-11-27',
          slot: '8-10',
          note: '复诊',
          force_waitlist: true
        };

        const mockConnection = {
          beginTransaction: sinon.stub(),
          commit: sinon.stub(),
          rollback: sinon.stub(),
          release: sinon.stub(),
          query: sinon.stub()
        };

        stubs.push(sinon.stub(db, 'getConnection').resolves(mockConnection));
        stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());

        mockConnection.query.onCall(0).resolves([[{
          id: 1,
          capacity: 10,
          booked: 5  // 有库存，但强制候补
        }]]);

        mockConnection.query.onCall(1).resolves([{ insertId: 601 }]);
        mockConnection.query.onCall(2).resolves([[
          { id: 601, status: 'waiting', is_waitlist: true }
        ]]);

        const result = await registrationService.createRegistration(payload);

        // 验证没有更新 booked（因为 force_waitlist）
        expect(result.status).to.equal('waiting');
        expect(result.is_waitlist).to.be.true;

        // 验证没有调用 UPDATE doctor_availability
        const allQueries = mockConnection.query.getCalls().map(call => call.args[0]);
        const hasUpdateQuery = allQueries.some(query => 
          typeof query === 'string' && query.includes('UPDATE doctor_availability')
        );
        expect(hasUpdateQuery).to.be.false;
      });
    });

    describe('数据一致性保护', () => {
      it('应在事务失败时回滚所有操作', async () => {
        const payload = {
          account_id: 103,
          department_id: 1,
          doctor_id: 1,
          date: '2025-11-27',
          slot: '8-10',
          note: '测试'
        };

        const mockConnection = {
          beginTransaction: sinon.stub(),
          commit: sinon.stub(),
          rollback: sinon.stub(),
          release: sinon.stub(),
          query: sinon.stub()
        };

        stubs.push(sinon.stub(db, 'getConnection').resolves(mockConnection));

        // 模拟查询成功
        mockConnection.query.onCall(0).resolves([[{
          id: 1,
          capacity: 10,
          booked: 5
        }]]);

        // 模拟更新失败
        mockConnection.query.onCall(1).rejects(new Error('数据库更新失败'));

        try {
          await registrationService.createRegistration(payload);
          expect.fail('应该抛出错误');
        } catch (error) {
          expect(error.message).to.include('数据库更新失败');
          expect(mockConnection.rollback.calledOnce).to.be.true;
          expect(mockConnection.commit.called).to.be.false;
        }
      });

      it('应正确处理没有排班记录的情况（容量为0）', async () => {
        const payload = {
          account_id: 104,
          department_id: 1,
          doctor_id: 999, // 不存在的医生
          date: '2025-11-27',
          slot: '8-10',
          note: '测试'
        };

        const mockConnection = {
          beginTransaction: sinon.stub(),
          commit: sinon.stub(),
          rollback: sinon.stub(),
          release: sinon.stub(),
          query: sinon.stub()
        };

        stubs.push(sinon.stub(db, 'getConnection').resolves(mockConnection));
        stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());

        // 模拟查询返回空数组（没有排班）
        mockConnection.query.onCall(0).resolves([[]]);

        // 模拟插入候补订单
        mockConnection.query.onCall(1).resolves([{ insertId: 602 }]);
        mockConnection.query.onCall(2).resolves([[
          { id: 602, status: 'waiting', is_waitlist: true }
        ]]);

        const result = await registrationService.createRegistration(payload);

        // 验证创建了候补订单（因为容量为0）
        expect(result.status).to.equal('waiting');
        expect(result.is_waitlist).to.be.true;
      });
    });
  });

  describe('cancelRegistration 方法 - 取消与候补提升一致性', () => {
    describe('取消已确认的订单', () => {
      it('应取消订单、减少 booked 计数并提升候补订单', async () => {
        const orderId = 500;
        const cancelledBy = 'patient';

        const mockConnection = {
          beginTransaction: sinon.stub(),
          commit: sinon.stub(),
          rollback: sinon.stub(),
          release: sinon.stub(),
          query: sinon.stub()
        };

        stubs.push(sinon.stub(db, 'getConnection').resolves(mockConnection));
        stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());

        // 1. 查询订单（已确认状态）
        mockConnection.query.onCall(0).resolves([[
          {
            id: orderId,
            doctor_id: 1,
            date: '2025-11-27',
            status: 'confirmed',
            is_waitlist: false
          }
        ]]);

        // 2. 更新订单状态为取消
        mockConnection.query.onCall(1).resolves([{ affectedRows: 1 }]);

        // 3. 查询排班记录
        mockConnection.query.onCall(2).resolves([[
          { id: 1, doctor_id: 1, date: '2025-11-27', booked: 6 }
        ]]);

        // 4. 更新 booked（减1）
        mockConnection.query.onCall(3).resolves([{ affectedRows: 1 }]);

        // 5. 查询候补队列
        mockConnection.query.onCall(4).resolves([[
          {
            id: 600,
            doctor_id: 1,
            date: '2025-11-27',
            status: 'waiting',
            is_waitlist: true,
            created_at: '2025-11-26 10:00:00'
          }
        ]]);

        // 6. 提升候补订单
        mockConnection.query.onCall(5).resolves([{ affectedRows: 1 }]);

        // 7. 恢复 booked 计数
        mockConnection.query.onCall(6).resolves([{ affectedRows: 1 }]);

        // 8. 查询提升后的订单
        mockConnection.query.onCall(7).resolves([[
          { id: 600, status: 'confirmed', is_waitlist: false }
        ]]);

        const result = await registrationService.cancelRegistration(orderId, cancelledBy);

        // 验证事务执行
        expect(mockConnection.beginTransaction.calledOnce).to.be.true;
        expect(mockConnection.commit.calledOnce).to.be.true;

        // 验证 booked 更新逻辑
        const updateBookedCall1 = mockConnection.query.getCall(3);
        expect(updateBookedCall1.args[1]).to.deep.equal([5, 1, '2025-11-27']); // 6-1=5

        const updateBookedCall2 = mockConnection.query.getCall(6);
        expect(updateBookedCall2.args[1]).to.deep.equal([6, 1, '2025-11-27']); // 5+1=6

        // 验证候补提升
        const promoteCall = mockConnection.query.getCall(5);
        expect(promoteCall.args[0]).to.include("UPDATE orders SET status = 'confirmed'");

        // 验证 MQ 事件发布
        expect(mqPublisher.publishOrderEvent.calledTwice).to.be.true;
        expect(mqPublisher.publishOrderEvent.firstCall.args[0]).to.equal('promoted');
        expect(mqPublisher.publishOrderEvent.secondCall.args[0]).to.equal('cancelled');

        expect(result.success).to.be.true;
      });

      it('应在没有候补时只取消订单不提升', async () => {
        const orderId = 501;
        const cancelledBy = 'admin';

        const mockConnection = {
          beginTransaction: sinon.stub(),
          commit: sinon.stub(),
          rollback: sinon.stub(),
          release: sinon.stub(),
          query: sinon.stub()
        };

        stubs.push(sinon.stub(db, 'getConnection').resolves(mockConnection));
        stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());

        // 订单为已确认状态
        mockConnection.query.onCall(0).resolves([[
          { id: orderId, doctor_id: 1, date: '2025-11-27', status: 'confirmed' }
        ]]);

        mockConnection.query.onCall(1).resolves([{ affectedRows: 1 }]);
        mockConnection.query.onCall(2).resolves([[{ booked: 3 }]]);
        mockConnection.query.onCall(3).resolves([{ affectedRows: 1 }]);
        
        // 查询候补队列返回空
        mockConnection.query.onCall(4).resolves([[]]);

        const result = await registrationService.cancelRegistration(orderId, cancelledBy);

        // 验证 booked 只更新了一次（减少）
        const updateCalls = mockConnection.query.getCalls().filter(call => 
          call.args[0] && call.args[0].includes('UPDATE doctor_availability')
        );
        expect(updateCalls).to.have.length(1); // 只有减少，没有恢复

        expect(result.success).to.be.true;
      });
    });

    describe('取消候补订单', () => {
      it('应取消候补订单但不影响 booked 计数', async () => {
        const orderId = 600;
        const cancelledBy = 'patient';

        const mockConnection = {
          beginTransaction: sinon.stub(),
          commit: sinon.stub(),
          rollback: sinon.stub(),
          release: sinon.stub(),
          query: sinon.stub()
        };

        stubs.push(sinon.stub(db, 'getConnection').resolves(mockConnection));
        stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());

        // 订单为候补状态
        mockConnection.query.onCall(0).resolves([[
          { id: orderId, status: 'waiting', is_waitlist: true }
        ]]);

        mockConnection.query.onCall(1).resolves([{ affectedRows: 1 }]);

        const result = await registrationService.cancelRegistration(orderId, cancelledBy);

        // 验证没有查询或更新 doctor_availability（因为候补不影响 booked）
        const allQueries = mockConnection.query.getCalls().map(call => call.args[0]);
        const hasAvailabilityQuery = allQueries.some(query => 
          typeof query === 'string' && 
          (query.includes('doctor_availability') || query.includes('booked'))
        );
        expect(hasAvailabilityQuery).to.be.false;

        expect(result.success).to.be.true;
      });
    });

    describe('取消已取消的订单', () => {
      it('应直接返回已取消的订单而不执行其他操作', async () => {
        const orderId = 502;
        const cancelledBy = 'patient';

        const mockConnection = {
          beginTransaction: sinon.stub(),
          commit: sinon.stub(),
          rollback: sinon.stub(),
          release: sinon.stub(),
          query: sinon.stub()
        };

        stubs.push(sinon.stub(db, 'getConnection').resolves(mockConnection));

        // 订单已经是取消状态
        mockConnection.query.onCall(0).resolves([[
          { id: orderId, status: 'cancelled' }
        ]]);

        const result = await registrationService.cancelRegistration(orderId, cancelledBy);

        // 验证事务立即提交，没有其他操作
        expect(mockConnection.commit.calledOnce).to.be.true;
        
        // 验证没有更新操作
        expect(mockConnection.query.callCount).to.equal(1); // 只有查询

        expect(result.status).to.equal('cancelled');
      });
    });

    describe('错误处理', () => {
      it('应在订单不存在时抛出错误', async () => {
        const orderId = 9999;
        const cancelledBy = 'patient';

        const mockConnection = {
          beginTransaction: sinon.stub(),
          commit: sinon.stub(),
          rollback: sinon.stub(),
          release: sinon.stub(),
          query: sinon.stub()
        };

        stubs.push(sinon.stub(db, 'getConnection').resolves(mockConnection));

        // 查询返回空数组
        mockConnection.query.onCall(0).resolves([[]]);

        try {
          await registrationService.cancelRegistration(orderId, cancelledBy);
          expect.fail('应该抛出错误');
        } catch (error) {
          expect(error.message).to.include('order not found');
          expect(mockConnection.rollback.calledOnce).to.be.true;
        }
      });

      it('应在事务失败时回滚', async () => {
        const orderId = 503;
        const cancelledBy = 'admin';

        const mockConnection = {
          beginTransaction: sinon.stub(),
          commit: sinon.stub(),
          rollback: sinon.stub(),
          release: sinon.stub(),
          query: sinon.stub()
        };

        stubs.push(sinon.stub(db, 'getConnection').resolves(mockConnection));

        // 查询成功
        mockConnection.query.onCall(0).resolves([[
          { id: orderId, doctor_id: 1, date: '2025-11-27', status: 'confirmed' }
        ]]);

        // 更新失败
        mockConnection.query.onCall(1).rejects(new Error('更新失败'));

        try {
          await registrationService.cancelRegistration(orderId, cancelledBy);
          expect.fail('应该抛出错误');
        } catch (error) {
          expect(error.message).to.include('更新失败');
          expect(mockConnection.rollback.calledOnce).to.be.true;
        }
      });
    });
  });

  describe('订单一致性综合测试', () => {
    it('应确保并发操作时库存计数的最终一致性', async () => {
      // 这个测试模拟并发场景，需要更复杂的模拟
      // 这里先创建一个基础版本
      const payload1 = {
        account_id: 200,
        department_id: 1,
        doctor_id: 1,
        date: '2025-11-28',
        slot: '10-12',
        note: '患者1'
      };

      const payload2 = {
        account_id: 201,
        department_id: 1,
        doctor_id: 1,
        date: '2025-11-28',
        slot: '10-12',
        note: '患者2'
      };

      // 模拟初始状态：容量3，已预订0
      const mockConnection1 = {
        beginTransaction: sinon.stub(),
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub(),
        query: sinon.stub()
      };

      const mockConnection2 = {
        beginTransaction: sinon.stub(),
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub(),
        query: sinon.stub()
      };

      // 模拟两个连接交替获取
      let connectionCount = 0;
      stubs.push(sinon.stub(db, 'getConnection').callsFake(() => {
        connectionCount++;
        return connectionCount === 1 ? Promise.resolve(mockConnection1) : Promise.resolve(mockConnection2);
      }));

      stubs.push(sinon.stub(mqPublisher, 'publishOrderEvent').resolves());

      // 配置第一个连接的查询（第一个挂号）
      mockConnection1.query.onCall(0).resolves([[
        { id: 1, capacity: 3, booked: 0 }
      ]]);
      mockConnection1.query.onCall(1).resolves([{ affectedRows: 1 }]);
      mockConnection1.query.onCall(2).resolves([{ insertId: 700 }]);
      mockConnection1.query.onCall(3).resolves([[
        { id: 700, status: 'confirmed' }
      ]]);

      // 配置第二个连接的查询（第二个挂号，看到 booked=1）
      mockConnection2.query.onCall(0).resolves([[
        { id: 1, capacity: 3, booked: 1 }
      ]]);
      mockConnection2.query.onCall(1).resolves([{ affectedRows: 1 }]);
      mockConnection2.query.onCall(2).resolves([{ insertId: 701 }]);
      mockConnection2.query.onCall(3).resolves([[
        { id: 701, status: 'confirmed' }
      ]]);

      // 并行执行（这里用顺序执行模拟）
      const result1 = await registrationService.createRegistration(payload1);
      const result2 = await registrationService.createRegistration(payload2);

      // 验证两个都成功
      expect(result1.status).to.equal('confirmed');
      expect(result2.status).to.equal('confirmed');

      // 验证第二个连接看到的 booked 是更新后的值
      const secondQuery = mockConnection2.query.getCall(0);
      expect(secondQuery.args[0]).to.include('FOR UPDATE'); // 使用了行锁
    });
  });
});