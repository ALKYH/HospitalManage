const { expect, sinon, restoreStubs } = require('../../setup');
const patientController = require('../../../controllers/patientController');
const patientService = require('../../../services/patientService');

describe('patientController', () => {
  let stubs = [];
  let req, res;

  beforeEach(() => {
    req = { body: {}, user: { id: 1 } };
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };
  });

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  describe('getMyProfile', () => {
    it('should return profile with mapped gender', async () => {
      const profile = { gender: 'M', display_name: 'John' };
      const serviceStub = sinon.stub(patientService, 'getProfileByAccountId').resolves(profile);
      stubs.push(serviceStub);

      await patientController.getMyProfile(req, res);

      expect(serviceStub.calledWith(1)).to.be.true;
      expect(res.json.calledWithMatch({ success: true, data: { gender: '男' } })).to.be.true;
    });

    it('should return 401 if no user', async () => {
      req.user = null;
      await patientController.getMyProfile(req, res);
      expect(res.status.calledWith(401)).to.be.true;
    });
  });

  describe('submitProfile', () => {
    it('should submit profile if valid', async () => {
      req.body = { 
        employeeId: '123', 
        display_name: 'John', 
        idcard: 'ID123', 
        phone: '13800138000' 
      };
      
      const verifyStub = sinon.stub(patientService, 'verifyAgainstStaffList').returns(true);
      stubs.push(verifyStub);
      const saveStub = sinon.stub(patientService, 'saveProfile').resolves({ id: 1 });
      stubs.push(saveStub);

      await patientController.submitProfile(req, res);

      expect(verifyStub.called).to.be.true;
      expect(saveStub.called).to.be.true;
      expect(res.json.calledWithMatch({ success: true })).to.be.true;
    });

    it('should fail if missing required fields', async () => {
      req.body = { display_name: 'John' }; // 缺少其他必填字段
      await patientController.submitProfile(req, res);
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWithMatch({ message: '需提供学/工号、姓名和身份证号' })).to.be.true;
    });

    it('should fail if staff verification fails', async () => {
      req.body = { 
        employeeId: '123', 
        display_name: 'John', 
        idcard: 'ID123', 
        phone: '13800138000' 
      };
      const verifyStub = sinon.stub(patientService, 'verifyAgainstStaffList').returns(false);
      stubs.push(verifyStub);

      await patientController.submitProfile(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledWithMatch({ message: '信息与教职工名单不匹配，请核对学/工号、姓名和身份证号' })).to.be.true;
    });
  });
});
