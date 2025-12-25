const { expect, sinon, restoreStubs } = require('../../setup');
const adminController = require('../../../controllers/adminController');
const adminService = require('../../../services/adminService');

describe('adminController', () => {
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

  describe('listDepartments', () => {
    it('should return list of departments', async () => {
      const mockData = [{ id: 1, name: 'Dept' }];
      const stub = sinon.stub(adminService, 'listDepartments').resolves(mockData);
      stubs.push(stub);

      await adminController.listDepartments(req, res);

      expect(stub.calledOnce).to.be.true;
      expect(res.json.calledWith({ success: true, data: mockData })).to.be.true;
    });

    it('should handle errors', async () => {
      const stub = sinon.stub(adminService, 'listDepartments').rejects(new Error('DB Error'));
      stubs.push(stub);

      await adminController.listDepartments(req, res);

      expect(res.status.calledWith(500)).to.be.true;
      expect(res.json.calledWith({ success: false, message: 'DB Error' })).to.be.true;
    });
  });

  describe('createDepartment', () => {
    it('should create department', async () => {
      req.body = { name: 'New Dept' };
      const mockResult = { id: 2, name: 'New Dept' };
      const stub = sinon.stub(adminService, 'createDepartment').resolves(mockResult);
      stubs.push(stub);

      await adminController.createDepartment(req, res);

      expect(stub.calledWith(req.body)).to.be.true;
      expect(res.json.calledWith({ success: true, data: mockResult })).to.be.true;
    });
  });

  describe('setDoctorPassword', () => {
    it('should set password', async () => {
      req.params.id = 1;
      req.body = { password: 'newpass' };
      const mockResult = { id: 1 };
      const stub = sinon.stub(adminService, 'setDoctorPassword').resolves(mockResult);
      stubs.push(stub);

      await adminController.setDoctorPassword(req, res);

      expect(stub.calledWith(1, { username: undefined, password: 'newpass' })).to.be.true;
      expect(res.json.calledWith({ success: true, data: mockResult })).to.be.true;
    });

    it('should return 400 if password missing', async () => {
      req.params.id = 1;
      req.body = {}; // 未提供 password 字段

      await adminController.setDoctorPassword(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWithMatch({ success: false })).to.be.true;
    });
  });
});
