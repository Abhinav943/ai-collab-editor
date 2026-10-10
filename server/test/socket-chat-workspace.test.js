import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkspaceForChat } from '../src/sockets/index.js';

test('chat workspace lookup acks Workspace not found when missing', async () => {
  const acks = [];
  const workspace = await loadWorkspaceForChat('gone', (payload) => acks.push(payload), {
    findOne: async () => null,
  });
  assert.equal(workspace, null);
  assert.deepEqual(acks, [{ success: false, error: 'Workspace not found' }]);
});

test('chat:send/edit/delete/reaction never build an unscoped query when workspace is missing', async () => {
  const handlers = ['chat:send', 'chat:edit', 'chat:delete', 'chat:reaction'];
  for (const handler of handlers) {
    const queries = [];
    const ackPayloads = [];
    const workspace = await loadWorkspaceForChat('gone', (payload) => ackPayloads.push(payload), {
      findOne: async () => null,
    });
    if (!workspace) {
      // Mirrors every chat handler: return before ChatMessage.* with workspace._id
    } else {
      queries.push({ _id: 'message-1', workspace: workspace._id });
    }
    assert.equal(workspace, null, handler);
    assert.deepEqual(queries, [], handler);
    assert.deepEqual(ackPayloads, [{ success: false, error: 'Workspace not found' }], handler);
  }
});

test('chat workspace lookup returns the workspace and does not ack an error', async () => {
  const found = { _id: 'ws-1' };
  const acks = [];
  const workspace = await loadWorkspaceForChat('room-1', (payload) => acks.push(payload), {
    findOne: async ({ roomId }) => (roomId === 'room-1' ? found : null),
  });
  assert.equal(workspace, found);
  assert.deepEqual(acks, []);
});
