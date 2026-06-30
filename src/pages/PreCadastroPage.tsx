import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AddressAutocomplete } from '@/components/pedidos-venda/AddressAutocomplete';
import { toast } from 'sonner';

interface PreVendaData {
  id: string;
  token: string;
  vendedor_nome: string | null;
  status: string;
  expires_at: string;
  submitted_at?: string | null;
}

export default function PreCadastroPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [prevenda, setPrevenda] = useState<PreVendaData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [endCadastro, setEndCadastro] = useState('');
  const [endCadastroLat, setEndCadastroLat] = useState<number | null>(null);
  const [endCadastroLng, setEndCadastroLng] = useState<number | null>(null);
  const [numeroCadastro, setNumeroCadastro] = useState('');
  const [complementoCadastro, setComplementoCadastro] = useState('');
  const [usarMesmo, setUsarMesmo] = useState(true);
  const [endEntrega, setEndEntrega] = useState('');
  const [endEntregaLat, setEndEntregaLat] = useState<number | null>(null);
  const [endEntregaLng, setEndEntregaLng] = useState<number | null>(null);
  const [numeroEntrega, setNumeroEntrega] = useState('');
  const [complementoEntrega, setComplementoEntrega] = useState('');
  const [dataEntrega, setDataEntrega] = useState('');
  const [horario, setHorario] = useState('');
  const [tolerancia, setTolerancia] = useState(30);
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-prevenda-link', {
          method: 'GET' as any,
          // edge func reads query string, use direct fetch
        });
        // fallback to direct fetch (functions.invoke doesn't pass query)
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-prevenda-link?token=${encodeURIComponent(token)}`;
        const r = await fetch(url, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        });
        const j = await r.json();
        if (!r.ok) {
          setErrorMsg(j?.error || 'Link inválido');
        } else {
          setPrevenda(j.prevenda);
          if (j.prevenda.status === 'enviado' || j.prevenda.status === 'convertido') {
            setDone(true);
          }
        }
        // suppress unused
        void data; void error;
      } catch (e: any) {
        setErrorMsg(e?.message || 'Erro ao carregar');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const composeAddress = (base: string, numero: string, complemento: string) => {
    let s = base.trim();
    if (numero.trim()) {
      // try to insert número after the street (before first comma)
      if (s.includes(',')) {
        const [street, ...rest] = s.split(',');
        s = `${street.trim()}, ${numero.trim()}${rest.length ? ',' + rest.join(',') : ''}`;
      } else {
        s = `${s}, ${numero.trim()}`;
      }
    }
    if (complemento.trim()) s += ` - ${complemento.trim()}`;
    return s;
  };

  const submit = async () => {
    if (!nome.trim() || !cpfCnpj.trim() || !endCadastro.trim()) {
      toast.error('Preencha nome, CPF/CNPJ e endereço.');
      return;
    }
    if (!numeroCadastro.trim()) {
      toast.error('Informe o número do endereço.');
      return;
    }
    setSubmitting(true);
    try {
      const enderecoCadastroFinal = composeAddress(endCadastro, numeroCadastro, complementoCadastro);
      const enderecoEntregaFinal = usarMesmo
        ? enderecoCadastroFinal
        : composeAddress(endEntrega, numeroEntrega, complementoEntrega);
      const { data, error } = await supabase.functions.invoke('submit-prevenda', {
        body: {
          token,
          nome,
          cpf_cnpj: cpfCnpj,
          telefone,
          email,
          endereco_cadastro: enderecoCadastroFinal,
          endereco_cadastro_lat: endCadastroLat,
          endereco_cadastro_lng: endCadastroLng,
          usar_mesmo_endereco: usarMesmo,
          endereco_entrega: enderecoEntregaFinal,
          endereco_entrega_lat: usarMesmo ? endCadastroLat : endEntregaLat,
          endereco_entrega_lng: usarMesmo ? endCadastroLng : endEntregaLng,
          horario_entrega: horario || null,
          tolerancia_min: tolerancia,
          data_entrega: dataEntrega || null,
          observacoes,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDone(true);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao enviar');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (errorMsg || !prevenda) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Link indisponível</h1>
          <p className="text-muted-foreground">{errorMsg || 'Este link de pré-cadastro não está mais válido.'}</p>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
          <h1 className="text-xl font-semibold">Pré-cadastro enviado!</h1>
          <p className="text-muted-foreground">
            Recebemos seus dados. {prevenda.vendedor_nome ? `${prevenda.vendedor_nome} entrará em contato.` : 'O vendedor entrará em contato em breve.'}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Pré-cadastro</h1>
          <p className="text-sm text-muted-foreground">
            {prevenda.vendedor_nome ? `Enviado por ${prevenda.vendedor_nome}` : 'Preencha seus dados para o vendedor'}
          </p>
        </header>

        <Card className="p-4 space-y-3">
          <div>
            <Label>Nome / Razão social *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>CPF / CNPJ *</Label>
            <Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} maxLength={30} inputMode="numeric" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Endereço de cadastro *</Label>
            <AddressAutocomplete
              value={endCadastro}
              onChange={setEndCadastro}
              onSelect={(r) => {
                setEndCadastro(r.formatted);
                setEndCadastroLat(r.lat ?? null);
                setEndCadastroLng(r.lng ?? null);
                if (r.numero) setNumeroCadastro(r.numero);
              }}
              placeholder="Rua, bairro, cidade"
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <Label>Número *</Label>
                <Input
                  value={numeroCadastro}
                  onChange={(e) => setNumeroCadastro(e.target.value)}
                  inputMode="numeric"
                  placeholder="123"
                />
              </div>
              <div>
                <Label>Complemento</Label>
                <Input
                  value={complementoCadastro}
                  onChange={(e) => setComplementoCadastro(e.target.value)}
                  placeholder="Sala, bloco..."
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <Checkbox checked={usarMesmo} onCheckedChange={(v) => setUsarMesmo(!!v)} />
            <span className="text-sm">Usar o mesmo endereço para entrega</span>
          </label>

          {!usarMesmo && (
            <div>
              <Label>Endereço de entrega</Label>
              <AddressAutocomplete
                value={endEntrega}
                onChange={setEndEntrega}
                onSelect={(r) => {
                  setEndEntrega(r.formatted);
                  setEndEntregaLat(r.lat ?? null);
                  setEndEntregaLng(r.lng ?? null);
                  if (r.numero) setNumeroEntrega(r.numero);
                }}
                placeholder="Rua, bairro, cidade"
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label>Número</Label>
                  <Input
                    value={numeroEntrega}
                    onChange={(e) => setNumeroEntrega(e.target.value)}
                    inputMode="numeric"
                    placeholder="123"
                  />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input
                    value={complementoEntrega}
                    onChange={(e) => setComplementoEntrega(e.target.value)}
                    placeholder="Sala, bloco..."
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Data de entrega desejada</Label>
            <Input
              type="date"
              value={dataEntrega}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDataEntrega(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Horário preferido</Label>
              <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </div>
            <div>
              <Label>Tolerância (min)</Label>
              <Input
                type="number"
                min={0}
                max={240}
                step={15}
                value={tolerancia}
                onChange={(e) => setTolerancia(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Ex.: 10:00 com tolerância 30 min = entrega entre 09:30 e 10:30.
          </p>

          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={500} />
          </div>

          <Button className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Enviar pré-cadastro
          </Button>
        </Card>
      </div>
    </div>
  );
}
