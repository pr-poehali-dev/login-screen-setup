import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const AVATAR_PRESETS = [
  'https://cdn.poehali.dev/4x/placeholder.svg',
  'https://cdn.poehali.dev/4x/placeholder.svg',
  'https://cdn.poehali.dev/4x/placeholder.svg',
  'https://cdn.poehali.dev/4x/placeholder.svg',
  'https://cdn.poehali.dev/4x/placeholder.svg',
  'https://cdn.poehali.dev/4x/placeholder.svg',
  'https://cdn.poehali.dev/4x/placeholder.svg',
];

export default function Login() {
  const [nickname, setNickname] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('#00FFFF');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hue, setHue] = useState(180);
  const [saturation, setSaturation] = useState(100);
  const [value, setValue] = useState(100);

  const handlePresetClick = (index: number) => {
    setSelectedPreset(index);
    setCustomAvatar(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size <= 300000) {
              const url = URL.createObjectURL(blob);
              setCustomAvatar(url);
              toast.success('Аватар загружен');
            } else {
              toast.error('Файл слишком большой (>300KB)');
            }
          },
          'image/webp',
          0.9
        );
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const hsvToHex = (h: number, s: number, v: number): string => {
    s /= 100;
    v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;

    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    const toHex = (n: number) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const applyColor = () => {
    const hex = hsvToHex(hue, saturation, value);
    setSelectedColor(hex);
    setIsColorPickerOpen(false);
    toast.success('Цвет применён');
  };

  const handleLogin = async () => {
    if (!nickname || nickname.length < 1 || nickname.length > 20) {
      toast.error('Никнейм должен быть от 1 до 20 символов');
      return;
    }

    setIsLoading(true);

    const avatarData = customAvatar
      ? { type: 'custom', value: customAvatar }
      : { type: 'preset', value: `preset_${selectedPreset}.png` };

    try {
      const response = await fetch('https://functions.poehali.dev/480a4621-44de-472e-aa66-27bc954e5603', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nick: nickname,
          avatar: avatarData,
          color: selectedColor,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user_id', data.user_id);
        localStorage.setItem('nick', data.nick);
        localStorage.setItem('avatar_url', data.avatar_url);
        localStorage.setItem('color', data.color);
        window.location.href = '/lobby';
      } else {
        toast.error('Ошибка входа');
      }
    } catch (error) {
      toast.error('Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <img
            src="https://cdn.poehali.dev/files/3a2278aa-53d7-496f-a77d-66a5c62bb3e0.png"
            alt="Urban Grove"
            className="w-64 h-auto"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <div className="grid grid-cols-7 gap-2">
            {AVATAR_PRESETS.map((preset, index) => (
              <button
                key={index}
                onClick={() => handlePresetClick(index)}
                className={`w-12 h-12 rounded-full border-2 overflow-hidden transition-all ${
                  selectedPreset === index && !customAvatar
                    ? 'border-primary shadow-[0_0_8px_hsl(var(--primary))]'
                    : 'border-muted'
                }`}
              >
                <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground rounded-sm">
                  {index + 1}
                </div>
              </button>
            ))}
          </div>

          {customAvatar && (
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full border-4 border-primary overflow-hidden shadow-[0_0_12px_hsl(var(--primary))]">
                <img
                  src={customAvatar}
                  alt="Custom Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => document.getElementById('avatar-upload')?.click()}
          >
            <Icon name="Upload" className="mr-2" size={16} />
            Загрузить аватар
          </Button>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          <div className="space-y-2">
            <Input
              placeholder="Ваш ник"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              className="text-black"
              style={{ backgroundColor: selectedColor }}
            />
            <div className="text-xs text-muted-foreground">{nickname.length}/20</div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setIsColorPickerOpen(true)}
          >
            <Icon name="Palette" className="mr-2" size={16} />
            Цвет
          </Button>

          <Button
            onClick={handleLogin}
            disabled={!nickname || nickname.length < 1 || nickname.length > 20 || isLoading}
            className="w-full text-lg"
          >
            {isLoading ? 'ВХОД...' : 'ВОЙТИ'}
          </Button>
        </div>
      </div>

      <Dialog open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выбор цвета</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm">Оттенок (H)</label>
              <input
                type="range"
                min="0"
                max="360"
                value={hue}
                onChange={(e) => setHue(Number(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm">Насыщенность (S)</label>
              <input
                type="range"
                min="0"
                max="100"
                value={saturation}
                onChange={(e) => setSaturation(Number(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm">Яркость (V)</label>
              <input
                type="range"
                min="0"
                max="100"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div
              className="w-full h-16 rounded border-2"
              style={{ backgroundColor: hsvToHex(hue, saturation, value) }}
            />

            <Button onClick={applyColor} className="w-full">
              Применить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}