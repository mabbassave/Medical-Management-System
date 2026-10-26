import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { socket } from '../services/socket';
import { useAuthStore } from '../../store/authStore';

export const useAlerts = () => {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user?.id) {
      socket.emit('join', user.id);
    }

    const handleNotification = (data: unknown) => {
      const alertMessage =
        typeof data === 'string'
          ? data
          : (data as { message?: string })?.message || 'New clinical alert received';
      const isCritical =
        typeof data === 'object' &&
        data !== null &&
        (data as { type?: string }).type === 'critical';

      if (isCritical || alertMessage.toLowerCase().includes('critical')) {
        toast.error(`⚠️ CRITICAL ALERT: ${alertMessage}`, {
          duration: 6000,
          position: 'top-right',
        });
      } else {
        toast(`${alertMessage}`, {
          icon: '🔔',
          duration: 4000,
          position: 'top-right',
        });
      }
    };

    socket.on('notification', handleNotification);
    return () => {
      socket.off('notification', handleNotification);
    };
  }, [user?.id]);
};
