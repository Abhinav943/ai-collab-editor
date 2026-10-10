import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import useWorkspaceStore from '../stores/useWorkspaceStore.js';
import useAuthStore from '../stores/useAuthStore.js';
import { useState } from 'react';

let socketInstance = null;

export const getSocket = () => socketInstance;

export const useSocket = (roomId, user) => {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [joined, setJoined] = useState(false);
  const { addFile, removeFile, updateFileMetadata } = useWorkspaceStore();

  const connect = useCallback(() => {
    if (socketRef.current?.connected || socketRef.current?.active) return socketRef.current;
    socketRef.current = null;
    const socket = io(import.meta.env.VITE_SERVER_URL || window.location.origin, {
      transports: ['websocket'],
      auth: { token: useAuthStore.getState().token || localStorage.getItem('token') },
    });
    socketRef.current = socket;
    socketInstance = socket;
    setSocket(socket);

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      // Wait for the server to confirm the join before anyone tries to sync a
      // document — otherwise the first sync lands before we are in the room.
      socket.emit('workspace:join', { roomId }, (response) => {
        if (response?.success) setJoined(true);
        else console.error('[Socket] join failed:', response?.error);
      });
    });

    socket.on('file:create', ({ file }) => addFile(file));
    socket.on('file:delete', ({ fileId }) => removeFile(fileId));
    socket.on('file:rename', ({ fileId, newName, path }) => updateFileMetadata(fileId, { name: newName, path }));
    socket.on('file:language', ({ fileId, language }) => updateFileMetadata(fileId, { language }));

    socket.on('connect_error', (error) => console.error('[Socket] Connection failed:', error.message));
    socket.on('disconnect', () => { setJoined(false); console.log('[Socket] Disconnected'); });
    return socket;
  }, [roomId, user, addFile, removeFile, updateFileMetadata]);

  useEffect(() => {
    if (!roomId || !user) return;
    const socket = connect();
    return () => {
      if (socketRef.current !== socket) return;
      socket.emit('workspace:leave', { roomId });
      socket.disconnect();
      socketRef.current = null;
      if (socketInstance === socket) socketInstance = null;
      setJoined(false);
      setSocket(null);
    };
  }, [roomId, user?._id]);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socket, emit, joined };
};
