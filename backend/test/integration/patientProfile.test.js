const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const db = require('../../db');
const fs = require('fs');
const path = require('path');

describe('患者档案与实名认证集成测试', () => {
  let testUser = { id: 0, token: '' };
  let testStaffData = null;
  
  beforeAll(async () => {
    // 1. 创建测试用户
    const username = `patient_test_${Date.now()}`;
    const password = 'pass123';
    
    const hashedPassword = require('bcryptjs').hashSync(password, 10);
    const [result] = await db.execute(
      'INSERT INTO accounts (username, password_hash, role) VALUES (?, ?, ?)',
      [username, hashedPassword, 'user']
    );
    
    testUser.id = result.insertId;
    testUser.token = jwt.sign(
      { id: testUser.id, username, role: 'user' },
      process.env.JWT_SECRET || 'test_jwt_secret_123',
      { expiresIn: '2h' }
    );
    
    console.log('👤 测试患者用户 ID:', testUser.id);
    
    // 2. 加载staffList.json并获取一条测试数据
    try {
      const staffListPath = path.join(__dirname, '../../data/staffList.json');
      const staffListData = fs.readFileSync(staffListPath, 'utf8');
      const staffList = JSON.parse(staffListData);
      
      if (staffList && staffList.length > 0) {
        testStaffData = staffList[0]; // 使用第一条数据作为测试
        console.log('📋 使用员工数据:', {
          name: testStaffData.name,
          employeeId: testStaffData.employeeId,
          idNumber: testStaffData.idNumber ? testStaffData.idNumber.substring(0, 6) + '***' : '无'
        });
      } else {
        // 如果没有数据，创建一条测试数据
        testStaffData = {
          employeeId: `TEST${Date.now().toString().slice(-6)}`,
          name: '测试用户',
          idNumber: '110101199001011234'
        };
        console.log('⚠️  staffList.json为空，使用模拟数据');
      }
    } catch (error) {
      console.log('⚠️  无法读取staffList.json，使用模拟数据:', error.message);
      testStaffData = {
        employeeId: `TEST${Date.now().toString().slice(-6)}`,
        name: '测试用户',
        idNumber: '110101199001011234'
      };
    }
    
    // 3. 清理可能存在的旧档案
    await db.execute('DELETE FROM profiles WHERE account_id = ?', [testUser.id]);
  });

  afterAll(async () => {
    // 清理测试数据
    await db.execute('DELETE FROM profiles WHERE account_id = ?', [testUser.id]);
    await db.execute('DELETE FROM accounts WHERE id = ?', [testUser.id]);
  });

  test('PF-01: 获取空档案（初始状态）', async () => {
    console.log('📄 测试获取初始档案...');
    
    const response = await request(app)
      .get('/api/patient/me')
      .set('Authorization', `Bearer ${testUser.token}`)
      .expect(200);
    
    expect(response.body.success).toBe(true);
    
    // 可能返回null或空对象
    if (response.body.data === null || response.body.data.message) {
      console.log('✅ 初始档案为空，符合预期');
    } else {
      console.log('ℹ️  已有档案数据:', Object.keys(response.body.data));
    }
  });

  test('PF-02: 提交患者档案（实名认证）', async () => {
    if (!testStaffData) {
      console.log('⚠️  跳过档案提交测试，无员工数据');
      return;
    }
    
    console.log('📝 测试提交患者档案...');
    
    const profileData = {
      display_name: testStaffData.name,
      employeeId: testStaffData.employeeId,
      idcard: testStaffData.idNumber,
      phone: '13800138000', // 测试用手机号
      gender: '男',
      birthday: '1990-01-01',
      address: '北京市测试地址',
      email: 'test@example.com',
      extra: {
        emergency_contact: '紧急联系人',
        emergency_phone: '13900139000',
        allergies: ['青霉素']
      }
    };
    
    const response = await request(app)
      .post('/api/patient/submit')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send(profileData)
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data.display_name).toBe(testStaffData.name);
    
    console.log('✅ 档案提交成功:', {
      profileId: response.body.data.id,
      name: response.body.data.display_name
    });
  });

  test('PF-03: 验证档案已保存并可查询', async () => {
    console.log('🔍 验证档案保存状态...');
    
    const response = await request(app)
      .get('/api/patient/me')
      .set('Authorization', `Bearer ${testUser.token}`)
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data).not.toBeNull();
    
    const profile = response.body.data;
    
    // 验证关键字段
    expect(profile.display_name).toBe(testStaffData.name);
    expect(profile.phone).toBe('13800138000');
    expect(profile.idcard).toBe(testStaffData.idNumber);
    
    console.log('✅ 档案查询验证通过:', {
      name: profile.display_name,
      phone: profile.phone,
      hasExtra: !!profile.extra
    });
  });

  test('PF-04: 创建挂号订单验证信息带出', async () => {
    console.log('🏥 测试挂号时信息带出...');
    
    // 1. 先找一个有号源的医生和时段
    const [availRows] = await db.execute(
      `SELECT da.doctor_id, da.date, da.slot, d.department_id 
       FROM doctor_availability da
       JOIN doctors d ON da.doctor_id = d.id
       WHERE da.capacity > da.booked
       LIMIT 1`
    );
    
    if (availRows.length === 0) {
      console.log('⚠️  没有可用号源，跳过挂号测试');
      return;
    }
    
    const availability = availRows[0];
    console.log(`📅 使用排班: 医生${availability.doctor_id}, ${availability.date} ${availability.slot}`);
    
    // 2. 创建挂号订单
    const registrationData = {
      account_id: testUser.id,
      department_id: availability.department_id,
      doctor_id: availability.doctor_id,
      date: availability.date,
      slot: availability.slot,
      note: '测试挂号时信息带出',
      regi_type: '普通号'
    };
    
    const response = await request(app)
      .post('/api/registration/create')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send(registrationData)
      .expect(200);
    
    expect(response.body.success).toBe(true);
    
    const order = response.body.data;
    console.log('📦 创建挂号订单:', {
      orderId: order.id,
      status: order.status,
      hasNote: !!order.note
    });
    
    // 3. 验证订单关联的用户信息
    const [orderRows] = await db.execute(
      `SELECT o.*, a.username, p.display_name, p.phone
       FROM orders o
       JOIN accounts a ON o.account_id = a.id
       LEFT JOIN profiles p ON o.account_id = p.account_id
       WHERE o.id = ?`,
      [order.id]
    );
    
    expect(orderRows.length).toBe(1);
    const orderWithProfile = orderRows[0];
    
    // 验证订单关联的用户就是测试用户
    expect(orderWithProfile.account_id).toBe(testUser.id);
    
    // 如果关联了档案，验证档案信息
    if (orderWithProfile.display_name) {
      expect(orderWithProfile.display_name).toBe(testStaffData.name);
      console.log('✅ 挂号订单正确关联患者档案信息');
    } else {
      console.log('ℹ️  订单未关联详细档案信息');
    }
    
    // 清理测试订单
    await db.execute('DELETE FROM orders WHERE id = ?', [order.id]);
  });

  test('PF-05: 档案验证失败场景测试', async () => {
    console.log('❌ 测试档案验证失败场景...');
    
    const invalidProfileData = {
      display_name: '不存在的人员',
      employeeId: 'INVALID123',
      idcard: '123456789012345678',
      phone: '13800138000',
      gender: '男'
    };
    
    const response = await request(app)
      .post('/api/patient/submit')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send(invalidProfileData);
    
    // 应该返回400错误（与员工名单不匹配）
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('不匹配');
    
    console.log('✅ 档案验证失败测试通过:', response.body.message);
  });

  test('PF-06: 更新档案信息', async () => {
    console.log('🔄 测试更新档案信息...');
    
    const updatedProfileData = {
      display_name: testStaffData.name, // 姓名不变（必须匹配员工名单）
      employeeId: testStaffData.employeeId, // 工号不变
      idcard: testStaffData.idNumber, // 身份证不变
      phone: '13900139000', // 更新手机号
      gender: '女',
      birthday: '1995-05-15',
      address: '上海市更新地址',
      extra: {
        emergency_contact: '更新联系人',
        emergency_phone: '13600136000',
        allergies: ['青霉素', '花粉']
      }
    };
    
    const response = await request(app)
      .post('/api/patient/submit')
      .set('Authorization', `Bearer ${testUser.token}`)
      .send(updatedProfileData)
      .expect(200);
    
    expect(response.body.success).toBe(true);
    
    console.log('✅ 档案更新成功，新手机号:', updatedProfileData.phone);
    
    // 验证更新后的数据
    const verifyResponse = await request(app)
      .get('/api/patient/me')
      .set('Authorization', `Bearer ${testUser.token}`)
      .expect(200);
    
    expect(verifyResponse.body.data.phone).toBe('13900139000');
    expect(verifyResponse.body.data.gender).toBe('女');
    console.log('✅ 档案更新验证通过');
  });

  test('PF-07: 验证数据库中的档案数据', async () => {
    console.log('💾 验证数据库存储格式...');
    
    const [profileRows] = await db.execute(
      'SELECT * FROM profiles WHERE account_id = ?',
      [testUser.id]
    );
    
    expect(profileRows.length).toBe(1);
    const dbProfile = profileRows[0];
    
    // 验证数据库存储格式
    expect(dbProfile.account_id).toBe(testUser.id);
    expect(dbProfile.display_name).toBe(testStaffData.name);
    expect(dbProfile.idcard).toBe(testStaffData.idNumber);
    expect(dbProfile.phone).toBe('13900139000');
    
    // 性别应该存储为M/F
    expect(['M', 'F']).toContain(dbProfile.gender);
    
    // extra字段应该是JSON
    if (dbProfile.extra) {
      expect(typeof dbProfile.extra).toBe('object');
      console.log('📋 扩展信息:', dbProfile.extra);
    }
    
    console.log('✅ 数据库存储格式验证通过');
  });

  test('PF-08: 多个用户档案隔离测试', async () => {
    console.log('👥 测试多用户档案隔离...');
    
    // 创建第二个测试用户
    const secondUsername = `patient_test2_${Date.now()}`;
    const secondPassword = 'pass123';
    
    const hashedPassword = require('bcryptjs').hashSync(secondPassword, 10);
    const [secondResult] = await db.execute(
      'INSERT INTO accounts (username, password_hash, role) VALUES (?, ?, ?)',
      [secondUsername, hashedPassword, 'user']
    );
    
    const secondUserId = secondResult.insertId;
    const secondUserToken = jwt.sign(
      { id: secondUserId, username: secondUsername, role: 'user' },
      process.env.JWT_SECRET || 'test_jwt_secret_123',
      { expiresIn: '2h' }
    );
    
    console.log('👤 第二个测试用户 ID:', secondUserId);
    
    // 第二个用户提交档案（使用不同的员工数据）
    if (testStaffData) {
      const secondProfileData = {
        display_name: testStaffData.name, // 可以用相同姓名测试
        employeeId: testStaffData.employeeId,
        idcard: testStaffData.idNumber,
        phone: '13700137000', // 不同手机号
        gender: '男'
      };
      
      const response = await request(app)
        .post('/api/patient/submit')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send(secondProfileData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      
      // 验证两个用户的档案独立
      const [profiles] = await db.execute(
        'SELECT account_id, phone FROM profiles WHERE account_id IN (?, ?) ORDER BY account_id',
        [testUser.id, secondUserId]
      );
      
      expect(profiles.length).toBe(2);
      expect(profiles[0].phone).toBe('13900139000'); // 第一个用户
      expect(profiles[1].phone).toBe('13700137000'); // 第二个用户
      
      console.log('✅ 多用户档案隔离验证通过');
    }
    
    // 清理第二个用户
    await db.execute('DELETE FROM profiles WHERE account_id = ?', [secondUserId]);
    await db.execute('DELETE FROM accounts WHERE id = ?', [secondUserId]);
  });
});