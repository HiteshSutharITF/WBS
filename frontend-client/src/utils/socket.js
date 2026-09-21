import { io } from 'socket.io-client';

let socket = null;

export const initSocketClient = (tenantId) => {
  if (socket) return socket;

  const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    if (tenantId) {
      socket.emit('join_tenant', tenantId);
    }
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
