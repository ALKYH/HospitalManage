const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const db = require('../../db');

// 测试用户数据
const testUser = {
  username: `test_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
  password: 'abc123', // 6位，包含字母数字
  role: 'user'
};

// 用于保存登录后的token
let authToken = '';

describe('认证流程集成测试', () => {
  afterEach(async () => {
    // 清理测试数据
    await db.execute('DELETE FROM accounts WHERE username LIKE ?', ['test_%']);
  });

  test('TC-01: 完整注册-登录-验证流程', async () => {
    console.log('📝 测试用户:', testUser.username);
    
    // 1. 注册测试
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);
    
    expect(registerRes.body.success).toBe(true);
    expect(registerRes.body.data).toHaveProperty('id');
    expect(registerRes.body.data.username).toBe(testUser.username);
    
    // 2. 登录测试
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password
      })
      .expect(200);
    
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data).toHaveProperty('token');
    
    // 保存token供后续测试使用
    authToken = loginRes.body.data.token;
    const { id, role } = loginRes.body.data;
    
    // 3. 验证JWT Token
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET || 'change_this_secret');
    expect(decoded.id).toBe(id);
    expect(decoded.username).toBe(testUser.username);
    expect(decoded.role).toBe(testUser.role);
    expect(decoded).toHaveProperty('exp'); // 验证有效期
    
    console.log('✅ Token验证成功，用户ID:', decoded.id);
  });

  test('TC-02: 重复注册应失败', async () => {
    // 第一次注册
    await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);
    
    // 第二次注册相同用户名
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(400); // 根据你的代码返回400
    
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('已存在');
  });

  test('TC-03: 密码格式验证', async () => {
    const testCases = [
      { password: '123', expected: 400, desc: '密码过短' },
      { password: 'abcdef', expected: 400, desc: '纯字母' },
      { password: '123456', expected: 400, desc: '纯数字' },
      { password: 'abc123', expected: 201, desc: '字母+数字，6位' },
      { password: 'password123', expected: 201, desc: '字母+数字，更长' }
    ];
    
    for (const tc of testCases) {
      const user = { 
        username: `format_test_${Date.now()}_${tc.desc}`,
        password: tc.password 
      };
      
      const res = await request(app)
        .post('/api/auth/register')
        .send(user);
      
      expect(res.status).toBe(tc.expected);
      
      // 清理
      if (res.status === 201) {
        await db.execute('DELETE FROM accounts WHERE username = ?', [user.username]);
      }
    }
  });

  test('TC-04: 登录失败场景', async () => {
    // 先创建用户
    await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    const testCases = [
      { 
        username: 'nonexistent_user', 
        password: 'any', 
        expectedStatus: 401,
        expectedMessage: '用户不存在'
      },
      { 
        username: testUser.username, 
        password: 'wrongpassword', 
        expectedStatus: 401,
        expectedMessage: '密码错误'
      }
    ];
    
    for (const tc of testCases) {
      const res = await request(app)
        .post('/api/auth/login')
        .send(tc)
        .expect(tc.expectedStatus);
      
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain(tc.expectedMessage);
    }
  });

  test('TC-05: 修改密码流程', async () => {
    // 1. 创建用户并登录
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send(testUser);
    
    const token = loginRes.body.data.token;
    
    // 2. 修改密码
    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        oldPassword: testUser.password,
        newPassword: 'newpass123'
      })
      .expect(200);
    
    expect(changeRes.body.success).toBe(true);
    
    // 3. 使用新密码登录
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: 'newpass123'
      })
      .expect(200);
    
    expect(newLoginRes.body.success).toBe(true);
    
    // 4. 使用旧密码应失败
    await request(app)
      .post('/api/auth/login')
      .send(testUser)
      .expect(401);
  });
});