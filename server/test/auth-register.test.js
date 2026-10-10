import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from '../src/controllers/auth.controller.js';
import User from '../src/models/User.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-that-is-at-least-32-chars';

function mockRes() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

test('registering with a short password returns 400 and a message', async () => {
  const req = { body: { username: 'alice', email: 'alice@example.com', password: '123' } };
  const res = mockRes();
  await register(req, res, (err) => { throw err || new Error('next called'); });
  assert.equal(res.statusCode, 400);
  assert.match(res.body?.error?.message || '', /password/i);
});

test('registering with a short username returns 400 and a message', async () => {
  const req = { body: { username: 'ab', email: 'ab@example.com', password: '123456' } };
  const res = mockRes();
  await register(req, res, (err) => { throw err || new Error('next called'); });
  assert.equal(res.statusCode, 400);
  assert.match(res.body?.error?.message || '', /username/i);
});

test('register happy path still returns 201', async (t) => {
  t.mock.method(User, 'findOne', async () => null);
  t.mock.method(User, 'create', async (data) => ({
    _id: 'user-1',
    toPublic: () => ({ username: data.username, email: data.email }),
  }));

  const req = { body: { username: 'alice', email: 'alice@example.com', password: 'secret1' } };
  const res = mockRes();
  await register(req, res, (err) => { throw err || new Error('next called'); });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body?.success, true);
  assert.ok(res.body?.data?.token);
  assert.equal(res.body?.data?.user?.username, 'alice');
});
