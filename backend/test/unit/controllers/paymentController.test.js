const { expect, sinon, restoreStubs } = require('../../setup');
const paymentController = require('../../../controllers/paymentController');
const paymentService = require('../../../services/paymentService');
const db = require('../../../db');

describe('paymentController', () => {
  let stubs = [];
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, query: {} };
    res = {
      json: sinon.spy(),
      status: sinon.stub().returnsThis()
    };
  });

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  describe('createPayment', () => {
    it('should create payment and update order', async () => {
      req.body = { account_id: 1, order_id: 100, amount: 50 };
      const mockPayment = { id: 99, order_id: 100 };
      
      const serviceStub = sinon.stub(paymentService, 'createPayment').resolves(mockPayment);
      stubs.push(serviceStub);
      
      const dbStub = sinon.stub(db, 'query').resolves();
      stubs.push(dbStub);

      await paymentController.createPayment(req, res);

      expect(serviceStub.calledWithMatch({ account_id: 1, order_id: 100, amount: 50 })).to.be.true;
      expect(dbStub.calledWithMatch('UPDATE orders SET payment_id = ?', [99, 100])).to.be.true;
      expect(res.json.calledWith({ success: true, data: mockPayment })).to.be.true;
    });

    it('should return 400 if missing params', async () => {
      req.body = { account_id: 1 }; // 缺少 amount 字段
      await paymentController.createPayment(req, res);
      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe('pay', () => {
    it('should mark paid and update order status', async () => {
      req.params.id = 99;
      req.body = { provider_info: { method: 'card' } };
      const mockPayment = { id: 99, order_id: 100, status: 'paid' };

      const serviceStub = sinon.stub(paymentService, 'markPaid').resolves(mockPayment);
      stubs.push(serviceStub);

      const dbStub = sinon.stub(db, 'query').resolves();
      stubs.push(dbStub);

      await paymentController.pay(req, res);

      expect(serviceStub.calledWith(99, { method: 'card' })).to.be.true;
      expect(dbStub.calledWithMatch('UPDATE orders SET status = ?', ['confirmed', 100])).to.be.true;
      expect(res.json.calledWith({ success: true, data: mockPayment })).to.be.true;
    });
  });
});
