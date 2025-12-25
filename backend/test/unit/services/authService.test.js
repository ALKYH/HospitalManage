const { expect, sinon, restoreStubs } = require('../../setup');
const authService = require('../../../services/authService');
const AccountModel = require('../../../schemas/accountModels');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('authService', () => {
  let stubs = [];

  afterEach(() => {
    restoreStubs(stubs);
    stubs = [];
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const findStub = sinon.stub(AccountModel, 'findByUsername').resolves(null);
      stubs.push(findStub);
      const hashStub = sinon.stub(bcrypt, 'hash').resolves('hashed_password');
      stubs.push(hashStub);
      const createStub = sinon.stub(AccountModel, 'create').resolves(1);
      stubs.push(createStub);

      const result = await authService.register('testuser', 'password123');

      expect(findStub.calledWith('testuser')).to.be.true;
      expect(hashStub.calledWith('password123', 10)).to.be.true;
      expect(createStub.calledWith('testuser', 'hashed_password')).to.be.true;
      expect(result).to.deep.equal({ id: 1, username: 'testuser' });
    });

    it('should throw error if username already exists', async () => {
      const findStub = sinon.stub(AccountModel, 'findByUsername').resolves({ id: 1 });
      stubs.push(findStub);

      try {
        await authService.register('existinguser', 'password123');
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.message).to.equal('用户名已存在');
      }
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const user = { id: 1, username: 'testuser', password_hash: 'hashed_password', role: 'patient' };
      const findStub = sinon.stub(AccountModel, 'findByUsername').resolves(user);
      stubs.push(findStub);
      const compareStub = sinon.stub(bcrypt, 'compare').resolves(true);
      stubs.push(compareStub);
      const signStub = sinon.stub(jwt, 'sign').returns('fake_token');
      stubs.push(signStub);

      const result = await authService.login('testuser', 'password123');

      expect(findStub.calledWith('testuser')).to.be.true;
      expect(compareStub.calledWith('password123', 'hashed_password')).to.be.true;
      expect(result).to.deep.equal({ success: true, data: { token: 'fake_token', role: 'patient', id: 1 } });
    });

    it('should throw error if user not found', async () => {
      const findStub = sinon.stub(AccountModel, 'findByUsername').resolves(null);
      stubs.push(findStub);

      try {
        await authService.login('nonexistent', 'password123');
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.message).to.equal('用户不存在');
      }
    });

    it('should throw error if password is incorrect', async () => {
      const user = { id: 1, username: 'testuser', password_hash: 'hashed_password' };
      const findStub = sinon.stub(AccountModel, 'findByUsername').resolves(user);
      stubs.push(findStub);
      const compareStub = sinon.stub(bcrypt, 'compare').resolves(false);
      stubs.push(compareStub);

      try {
        await authService.login('testuser', 'wrongpassword');
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.message).to.equal('密码错误');
      }
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const user = { id: 1, password_hash: 'old_hash' };
      const findStub = sinon.stub(AccountModel, 'findById').resolves(user);
      stubs.push(findStub);
      const compareStub = sinon.stub(bcrypt, 'compare').resolves(true);
      stubs.push(compareStub);
      const hashStub = sinon.stub(bcrypt, 'hash').resolves('new_hash');
      stubs.push(hashStub);
      const updateStub = sinon.stub(AccountModel, 'updatePassword').resolves();
      stubs.push(updateStub);

      await authService.changePassword(1, 'oldPass', 'newPass');

      expect(findStub.calledWith(1)).to.be.true;
      expect(compareStub.calledWith('oldPass', 'old_hash')).to.be.true;
      expect(hashStub.calledWith('newPass', 10)).to.be.true;
      expect(updateStub.calledWith(1, 'new_hash')).to.be.true;
    });

    it('should throw error if user not found', async () => {
      const findStub = sinon.stub(AccountModel, 'findById').resolves(null);
      stubs.push(findStub);

      try {
        await authService.changePassword(1, 'oldPass', 'newPass');
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.message).to.equal('用户不存在');
      }
    });

    it('should throw error if old password is incorrect', async () => {
      const user = { id: 1, password_hash: 'old_hash' };
      const findStub = sinon.stub(AccountModel, 'findById').resolves(user);
      stubs.push(findStub);
      const compareStub = sinon.stub(bcrypt, 'compare').resolves(false);
      stubs.push(compareStub);

      try {
        await authService.changePassword(1, 'wrongOldPass', 'newPass');
        throw new Error('Should have thrown error');
      } catch (err) {
        expect(err.message).to.equal('旧密码不正确');
      }
    });
  });
});
