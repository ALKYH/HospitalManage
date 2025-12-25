const { expect, sinon, restoreStubs } = require('../../setup');
const adminService = require('../../../services/adminService');
const db = require('../../../db');

describe('adminService', () => {
  let stubs = [];

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  describe('listDepartments', () => {
    it('should return all departments', async () => {
      const depts = [{ id: 1, name: 'Dept A' }];
      const queryStub = sinon.stub(db, 'query').resolves([ depts ]);
      stubs.push(queryStub);

      const result = await adminService.listDepartments();
      expect(result).to.deep.equal(depts);
    });
  });

  describe('createDepartment', () => {
    it('should create a department', async () => {
      const queryStub = sinon.stub(db, 'query');
      queryStub.onCall(0).resolves([{ insertId: 5 }]);
      const newDept = { id: 5, name: 'New Dept' };
      queryStub.onCall(1).resolves([ [newDept] ]);
      stubs.push(queryStub);

      const result = await adminService.createDepartment({ name: 'New Dept' });
      expect(queryStub.firstCall.args[0]).to.include('INSERT INTO departments');
      expect(result).to.deep.equal(newDept);
    });
  });
});
