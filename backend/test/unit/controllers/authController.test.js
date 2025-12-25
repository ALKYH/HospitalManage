const { expect, sinon, restoreStubs } = require('../../setup');
const authController = require('../../../controllers/authController');
const authService = require('../../../services/authService');

describe('authController', () => {
  let stubs = [];
  let req, res;

  beforeEach(() => {
    req = { body: {}, user: {} };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };
  });

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      req.body = { username: 'test', password: 'password1' };
      const serviceStub = sinon.stub(authService, 'register').resolves({ id: 1 });
      stubs.push(serviceStub);

      await authController.register(req, res);

      expect(serviceStub.calledWith('test', 'password1')).to.be.true;
      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it('should fail if password is weak', async () => {
      req.body = { username: 'test', password: '123' };
      
      await authController.register(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWithMatch({ message: '密码应至少6位，且包含字母和数字' })).to.be.true;
    });

    it('should handle service errors', async () => {
      req.body = { username: 'test', password: 'password1' };
      const serviceStub = sinon.stub(authService, 'register').rejects(new Error('User exists'));
      stubs.push(serviceStub);

      await authController.register(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWithMatch({ message: 'User exists' })).to.be.true;
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      req.body = { username: 'test', password: 'password1' };
      const serviceStub = sinon.stub(authService, 'login').resolves({ data: { token: 'abc' } });
      stubs.push(serviceStub);

      await authController.login(req, res);

      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, data: { token: 'abc' } })).to.be.true;
    });

    it('should handle login failure', async () => {
      req.body = { username: 'test', password: 'password1' };
      const serviceStub = sinon.stub(authService, 'login').rejects(new Error('Invalid credentials'));
      stubs.push(serviceStub);

      await authController.login(req, res);

      expect(res.status.calledWith(401)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;
    });
  });
});
