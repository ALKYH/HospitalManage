// registration_load_test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL || 'http://172.16.80.20:3000';

export const options = {
  stages: [
    { duration: '30s', target: 20 },    // 逐步增加到20个用户
    { duration: '1m', target: 50 },     // 峰值50个用户
    { duration: '30s', target: 20 },    // 逐步减少
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.03'],
  },
};

// 测试数据
const testData = new SharedArray('testData', function () {
  return [{
    // 医生和排班数据 - 需要确保数据库中有这些排班
    doctor_schedules: [
      { doctor_id: 1, date: getDateStr(1), slots: ['8-10', '10-12', '14-16'] },
      { doctor_id: 2, date: getDateStr(1), slots: ['8-10', '14-16', '16-18'] },
      { doctor_id: 3, date: getDateStr(2), slots: ['10-12', '14-16'] },
      // 可以添加更多
    ],
    departments: [1, 2, 3, 4, 5]
  }];
});

// 用户池
let authenticatedUsers = [];

export function setup() {
  console.log('🚀 准备挂号压力测试...');
  
  // 创建测试用户池
  const userCount = 30;
  authenticatedUsers = [];
  
  for (let i = 0; i < userCount; i++) {
    const user = createTestUser(i);
    if (user) authenticatedUsers.push(user);
    sleep(0.3);
  }
  
  console.log(`✅ 创建了 ${authenticatedUsers.length} 个测试用户`);
  
  // 确保有足够的排班容量
  console.log('💡 请确保数据库有足够的排班容量：');
  console.log(`
    USE hospital;
    
    -- 为医生创建排班（未来7天）
    INSERT IGNORE INTO doctor_availability (doctor_id, date, slot, capacity, booked) 
    SELECT 
      d.id,
      DATE_ADD(CURDATE(), INTERVAL day_offset DAY),
      slot,
      100,  -- 大容量
      0     -- 初始已预约数为0
    FROM doctors d
    CROSS JOIN (SELECT 1 as day_offset UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7) days
    CROSS JOIN (SELECT '8-10' as slot UNION SELECT '10-12' UNION SELECT '14-16' UNION SELECT '16-18') slots
    WHERE d.id IN (1, 2, 3, 4, 5);
    
    -- 查看排班
    SELECT 
      da.date,
      d.name as doctor_name,
      da.slot,
      da.capacity,
      da.booked,
      da.capacity - da.booked as available
    FROM doctor_availability da
    JOIN doctors d ON da.doctor_id = d.id
    WHERE da.date >= CURDATE()
    ORDER BY da.date, da.doctor_id, da.slot;
  `);
  
  return {
    users: authenticatedUsers,
    totalUsers: authenticatedUsers.length
  };
}

export default function (data) {
  const user = data.users[Math.floor(Math.random() * data.users.length)];
  const schedule = testData[0].doctor_schedules[
    Math.floor(Math.random() * testData[0].doctor_schedules.length)
  ];
  
  const slot = schedule.slots[Math.floor(Math.random() * schedule.slots.length)];
  const deptId = testData[0].departments[
    Math.floor(Math.random() * testData[0].departments.length)
  ];
  
  // 挂号请求
  const payload = {
    account_id: user.id,
    department_id: deptId,
    doctor_id: schedule.doctor_id,
    date: schedule.date,
    slot: slot,
    note: `压力测试 - ${new Date().toISOString()}`
  };
  
  const res = http.post(`${BASE_URL}/api/registration/create`, 
    JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
      },
      timeout: '15s'
    }
  );
  
  // 检查响应
  const success = check(res, {
    '状态码为200或201': (r) => r.status === 200 || r.status === 201,
    '响应时间<2s': (r) => r.timings.duration < 2000,
    '响应包含success字段': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.success === true;
      } catch (e) {
        return false;
      }
    }
  });
  
  if (!success) {
    console.log(`❌ 挂号失败 - 用户: ${user.username}, 状态码: ${res.status}`);
    console.log(`响应: ${res.body.substring(0, 200)}`);
  }
  
  sleep(Math.random() * 3 + 1);
}

// 工具函数
function getDateStr(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

function createTestUser(index) {
  const username = `load_user_${Date.now()}_${index}`;
  const password = 'Test123';
  
  // 注册
  const regRes = http.post(`${BASE_URL}/api/auth/register`, 
    JSON.stringify({ username, password }), {
      headers: { 'Content-Type': 'application/json' },
      timeout: '10s'
    }
  );
  
  if (regRes.status !== 201) return null;
  
  // 登录获取token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, 
    JSON.stringify({ username, password }), {
      headers: { 'Content-Type': 'application/json' },
      timeout: '10s'
    }
  );
  
  if (loginRes.status !== 200) return null;
  
  try {
    const data = JSON.parse(loginRes.body);
    return {
      id: data.data?.id,
      username: username,
      token: data.data?.token
    };
  } catch (e) {
    return null;
  }
}

export function teardown(data) {
  console.log('\n📊 测试完成');
  console.log(`测试用户数: ${data.totalUsers}`);
  console.log('\n💡 清理建议:');
  console.log(`
    -- 清理测试数据
    DELETE FROM accounts WHERE username LIKE 'load_user_%';
    DELETE FROM orders WHERE note LIKE '%压力测试%';
    
    -- 重置排班
    UPDATE doctor_availability SET booked = 0 WHERE date >= CURDATE();
  `);
}