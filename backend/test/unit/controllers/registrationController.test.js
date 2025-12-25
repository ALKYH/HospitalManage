const { expect, sinon, restoreStubs } = require('../../setup');
const registrationController = require('../../../controllers/registrationController');
const registrationService = require('../../../services/registrationService');
const paymentService = require('../../../services/paymentService');
const db = require('../../../db');

describe('registrationController', () => {
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

  describe('createRegistration', () => {
    it('should create registration and payment if confirmed and amount > 0', async () => {
      req.body = {
        account_id: 1, department_id: 1, doctor_id: 1, date: '2023-01-01', slot: 'AM',
        regi_type: '专家号' // 金额为 20 元
      };
      const mockOrder = { id: 100, status: 'confirmed' };
      const mockPayment = { id: 99 };

      const regStub = sinon.stub(registrationService, 'createRegistration').resolves(mockOrder);
      stubs.push(regStub);

      const payStub = sinon.stub(paymentService, 'createPayment').resolves(mockPayment);
      stubs.push(payStub);

      const dbStub = sinon.stub(db, 'query').resolves();
      stubs.push(dbStub);

      await registrationController.createRegistration(req, res);

      expect(regStub.calledOnce).to.be.true;
      expect(payStub.calledWithMatch({ amount: 20 })).to.be.true;
      expect(dbStub.calledWithMatch('UPDATE orders SET payment_id = ?', [99, 100])).to.be.true;
      expect(res.json.calledWithMatch({ success: true, payment_required: true })).to.be.true;
    });

    it('should not create payment if amount is 0', async () => {
      req.body = {
        account_id: 1, department_id: 1, doctor_id: 1, date: '2023-01-01', slot: 'AM',
        regi_type: '普通号' // 金额为 0 元（免费号）
      };
      const mockOrder = { id: 100, status: 'confirmed' };

      const regStub = sinon.stub(registrationService, 'createRegistration').resolves(mockOrder);
      stubs.push(regStub);
      const payStub = sinon.stub(paymentService, 'createPayment');
      stubs.push(payStub);

      await registrationController.createRegistration(req, res);

      expect(payStub.called).to.be.false;
      expect(res.json.calledWithMatch({ success: true, payment_required: false })).to.be.true;
    });

    it('should return 400 if missing params', async () => {
      req.body = { account_id: 1 };
      await registrationController.createRegistration(req, res);
      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe('listByUser', () => {
    it('should return list of orders', async () => {
      req.params.user_id = 1;
      const mockRows = [{ id: 100 }];
      const dbStub = sinon.stub(db, 'query').resolves([mockRows]);
      stubs.push(dbStub);

      await registrationController.listByUser(req, res);

      expect(dbStub.calledOnce).to.be.true;
      expect(res.json.calledWith({ success: true, data: mockRows })).to.be.true;
    });
  });
});
