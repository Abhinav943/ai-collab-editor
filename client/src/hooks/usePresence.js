import { useEffect, useState } from 'react';

export const usePresence = (roomId, socket) => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const handler = ({ users }) => setUsers(users);
    socket.on('presence:update', handler);
    return () => socket.off('presence:update', handler);
  }, [roomId, socket]);

  return users;
};
