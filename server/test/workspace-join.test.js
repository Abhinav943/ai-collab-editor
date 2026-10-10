import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Workspace from '../src/models/Workspace.js';
import { joinWorkspace } from '../src/controllers/workspace.controller.js';

const { ObjectId } = mongoose.Types;

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

test('joining an already-member user does not duplicate their id', async (t) => {
  const userId = new ObjectId();
  const workspace = {
    isPublic: true,
    members: [new ObjectId(userId.toString())],
    saveCount: 0,
    async save() { this.saveCount += 1; },
  };

  t.mock.method(Workspace, 'findOne', async () => workspace);

  const req = { params: { roomId: 'room-1' }, user: { _id: userId } };
  const next = (err) => { throw err || new Error('next called'); };

  const first = mockRes();
  await joinWorkspace(req, first, next);
  const lengthAfterFirst = workspace.members.length;

  const second = mockRes();
  await joinWorkspace(req, second, next);

  assert.equal(first.body?.success, true);
  assert.equal(second.body?.success, true);
  assert.equal(lengthAfterFirst, 1);
  assert.equal(workspace.members.length, 1);
  assert.equal(workspace.saveCount, 0);
});

test('ObjectId membership cannot be checked with Array.includes', () => {
  const userId = new ObjectId();
  const members = [new ObjectId(userId.toString())];
  assert.equal(members.includes(userId), false);
  assert.equal(members.some((id) => id.equals(userId)), true);
});
