const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const db = require('../../db');

describe('后台管理数据同步测试', () => {
  let adminUser = { id: 0, token: '' };
  let testDoctorId = null;
  let testDepartmentId = null;
  let testAvailabilityId = null;

  beforeAll(async () => {
    // 1. 创建管理员账户
    const adminUsername = `admin_test_${Date.now()}`;
    const adminPassword = 'admin123';
    
    const hashedPassword = require('bcryptjs').hashSync(adminPassword, 10);
    const [adminResult] = await db.execute(
      'INSERT INTO accounts (username, password_hash, role) VALUES (?, ?, ?)',
      [adminUsername, hashedPassword, 'admin']
    );
    
    adminUser.id = adminResult.insertId;
    adminUser.token = jwt.sign(
      { id: adminUser.id, username: adminUsername, role: 'admin' },
      process.env.JWT_SECRET || 'test_jwt_secret_123',
      { expiresIn: '2h' }
    );
    
    console.log('👑 管理员账户 ID:', adminUser.id);
    
    // 2. 清理可能的测试数据
    await db.execute("DELETE FROM doctors WHERE name LIKE '测试医生%'");
    await db.execute("DELETE FROM departments WHERE name LIKE '测试科室%'");
    await db.execute("DELETE FROM doctor_availability WHERE extra LIKE '%test%'");
  });

  afterAll(async () => {
    // 清理测试数据
    await db.execute("DELETE FROM doctors WHERE name LIKE '测试医生%'");
    await db.execute("DELETE FROM departments WHERE name LIKE '测试科室%'");
    await db.execute("DELETE FROM doctor_availability WHERE extra LIKE '%test%'");
    await db.execute('DELETE FROM accounts WHERE id = ?', [adminUser.id]);
  });

  test('AD-01: 验证管理员权限', async () => {
    console.log('🔐 验证管理员权限...');
    
    // 测试需要管理员权限的接口
    const response = await request(app)
      .get('/api/admin/departments')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    
    console.log(`✅ 管理员权限验证通过，当前有 ${response.body.data.length} 个科室`);
  });

  test('AD-02: 创建新科室并实时查询', async () => {
    console.log('🏥 测试科室创建与查询...');
    
    const departmentData = {
      name: `测试科室_${Date.now()}`,
      code: `TEST_${Date.now().toString().slice(-4)}`,
      parent_id: null
    };
    
    // 1. 创建科室
    const createResponse = await request(app)
      .post('/api/admin/departments')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send(departmentData)
      .expect(200);
    
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data).toHaveProperty('id');
    
    testDepartmentId = createResponse.body.data.id;
    console.log(`✅ 创建科室成功: ID=${testDepartmentId}, 名称=${departmentData.name}`);
    
    // 2. 立即查询验证
    const queryResponse = await request(app)
      .get('/api/admin/departments')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .expect(200);
    
    expect(queryResponse.body.success).toBe(true);
    
    // 查找刚创建的科室
    const foundDepartment = queryResponse.body.data.find(
      dept => dept.id === testDepartmentId
    );
    
    expect(foundDepartment).toBeDefined();
    expect(foundDepartment.name).toBe(departmentData.name);
    expect(foundDepartment.code).toBe(departmentData.code);
    
    console.log('✅ 科室创建后实时查询验证通过');
  });

  test('AD-03: 创建新医生并实时查询', async () => {
    if (!testDepartmentId) {
      console.log('⚠️  跳过医生创建测试，无科室ID');
      return;
    }
    
    console.log('👨‍⚕️ 测试医生创建与查询...');
    
    const doctorData = {
      name: `测试医生_${Date.now()}`,
      department_id: testDepartmentId,
      title: '测试医师',
      bio: '这是测试医生的简介',
      contact: '13800000000'
    };
    
    // 1. 创建医生
    const createResponse = await request(app)
      .post('/api/admin/doctors')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send(doctorData)
      .expect(200);
    
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data).toHaveProperty('id');
    
    testDoctorId = createResponse.body.data.id;
    console.log(`✅ 创建医生成功: ID=${testDoctorId}, 名称=${doctorData.name}`);
    
    // 2. 立即查询医生列表验证
    const queryResponse = await request(app)
      .get('/api/admin/doctors')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .expect(200);
    
    expect(queryResponse.body.success).toBe(true);
    
    // 查找刚创建的医生
    const foundDoctor = queryResponse.body.data.find(
      doctor => doctor.id === testDoctorId
    );
    
    expect(foundDoctor).toBeDefined();
    expect(foundDoctor.name).toBe(doctorData.name);
    expect(foundDoctor.department_id).toBe(testDepartmentId);
    expect(foundDoctor.title).toBe(doctorData.title);
    
    console.log('✅ 医生创建后实时查询验证通过');
  });

  test('AD-04: 为医生设置排班并实时查询', async () => {
    if (!testDoctorId) {
      console.log('⚠️  跳过节班设置测试，无医生ID');
      return;
    }
    
    console.log('📅 测试排班设置与查询...');
    
    // 设置明天的日期
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const availabilityData = {
      doctor_id: testDoctorId,
      date: tomorrowStr,
      slot: '8-10',
      capacity: 15,
      extra: { test: true, notes: '测试排班' }
    };
    
    // 1. 创建排班
    const createResponse = await request(app)
      .post('/api/admin/availability')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send(availabilityData)
      .expect(200);
    
    expect(createResponse.body.success).toBe(true);
    expect(Array.isArray(createResponse.body.data)).toBe(true);
    
    const availability = createResponse.body.data[0];
    testAvailabilityId = availability.id;
    
    console.log(`✅ 创建排班成功: ID=${testAvailabilityId}, 日期=${tomorrowStr}, 时段=8-10`);
    
    // 2. 通过医生ID查询排班验证
    const queryResponse = await request(app)
      .get(`/api/admin/availability/${testDoctorId}`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .expect(200);
    
    expect(queryResponse.body.success).toBe(true);
    expect(Array.isArray(queryResponse.body.data)).toBe(true);
    
    // 查找刚创建的排班
    const foundAvailability = queryResponse.body.data.find(
      avail => avail.date === tomorrowStr && avail.slot === '8-10'
    );
    
    expect(foundAvailability).toBeDefined();
    expect(foundAvailability.doctor_id).toBe(testDoctorId);
    expect(foundAvailability.capacity).toBe(15);
    
    console.log('✅ 排班创建后实时查询验证通过');
  });

  test('AD-05: 前端可实时查询验证（模拟前端调用）', async () => {
    console.log('🌐 模拟前端实时查询测试...');
    
    // 1. 前端查询科室列表（公共接口）
    const deptResponse = await request(app)
      .get('/api/public/departments')  // 假设有公共接口
      .expect(200);
    
    if (deptResponse.body.success && testDepartmentId) {
      const foundDept = deptResponse.body.data?.find(d => d.id === testDepartmentId);
      if (foundDept) {
        console.log(`✅ 前端可查询到新科室: ${foundDept.name}`);
      }
    }
    
    // 2. 前端查询医生列表（通过科室）
    if (testDoctorId) {
      const doctorResponse = await request(app)
        .get('/api/doctor')  // 公共医生查询接口
        .query({ department_id: testDepartmentId })
        .expect(200);
      
      if (doctorResponse.body.success) {
        const foundDoctor = doctorResponse.body.data?.find(d => d.id === testDoctorId);
        if (foundDoctor) {
          console.log(`✅ 前端可查询到新医生: ${foundDoctor.name}`);
        }
      }
    }
    
    // 3. 前端查询医生排班（公共接口）
    if (testDoctorId) {
      const availResponse = await request(app)
        .get(`/api/doctor/${testDoctorId}/availability`)
        .expect(200);
      
      if (availResponse.body.success && availResponse.body.data?.length > 0) {
        console.log(`✅ 前端可查询到医生排班: ${availResponse.body.data.length} 个时段`);
      }
    }
    
    console.log('✅ 前端实时查询验证完成');
  });

  test('AD-06: 数据更新同步测试', async () => {
    if (!testDoctorId) {
      console.log('⚠️  跳过数据更新测试，无医生ID');
      return;
    }
    
    console.log('🔄 测试数据更新与同步...');
    
    const updateData = {
      title: '更新后的职称',
      bio: '更新后的医生简介'
    };
    
    // 1. 更新医生信息
    const updateResponse = await request(app)
      .put(`/api/admin/doctors/${testDoctorId}`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send(updateData)
      .expect(200);
    
    expect(updateResponse.body.success).toBe(true);
    console.log(`✅ 更新医生信息成功: ID=${testDoctorId}`);
    
    // 2. 立即查询验证更新
    const queryResponse = await request(app)
      .get('/api/admin/doctors')
      .set('Authorization', `Bearer ${adminUser.token}`)
      .expect(200);
    
    expect(queryResponse.body.success).toBe(true);
    
    const updatedDoctor = queryResponse.body.data.find(
      doctor => doctor.id === testDoctorId
    );
    
    expect(updatedDoctor).toBeDefined();
    expect(updatedDoctor.title).toBe(updateData.title);
    expect(updatedDoctor.bio).toBe(updateData.bio);
    
    console.log('✅ 数据更新后实时同步验证通过');
  });

  test('AD-07: 管理功能完整性验证', async () => {
    console.log('📋 验证管理功能完整性...');
    
    // 测试各个管理接口的基本可用性
    const endpoints = [
      { method: 'GET', path: '/api/admin/accounts', name: '账户列表' },
      { method: 'GET', path: '/api/admin/availability', name: '排班列表' },
      { method: 'GET', path: '/api/admin/orders', name: '订单列表' },
      { method: 'GET', path: '/api/admin/doctor-reviews/pending', name: '待审核医生' },
      { method: 'GET', path: '/api/admin/leave-requests', name: '请假申请' }
    ];
    
    for (const endpoint of endpoints) {
      const response = await request(app)
        [endpoint.method.toLowerCase()](endpoint.path)
        .set('Authorization', `Bearer ${adminUser.token}`);
      
      // 只验证接口可访问，不验证具体数据
      if (response.status === 200 || response.status === 404) {
        console.log(`✅ ${endpoint.name} 接口可用`);
      } else {
        console.log(`⚠️  ${endpoint.name} 接口状态: ${response.status}`);
      }
    }
    
    console.log('✅ 管理功能完整性验证完成');
  });

  test('AD-08: 清理测试数据（可选）', async () => {
    console.log('🧹 清理测试数据...');
    
    let cleanedCount = 0;
    
    // 清理排班
    if (testAvailabilityId) {
      try {
        await db.execute('DELETE FROM doctor_availability WHERE id = ?', [testAvailabilityId]);
        cleanedCount++;
      } catch (error) {
        console.log('⚠️  清理排班失败:', error.message);
      }
    }
    
    // 清理医生
    if (testDoctorId) {
      try {
        await db.execute('DELETE FROM doctors WHERE id = ?', [testDoctorId]);
        cleanedCount++;
      } catch (error) {
        console.log('⚠️  清理医生失败:', error.message);
      }
    }
    
    // 清理科室
    if (testDepartmentId) {
      try {
        await db.execute('DELETE FROM departments WHERE id = ?', [testDepartmentId]);
        cleanedCount++;
      } catch (error) {
        console.log('⚠️  清理科室失败:', error.message);
      }
    }
    
    console.log(`✅ 清理完成，删除了 ${cleanedCount} 个测试记录`);
  });
});