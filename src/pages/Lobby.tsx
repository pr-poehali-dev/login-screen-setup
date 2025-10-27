import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface User {
  user_id: string;
  nick: string;
  avatar_url: string;
  color: string;
}

const ONLINE_API = 'https://functions.poehali.dev/4d372ca1-0154-4874-adfa-c59c4172bd88';
const HEARTBEAT_INTERVAL = 10000;
const POLL_INTERVAL = 5000;

export default function Lobby() {
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [previousUserIds, setPreviousUserIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const sendHeartbeat = async () => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('user_id');
    const nick = localStorage.getItem('nick');
    const avatarUrl = localStorage.getItem('avatar_url');
    const color = localStorage.getItem('color');

    if (!token || !userId || !nick || !avatarUrl || !color) return;

    try {
      await fetch(ONLINE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({
          user_id: userId,
          nick,
          avatar_url: avatarUrl,
          color,
        }),
      });
    } catch (error) {
      console.error('Heartbeat error:', error);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const response = await fetch(ONLINE_API);
      if (response.ok) {
        const data = await response.json();
        const newUsers: User[] = data.users || [];
        
        const newUserIds = new Set(newUsers.map(u => u.user_id));
        
        newUsers.forEach(user => {
          if (!previousUserIds.has(user.user_id)) {
            const currentUserId = localStorage.getItem('user_id');
            if (user.user_id !== currentUserId) {
              toast.success(`${user.nick} зашёл в лобби`);
            }
          }
        });

        setOnlineUsers(newUsers);
        setPreviousUserIds(newUserIds);
      }
    } catch (error) {
      console.error('Fetch online users error:', error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    sendHeartbeat();
    fetchOnlineUsers();

    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    pollRef.current = setInterval(fetchOnlineUsers, POLL_INTERVAL);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex justify-center">
          <img
            src="https://cdn.poehali.dev/files/3a2278aa-53d7-496f-a77d-66a5c62bb3e0.png"
            alt="Urban Grove"
            className="w-64 h-auto"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Онлайн:</h2>

          {onlineUsers.length === 0 ? (
            <p className="text-muted-foreground">Пока никого нет</p>
          ) : (
            <div className="space-y-3">
              {onlineUsers.map((user) => (
                <div
                  key={user.user_id}
                  className="flex items-center gap-3 p-3 rounded"
                >
                  <Avatar className="w-12 h-12 border-2 border-primary">
                    <AvatarImage src={user.avatar_url} alt={user.nick} />
                    <AvatarFallback>{user.nick[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span
                    className="font-bold px-3 py-1 rounded text-black"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.nick}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
