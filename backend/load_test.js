import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp to 50 users
    { duration: '1m', target: 200 }, // Ramp to 200 users
    { duration: '2m', target: 200 }, // Stay at 200 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
};

export default function () {
  const url = 'http://localhost:5002/execute';
  const payload = JSON.stringify({
    code: "print('Hello from k6')",
    lang: 'python',
    stdinInput: '',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'is status 200': (r) => r.status === 200,
    'output correct': (r) =>
      r.json('output') && r.json('output').trim() === 'Hello from k6',
  });

  sleep(1);
}
