import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface User {
  user_id: string;
  nick: string;
  avatar_url: string;
  color: string;
}

interface Room {
  room_id: string;
  name: string;
  capacity: number;
  current: number;
}

const ONLINE_API = 'https://functions.poehali.dev/4d372ca1-0154-4874-adfa-c59c4172bd88';
const ROOMS_API = 'https://functions.poehali.dev/2a2cf5ab-d01d-4975-88a1-cbb437d859dd';
const WS_API = 'https://functions.poehali.dev/2536b900-bcea-4f56-a373-de560254c885';
const HEARTBEAT_INTERVAL = 10000;
const POLL_INTERVAL = 5000;
const TOAST_DEBOUNCE_MS = 5000;

export default function Lobby() {
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [previousUserIds, setPreviousUserIds] = useState<Set<string>>(new Set());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomCapacity, setRoomCapacity] = useState(5);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const navigate = useNavigate();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const roomsPollRef = useRef<NodeJS.Timeout | null>(null);
  const lastToastTimestamp = useRef<Map<string, number>>(new Map());

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
        const currentTime = Date.now();
        
        newUsers.forEach(user => {
          if (!previousUserIds.has(user.user_id)) {
            const currentUserId = localStorage.getItem('user_id');
            if (user.user_id !== currentUserId) {
              const lastShown = lastToastTimestamp.current.get(user.user_id) || 0;
              if (currentTime - lastShown > TOAST_DEBOUNCE_MS) {
                toast.success(`${user.nick} зашёл в лобби`);
                lastToastTimestamp.current.set(user.user_id, currentTime);
              }
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

  const fetchRooms = async () => {
    try {
      const response = await fetch(ROOMS_API);
      if (response.ok) {
        const data: Room[] = await response.json();
        setRooms(data);
      }
    } catch (error) {
      console.error('Fetch rooms error:', error);
    }
  };

  const createRoom = async () => {
    if (!roomName || roomName.length < 1 || roomName.length > 20) {
      toast.error('Название должно быть от 1 до 20 символов');
      return;
    }

    if (roomCapacity < 2 || roomCapacity > 20) {
      toast.error('Вместимость должна быть от 2 до 20');
      return;
    }

    setIsCreatingRoom(true);

    try {
      const response = await fetch(ROOMS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName, capacity: roomCapacity }),
      });

      if (response.ok) {
        const newRoom: Room = await response.json();
        setRooms(prev => [newRoom, ...prev]);
        
        await fetch(WS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'room_created', room: newRoom }),
        });

        setIsCreateRoomOpen(false);
        setRoomName('');
        setRoomCapacity(5);
        toast.success('Комната создана');
      } else {
        toast.error('Ошибка создания комнаты');
      }
    } catch (error) {
      toast.error('Ошибка сети');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const joinRoom = async (roomId: string) => {
    setJoiningRoomId(roomId);

    try {
      const response = await fetch(`${ROOMS_API}/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: localStorage.getItem('user_id'),
          nick: localStorage.getItem('nick'),
          avatar_url: localStorage.getItem('avatar_url'),
          color: localStorage.getItem('color'),
        }),
      });

      if (response.ok) {
        const updatedRoom: Room = await response.json();
        
        await fetch(WS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'member_joined',
            room_id: roomId,
            user: {
              user_id: localStorage.getItem('user_id'),
              nick: localStorage.getItem('nick'),
              avatar_url: localStorage.getItem('avatar_url'),
              color: localStorage.getItem('color'),
            },
            current: updatedRoom.current,
          }),
        });

        navigate(`/room/${roomId}`);
      } else {
        const error = await response.json();
        if (error.error === 'room_full') {
          toast.error('Комната заполнена');
        } else if (error.error === 'already_in_room') {
          toast.error('Вы уже в этой комнате');
        } else {
          toast.error('Ошибка входа');
        }
      }
    } catch (error) {
      toast.error('Ошибка сети');
    } finally {
      setJoiningRoomId(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    let isInitialMount = true;
    
    const runInitialFetch = async () => {
      if (isInitialMount) {
        await sendHeartbeat();
        await fetchOnlineUsers();
        await fetchRooms();
        isInitialMount = false;
      }
    };

    runInitialFetch();

    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    pollRef.current = setInterval(fetchOnlineUsers, POLL_INTERVAL);
    roomsPollRef.current = setInterval(fetchRooms, POLL_INTERVAL);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      if (roomsPollRef.current) clearInterval(roomsPollRef.current);
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Комнаты</h2>
            <Button onClick={() => setIsCreateRoomOpen(true)}>
              <Icon name="Plus" className="mr-2" size={16} />
              Создать комнату
            </Button>
          </div>

          {rooms.length === 0 ? (
            <p className="text-muted-foreground">Пока нет комнат</p>
          ) : (
            <div className="grid gap-3">
              {rooms.map((room) => (
                <div
                  key={room.room_id}
                  className="border border-border rounded-lg p-4 flex items-center justify-between hover:bg-accent transition-colors"
                >
                  <div>
                    <h3 className="font-bold text-lg">{room.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {room.current}/{room.capacity} игроков
                    </p>
                  </div>
                  <Button
                    onClick={() => joinRoom(room.room_id)}
                    disabled={joiningRoomId === room.room_id || room.current >= room.capacity}
                  >
                    {joiningRoomId === room.room_id ? 'Вход...' : 'Войти'}
                  </Button>
                </div>
              ))}
            </div>
          )}
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

      <Dialog open={isCreateRoomOpen} onOpenChange={setIsCreateRoomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать комнату</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Название</label>
              <Input
                placeholder="Название комнаты"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                maxLength={20}
              />
              <div className="text-xs text-muted-foreground">{roomName.length}/20</div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Вместимость</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRoomCapacity(Math.max(2, roomCapacity - 1))}
                  disabled={roomCapacity <= 2}
                >
                  <Icon name="Minus" size={16} />
                </Button>
                <span className="text-2xl font-bold w-12 text-center">{roomCapacity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRoomCapacity(Math.min(20, roomCapacity + 1))}
                  disabled={roomCapacity >= 20}
                >
                  <Icon name="Plus" size={16} />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">От 2 до 20 игроков</div>
            </div>

            <Button
              onClick={createRoom}
              disabled={!roomName || roomName.length < 1 || roomName.length > 20 || isCreatingRoom}
              className="w-full"
            >
              {isCreatingRoom ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}