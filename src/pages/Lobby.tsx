import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface User {
  user_id: string;
  nick: string;
  avatar_url: string;
  color: string;
}

export default function Lobby() {
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/connect?token=${token}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      websocket.send(JSON.stringify({ type: 'online' }));
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'online_list') {
          setOnlineUsers(data.users || []);
        } else if (data.type === 'user_joined') {
          setOnlineUsers((prev) => {
            if (prev.some(u => u.user_id === data.user.user_id)) {
              return prev;
            }
            return [...prev, data.user];
          });
          toast.success(`${data.user.nick} зашёл в лобби`);
        } else if (data.type === 'user_left') {
          setOnlineUsers((prev) => prev.filter(u => u.user_id !== data.user_id));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    websocket.onerror = () => {
      toast.error('Ошибка подключения');
    };

    websocket.onclose = () => {
      toast.error('Соединение закрыто');
    };

    setWs(websocket);

    return () => {
      websocket.close();
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
