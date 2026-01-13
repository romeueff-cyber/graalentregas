import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Map, ExternalLink, Key } from 'lucide-react';

interface GoogleMapsSetupProps {
  onApiKeySubmit: (key: string) => void;
}

export function GoogleMapsSetup({ onApiKeySubmit }: GoogleMapsSetupProps) {
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onApiKeySubmit(apiKey.trim());
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-4 bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Map className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Configurar Google Maps</CardTitle>
          <CardDescription>
            Para exibir o mapa, insira sua chave da API do Google Maps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pl-10 h-12 font-mono text-sm"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12" disabled={!apiKey.trim()}>
              Salvar e Continuar
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              Como obter uma chave:
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Acesse o Google Cloud Console</li>
              <li>Crie um projeto ou selecione um existente</li>
              <li>Ative a "Maps JavaScript API"</li>
              <li>Crie uma credencial (API Key)</li>
            </ol>
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto mt-2 text-xs"
              onClick={() => window.open('https://console.cloud.google.com/google/maps-apis', '_blank')}
            >
              Abrir Google Cloud Console
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
