// concurrency_test.js - 测试高并发挂号
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = 'http://172.16.80.20:3000';

export const options = {
  scenarios: {
    // 场景1：同一医生同一时段的高并发
    same_slot_concurrent: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30s',
      exec: 'testSameSlot',
    },
    // 场景2：不同时段的并发
    different_slots: {
      executor: 'constant-vus',
      vus: 30,
      duration: '30s',
      exec: 'testDifferentSlots',
      startTime: '35s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.05'],
  },
};

// 预创建的用户和token
let testUser = null;

export function setup() {
  // 创建一个测试用户
  const username = `concurrent_test_${Date.now()}`;
  const password = 'Test123';
  
  // 注册
  const regRes = http.post(`${BASE_URL}/api/auth/register`, 
    JSON.stringify({ username, password }), {
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  if (regRes.status !== 201) {
    throw new Error('注册失败');
  }
  
  // 登录
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, 
    JSON.stringify({ username, password }), {
      headers: { 'Content-Type': 'application/json' }
    }
  );
  
  if (loginRes.status !== 200) {
    throw new Error('登录失败');
  }
  
  const data = JSON.parse(loginRes.body);
  testUser = {
    id: data.data?.id,
    token: data.data?.token,
    username
  };
  
  // 确保有足够的排班容量
  console.log('确保排班容量充足...');
  
  return { user: testUser };
}

// 测试场景1：同一时段高并发
export function testSameSlot(data) {
  const payload = {
    account_id: data.user.id,
    department_id: 1,
    doctor_id: 1,  // 固定医生
    date: getDateStr(1),  // 明天
    slot: '8-10',  // 固定时段
    note: '并发测试-同一时段'
  };
  
  const res = http.post(`${BASE_URL}/api/registration/create`, 
    JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.user.token}`
      },
      timeout: '10s'
    }
  );
  
  check(res, {
    '请求成功': (r) => r.status === 200 || r.status === 201,
    '无死锁': (r) => r.status !== 500 || !r.body.includes('deadlock'),
  });
}

// 测试场景2：不同时段并发
export function testDifferentSlots(data) {
  const slots = ['8-10', '10-12', '14-16', '16-18'];
  const slot = slots[Math.floor(Math.random() * slots.length)];
  
  const payload = {
    account_id: data.user.id,
    department_id: Math.floor(Math.random() * 5) + 1,
    doctor_id: Math.floor(Math.random() * 5) + 1,
    date: getDateStr(Math.floor(Math.random() * 3) + 1),
    slot: slot,
    note: '并发测试-不同时段'
  };
  
  const res = http.post(`${BASE_URL}/api/registration/create`, 
    JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.user.token}`
      },
      timeout: '10s'
    }
  );
  
  check(res, {
    '请求成功': (r) => r.status === 200 || r.status === 201,
  });
}

function getDateStr(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}