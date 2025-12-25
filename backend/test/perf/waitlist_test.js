import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://172.16.80.20:3000';

export const options = {
  scenarios: {
    waitlist_creation: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 30,
      stages: [
        { target: 10, duration: '30s' },  // 创建候补订单
        { target: 10, duration: '1m' },
      ],
    },
    cancellation_processing: {
      executor: 'constant-arrival-rate',
      rate: 2,  // 每秒取消2个订单
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 5,
      maxVUs: 10,
      startTime: '1m',  // 1分钟后开始取消
    },
  },
  thresholds: {
    'http_req_duration{scenario:waitlist_creation}': ['p(95)<1000'],
    'http_req_duration{scenario:cancellation_processing}': ['p(95)<1500'],
  },
};

// 创建候补的测试用户
const waitlistUsers = new SharedArray('waitlist_users', function() {
  const users = [];
  for (let i = 1; i <= 50; i++) {
    users.push({
      username: `waitlist_user_${i}`,
      password: 'Test123!',
      token: null,
    });
  }
  return users;
});

// 已经占满的医生排班（用于创建候补）
const fullSchedules = new SharedArray('full_schedules', function() {
  const schedules = [];
  const today = new Date();
  
  // 创建几个已经满员的排班
  for (let i = 0; i < 5; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i + 1);
    schedules.push({
      doctor_id: i + 1,
      date: date.toISOString().split('T')[0],
      slot: '10-12',
      capacity: 0,  // 设置为0，确保创建候补
      booked: 0,
    });
  }
  return schedules;
});

let adminToken = '';

export function setup() {
  console.log('🔄 初始化候补队列测试...');
  
  // 管理员登录
  try {
    const adminRes = http.post(`${BASE_URL}/api/auth/login`, 
      JSON.stringify({
        username: 'admin',
        password: 'admin123',
      }), {
        headers: { 'Content-Type': 'application/json' },
        timeout: '10s'
      }
    );
    
    if (adminRes.status === 200) {
      const data = JSON.parse(adminRes.body);
      adminToken = data.data?.token || data.token;
      console.log('✅ 管理员登录成功');
    }
  } catch (e) {
    console.log('❌ 管理员登录失败');
  }
  
  // 为用户获取token
  const users = waitlistUsers.map(user => {
    try {
      // 先注册
      http.post(`${BASE_URL}/api/auth/register`, 
        JSON.stringify({
          username: user.username,
          password: user.password,
          role: 'user'
        }), {
          headers: { 'Content-Type': 'application/json' },
          timeout: '10s'
        }
      );
      
      // 再登录
      const loginRes = http.post(`${BASE_URL}/api/auth/login`, 
        JSON.stringify({
          username: user.username,
          password: user.password,
        }), {
          headers: { 'Content-Type': 'application/json' },
          timeout: '10s'
        }
      );
      
      if (loginRes.status === 200) {
        const data = JSON.parse(loginRes.body);
        return {
          ...user,
          token: data.data?.token || data.token,
          account_id: data.data?.id,
        };
      }
    } catch (e) {
      console.log(`用户 ${user.username} 登录失败`);
    }
    return user;
  }).filter(u => u.token);
  
  console.log(`✅ 准备 ${users.length} 个候补测试用户`);
  console.log(`📅 满员排班数量: ${fullSchedules.length}`);
  
  return { 
    users, 
    adminToken,
    createdOrders: []  // 存储创建的订单ID
  };
}

export default function (data) {
  if (__VU <= 20) {
    // VU 1-20: 创建候补订单
    createWaitlistOrder(data);
  } else {
    // VU 21-30: 取消订单触发候补转正
    cancelAndPromote(data);
  }
}

function createWaitlistOrder(data) {
  const user = randomItem(data.users.filter(u => u.account_id));
  const schedule = randomItem(fullSchedules);
  
  const payload = {
    account_id: user.account_id,
    doctor_id: schedule.doctor_id,
    department_id: 1,
    date: schedule.date,
    slot: schedule.slot,
    note: '候补测试订单',
    force_waitlist: true,  // 强制创建候补
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
  
  check(res, {
    '候补订单创建成功': (r) => {
      const success = r.status === 200 || r.status === 201;
      if (success) {
        try {
          const orderData = JSON.parse(r.body);
          if (orderData.data && orderData.data.id) {
            data.createdOrders.push(orderData.data.id);
          }
        } catch (e) {}
      }
      return success;
    },
    '候补订单状态正确': (r) => {
      try {
        const orderData = JSON.parse(r.body);
        return orderData.data?.is_waitlist === true || 
               orderData.data?.status === 'waiting';
      } catch {
        return false;
      }
    },
  });
  
  sleep(randomIntBetween(2, 5));
}

function cancelAndPromote(data) {
  if (data.createdOrders.length === 0) {
    sleep(1);
    return;
  }
  
  // 随机选择一个已确认的订单取消
  // 先获取一些已确认的订单
  const headers = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };
  
  // 获取已确认的订单
  const confirmedRes = http.get(
    `${BASE_URL}/api/admin/orders?status=confirmed&limit=10`,
    { headers }
  );
  
  if (confirmedRes.status === 200) {
    try {
      const ordersData = JSON.parse(confirmedRes.body);
      const orders = ordersData.data || ordersData.orders || [];
      
      if (orders.length > 0) {
        const order = randomItem(orders);
        
        // 取消订单
        const cancelRes = http.post(
          `${BASE_URL}/api/registration/cancel/${order.id}`,
          JSON.stringify({ cancelledBy: 'admin' }),
          { headers }
        );
        
        check(cancelRes, {
          '订单取消成功': (r) => r.status === 200,
          '触发候补转正': (r) => {
            try {
              const result = JSON.parse(r.body);
              return result.success === true;
            } catch {
              return false;
            }
          },
        });
        
        console.log(`🔄 取消订单 ${order.id}，触发候补转正`);
      }
    } catch (e) {}
  }
  
  sleep(randomIntBetween(5, 10));
}

export function teardown(data) {
  console.log('\n📊 候补队列处理测试完成');
  console.log(`✅ 创建的候补订单数: ${data.createdOrders.length}`);
  console.log('\n📈 测试结果分析:');
  console.log('   1. 候补订单创建性能');
  console.log('   2. 订单取消时自动候补转正');
  console.log('   3. 并发处理候补队列能力');
}