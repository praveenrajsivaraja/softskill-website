import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { collectOnlineUserIds, onlineUsersChannel, sameUserIds } from '@/lib/onlineUsers';

const OnlinePresenceContext = createContext<Set<string>>(new Set());

export const OnlinePresenceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      setOnlineUserIds(new Set());
      return;
    }

    const channel = supabase.channel(onlineUsersChannel);
    const publish = () => {
      const next = collectOnlineUserIds(channel.presenceState());
      setOnlineUserIds((current) => (sameUserIds(current, next) ? current : next));
    };

    channel.on('presence', { event: 'sync' }, publish);
    channel.on('presence', { event: 'join' }, publish);
    channel.on('presence', { event: 'leave' }, publish);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({ userId }).then((result) => {
          if (result !== 'ok') {
            console.error(JSON.stringify({ event: 'online_presence_track_failed', code: result }));
          }
        });
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(JSON.stringify({ event: 'online_presence_failed', code: status }));
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <OnlinePresenceContext.Provider value={onlineUserIds}>
      {children}
    </OnlinePresenceContext.Provider>
  );
};

export const useOnlineUserIds = () => useContext(OnlinePresenceContext);
