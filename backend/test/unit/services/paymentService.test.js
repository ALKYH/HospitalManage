const { expect, sinon, restoreStubs } = require('../../setup');
const paymentService = require('../../../services/paymentService');
const db = require('../../../db');

describe('paymentService', () => {
  let stubs = [];

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  describe('createPayment', () => {
    it('should create a payment record', async () => {
      const queryStub = sinon.stub(db, 'query');
      queryStub.onCall(0).resolves([{ insertId: 10 }]);
      const newPayment = { id: 10, amount: 100, status: 'created' };
      queryStub.onCall(1).resolves([ [newPayment] ]);
      stubs.push(queryStub);

      const result = await paymentService.createPayment({ account_id: 1, amount: 100 });

      expect(queryStub.firstCall.args[0]).to.include('INSERT INTO payments');
      expect(result).to.deep.equal(newPayment);
    });

    it('should handle zero and negative amount gracefully', async () => {
      const queryStub = sinon.stub(db, 'query');
      // 插入时 amount 为 0 或负数都应被透传到 SQL 参数中
      queryStub.onCall(0).resolves([{ insertId: 20 }]);
      const storedPayment = { id: 20, amount: -5, status: 'created' };
      queryStub.onCall(1).resolves([[storedPayment]]);
      stubs.push(queryStub);

      const result = await paymentService.createPayment({ account_id: 1, amount: -5 });

      expect(queryStub.firstCall.args[1][2]).to.equal(-5);
      expect(result).to.deep.equal(storedPayment);
    });
  });

  describe('markPaid', () => {
    it('should update payment status to paid', async () => {
      const queryStub = sinon.stub(db, 'query');
      queryStub.onCall(0).resolves([{ affectedRows: 1 }]);
      const paidPayment = { id: 10, status: 'paid' };
      queryStub.onCall(1).resolves([ [paidPayment] ]);
      stubs.push(queryStub);

      const result = await paymentService.markPaid(10, { transaction_id: 'tx123' });

      expect(queryStub.firstCall.args[0]).to.include('UPDATE payments SET status = ?');
      expect(queryStub.firstCall.args[1][0]).to.equal('paid');
      expect(result).to.deep.equal(paidPayment);
    });
  });

  describe('getPaymentById', () => {
    it('should return payment by id', async () => {
      const payment = { id: 10, amount: 100 };
      const queryStub = sinon.stub(db, 'query').resolves([ [payment] ]);
      stubs.push(queryStub);

      const result = await paymentService.getPaymentById(10);
      expect(result).to.deep.equal(payment);
    });
  });

  describe('listPaymentsByAccount', () => {
    it('should return list of payments', async () => {
      const payments = [{ id: 1 }, { id: 2 }];
      const queryStub = sinon.stub(db, 'query').resolves([ payments ]);
      stubs.push(queryStub);

      const result = await paymentService.listPaymentsByAccount(1);
      expect(result).to.deep.equal(payments);
    });
  });
});
