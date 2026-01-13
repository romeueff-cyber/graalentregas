import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Key } from 'lucide-react';

interface GoogleMapsInlineSetupProps {
  onApiKeySubmit: (key: string) => void;
}

export function GoogleMapsInlineSetup({ onApiKeySubmit }: GoogleMapsInlineSetupProps) {
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    onApiKeySubmit(trimmed);
  };

  return (
    <div className="h-[200px] bg-muted/50 flex items-center justify-center p-3">
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <div className="space-y-2">
          <Label className="text-sm">Chave do Google Maps</Label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="pl-9 h-11 font-mono text-sm"
              autoComplete="off"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A chave fica salva neste dispositivo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" className="h-10" disabled={!apiKey.trim()}>
            Salvar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2"
            onClick={() =>
              window.open(
                'https://console.cloud.google.com/google/maps-apis/credentials',
                '_blank'
              )
            }
          >
            Credenciais
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
