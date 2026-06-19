import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StickyNote, Plus, Check, Trash2, CalendarClock, Loader2, X } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useClientNotes } from '@/hooks/useClientNotes';

interface Props {
  clientName: string;
}

export function ClientNotesCard({ clientName }: Props) {
  const { notes, isLoading, createNote, updateNote, deleteNote } = useClientNotes(clientName);
  const [adding, setAdding] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  const handleAdd = async () => {
    if (!noteText.trim()) return;
    await createNote.mutateAsync({
      client_name: clientName,
      note: noteText,
      follow_up_date: followUpDate || null,
    });
    setNoteText('');
    setFollowUpDate('');
    setAdding(false);
  };

  const openCount = notes.filter(n => !n.resolved).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <StickyNote className="w-4 h-4" />
            Notas & Follow-up
            {openCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">{openCount} aberta{openCount > 1 ? 's' : ''}</Badge>
            )}
          </CardTitle>
          {!adding && (
            <Button size="sm" variant="outline" className="h-8" onClick={() => setAdding(true)}>
              <Plus className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Nova</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <Textarea
              placeholder="Ex.: Cliente vai viajar até dia 25 · Aguardando reposição de freezer..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              maxLength={500}
              className="text-sm"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" />
                Follow-up:
              </label>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="h-8 text-sm w-auto flex-1 max-w-[180px]"
              />
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => { setAdding(false); setNoteText(''); setFollowUpDate(''); }}
                  disabled={createNote.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="h-8"
                  onClick={handleAdd}
                  disabled={!noteText.trim() || createNote.isPending}
                >
                  {createNote.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-4 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando…
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            Nenhuma nota para este cliente. Use as notas para combinar contatos e follow-ups.
          </p>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {notes.map(n => {
              let dueClass = '';
              let dueLabel = '';
              if (n.follow_up_date && !n.resolved) {
                const d = new Date(n.follow_up_date + 'T12:00:00');
                if (isPast(d) && !isToday(d)) { dueClass = 'text-destructive'; dueLabel = 'Atrasado'; }
                else if (isToday(d)) { dueClass = 'text-amber-600'; dueLabel = 'Hoje'; }
                else { dueClass = 'text-muted-foreground'; dueLabel = ''; }
              }
              return (
                <div
                  key={n.id}
                  className={`rounded-md border p-3 text-sm ${n.resolved ? 'opacity-60 bg-muted/30' : 'bg-card'}`}
                >
                  <p className={`whitespace-pre-wrap break-words ${n.resolved ? 'line-through' : ''}`}>
                    {n.note}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                      <span>{format(new Date(n.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                      {n.follow_up_date && (
                        <span className={`flex items-center gap-1 ${dueClass}`}>
                          <CalendarClock className="w-3 h-3" />
                          {format(new Date(n.follow_up_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          {dueLabel && <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px]">{dueLabel}</Badge>}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!n.resolved ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-status-collected hover:text-status-collected"
                          onClick={() => updateNote.mutate({ id: n.id, resolved: true })}
                          title="Marcar como resolvido"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => updateNote.mutate({ id: n.id, resolved: false })}
                          title="Reabrir"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Remover esta nota?')) deleteNote.mutate(n.id);
                        }}
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
