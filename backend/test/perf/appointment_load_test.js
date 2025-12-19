import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuration via environment variables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const VUS = __ENV.K6_VUS ? parseInt(__ENV.K6_VUS) : 50;
const DURATION = __ENV.K6_DURATION || '30s';

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% requests should be < 500ms
    http_req_failed: ['rate<0.05'], // <5% failed requests
  },
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function () {
  // Randomize user and doctor to spread load
  const account_id = randomInt(1, 1000);
  const doctor_id = randomInt(1, 10);
  const department_id = 1;
  // use today's date for requests
  const date = new Date().toISOString().split('T')[0];
  const slots = ['8-10', '10-12', '14-16', '16-18'];
  const slot = slots[Math.floor(Math.random() * slots.length)];

  const url = `${BASE_URL}/api/registration/create`;
  const payload = JSON.stringify({ account_id, department_id, doctor_id, date, slot });
  const params = { headers: { 'Content-Type': 'application/json' } };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'body has success true': (r) => {
      try { const j = JSON.parse(r.body); return j && j.success === true; } catch (e) { return false; }
    }
  });

  // small sleep to simulate user think time
  sleep(Math.random() * 1);
}
