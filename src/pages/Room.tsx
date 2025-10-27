import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface User {
  user_id: string;
  nick: string;
  avatar_url: string;
  color: string;
}

interface TypingUser {
  user_id: string;
  nick: string;
}

interface Message {
  id: number;
  room_id: string;
  author: User;
  text: string;
  created_at: string;
}

interface RoomInfo {
  room_id: string;
  name: string;
  capacity: number;
  current: number;
}

const ROOMS_API = 'https://functions.poehali.dev/2a2cf5ab-d01d-4975-88a1-cbb437d859dd';
const WS_API = 'https://functions.poehali.dev/2536b900-bcea-4f56-a373-de560254c885';
const WS_REALTIME_API = 'https://functions.poehali.dev/e67c0253-fceb-4f22-8395-9359bcf44c89';
const POLL_INTERVAL = 3000;
const WS_POLL_INTERVAL = 2000;

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollMembersRef = useRef<NodeJS.Timeout | null>(null);
  const pollMessagesRef = useRef<NodeJS.Timeout | null>(null);
  const pollWsRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef<number>(0);
  const lastWsTimestampRef = useRef<number>(0);
  const currentUserId = localStorage.getItem('user_id');

  const scrollToBottom = () => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(atBottom);
    }
  };

  const fetchRoomInfo = async () => {
    try {
      const response = await fetch(`${ROOMS_API}?room_id=${roomId}`);
      if (response.ok) {
        const data: RoomInfo = await response.json();
        setRoom(data);
      }
    } catch (error) {
      console.error('Fetch room info error:', error);
    }
  };

  const fetchMembers = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${ROOMS_API}?action=members&room_id=${roomId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data: User[] = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error('Fetch members error:', error);
    }
  };

  const fetchMessages = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${ROOMS_API}?action=messages&room_id=${roomId}&limit=30`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data: Message[] = await response.json();
        setMessages(data.slice(-30));
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    }
  };

  const pollNewMessages = async () => {
    if (!roomId) return;

    try {
      const response = await fetch(
        `${WS_REALTIME_API}?room_id=${roomId}&since=${lastWsTimestampRef.current}`
      );
      if (response.ok) {
        const data = await response.json();
        
        if (data.timestamp) {
          lastWsTimestampRef.current = data.timestamp;
        }

        if (data.messages && data.messages.length > 0) {
          data.messages.forEach((event: any) => {
            if (event.type === 'message_new' && event.message) {
              const newMessage: Message = event.message;
              
              setMessages(prev => {
                const exists = prev.some(m => m.id === newMessage.id);
                if (exists) return prev;
                const updated = [...prev, newMessage];
                return updated.slice(-30);
              });

              setTimeout(scrollToBottom, 100);
            }
          });
        }
      }
    } catch (error) {
      console.error('Poll new messages error:', error);
    }
  };

  const sendTypingIndicator = async () => {
    const now = Date.now();
    if (now - lastTypingTimeRef.current < 1000) return;
    lastTypingTimeRef.current = now;

    try {
      await fetch(WS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'typing',
          room_id: roomId,
          user_id: localStorage.getItem('user_id'),
          nick: localStorage.getItem('nick'),
        }),
      });
    } catch (error) {
      console.error('Typing indicator error:', error);
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setMessageText(text);

    if (text.length > 9 && !text.startsWith('/')) {
      sendTypingIndicator();
    }
  };

  const sendMessage = async () => {
    const text = messageText.trim();
    if (!text || text.length > 150 || isSending) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    setIsSending(true);

    try {
      const response = await fetch(`${ROOMS_API}?action=send&room_id=${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text,
          user_id: localStorage.getItem('user_id'),
          nick: localStorage.getItem('nick'),
          avatar_url: localStorage.getItem('avatar_url'),
          color: localStorage.getItem('color'),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newMessage: Message = data.message;
        
        setMessages(prev => {
          const exists = prev.some(m => m.id === newMessage.id);
          if (exists) return prev;
          const updated = [...prev, newMessage];
          return updated.slice(-30);
        });

        await fetch(WS_REALTIME_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'message_new',
            room_id: roomId,
            message: newMessage,
          }),
        });

        setMessageText('');
        setTimeout(scrollToBottom, 100);
      } else {
        const error = await response.json();
        if (error.error === 'empty') toast.error('Сообщение не может быть пустым');
        else if (error.error === 'too_long') toast.error('Сообщение слишком длинное');
        else toast.error('Ошибка отправки');
      }
    } catch (error) {
      toast.error('Ошибка сети');
    } finally {
      setIsSending(false);
    }
  };

  const leaveRoom = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${ROOMS_API}?action=leave&room_id=${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: localStorage.getItem('user_id') }),
      });

      if (response.ok) {
        await fetch(WS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'member_left',
            room_id: roomId,
            user_id: localStorage.getItem('user_id'),
            current: (room?.current || 1) - 1,
          }),
        });
        
        navigate('/lobby');
      }
    } catch (error) {
      console.error('Leave room error:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    fetchRoomInfo();
    fetchMembers();
    fetchMessages();

    lastWsTimestampRef.current = Date.now() / 1000;

    pollMembersRef.current = setInterval(fetchMembers, POLL_INTERVAL);
    pollMessagesRef.current = setInterval(fetchMessages, POLL_INTERVAL);
    pollWsRef.current = setInterval(pollNewMessages, WS_POLL_INTERVAL);

    return () => {
      if (pollMembersRef.current) clearInterval(pollMembersRef.current);
      if (pollMessagesRef.current) clearInterval(pollMessagesRef.current);
      if (pollWsRef.current) clearInterval(pollWsRef.current);
    };
  }, [roomId, navigate]);

  useEffect(() => {
    if (isAtBottom) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, isAtBottom]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(WS_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'get_typing', room_id: roomId }),
        });
        if (response.ok) {
          const data = await response.json();
          const typing = data.typing_users || [];
          setTypingUsers(typing.filter((u: TypingUser) => u.user_id !== currentUserId));
        }
      } catch (error) {
        console.error('Fetch typing users error:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [roomId, currentUserId]);

  if (!room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{room.name}</h1>
            <p className="text-sm text-muted-foreground">
              {room.current}/{room.capacity} игроков
            </p>
          </div>
          <Button variant="destructive" onClick={leaveRoom}>
            <Icon name="LogOut" className="mr-2" size={16} />
            Выйти
          </Button>
        </div>
      </div>

      <div className="border-b border-border p-4 bg-card">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 overflow-x-auto">
            {members.map((member) => (
              <div key={member.user_id} className="flex flex-col items-center gap-1 min-w-fit">
                <Avatar className="w-12 h-12 border-2 border-primary">
                  <AvatarImage src={member.avatar_url} alt={member.nick} />
                  <AvatarFallback>{member.nick[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span
                  className="text-xs font-bold px-2 py-1 rounded text-black"
                  style={{ backgroundColor: member.color }}
                >
                  {member.nick}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {typingUsers.length > 0 && (
        <div className="border-b border-border p-2 bg-card">
          <div className="max-w-4xl mx-auto">
            <p className="text-sm text-muted-foreground italic">
              {typingUsers.length === 1
                ? `${typingUsers[0].nick} печатает...`
                : typingUsers.length === 2
                ? `${typingUsers[0].nick} и ${typingUsers[1].nick} печатают...`
                : `${typingUsers[0].nick}, ${typingUsers[1].nick} и ${typingUsers[2].nick} печатают...`}
            </p>
          </div>
        </div>
      )}

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground">Пока нет сообщений</p>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.author.user_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <Avatar className="w-10 h-10 border-2 border-primary flex-shrink-0">
                    <AvatarImage src={msg.author.avatar_url} alt={msg.author.nick} />
                    <AvatarFallback>{msg.author.nick[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  
                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
                    <span
                      className="font-bold text-xs px-2 py-1 rounded text-black mb-1"
                      style={{ backgroundColor: msg.author.color }}
                    >
                      {msg.author.nick}
                    </span>
                    <div
                      className={`rounded-lg p-3 ${
                        isOwn ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'
                      }`}
                    >
                      <p className="break-words">{msg.text}</p>
                      <p className="text-xs opacity-70 mt-1 text-right">
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-border p-4 bg-card">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => toast.info('Прикрепление файлов скоро...')}
          >
            <Icon name="Paperclip" size={16} />
          </Button>
          <Input
            placeholder="Сообщение (до 150 символов)"
            value={messageText}
            onChange={handleMessageChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            maxLength={150}
            disabled={isSending}
            className="flex-1"
          />
          <div className="text-xs text-muted-foreground self-center min-w-[50px]">
            {messageText.length}/150
          </div>
          <Button
            onClick={sendMessage}
            disabled={!messageText.trim() || messageText.length > 150 || isSending}
          >
            <Icon name="Send" size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}