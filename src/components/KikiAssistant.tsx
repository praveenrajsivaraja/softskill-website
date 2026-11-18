import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, MessageCircle, Paperclip, Send, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { describeSheetImport } from '@/lib/spreadsheet';
import { downloadExcelReport, type ExcelDownload } from '@/lib/excelReport';
import {
  confirmProposedRows,
  detectImportKind,
  findAssessmentReplaceWarning,
  recordsFromCsv,
  savableRowCount,
  validateClientRows,
  type ImportKind,
} from '@/lib/kiki/proposedRows';
import { answerLocally } from '@/lib/kiki/localAnswers';
import {
  followUpQuestions,
  hiddenAssistantPaths,
  notUnderstoodText,
  sanitizeAssistantLinks,
  starterQuestions,
  type AssistantLink,
} from '@/lib/kiki/routes';

const welcomeText = "Hi! I'm KIKI, your intelligent learning assistant. I can help you explore courses, analyze platform data, manage learning content, understand application features, and guide you through your learning journey. What would you like to know?";

type CallerRole = 'guest' | 'student' | 'instructor' | 'admin';

interface AssistantTable {
  columns: string[];
  rows: string[][];
}

interface AssistantStat {
  label: string;
  value: string;
}

interface ImportPreview {
  importKind: ImportKind;
  rows: Record<string, string>[];
  errors: string[];
  replaceWarning: string | null;
  status: 'pending' | 'saving' | 'done';
  report: string | null;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  createdAt: string;
  table: AssistantTable | null;
  stats: AssistantStat[] | null;
  links: AssistantLink[];
  report: ExcelDownload | null;
  preview: ImportPreview | null;
  suggestions: string[];
}

interface AssistantPayload {
  message?: string;
  table?: AssistantTable | null;
  stats?: AssistantStat[] | null;
  links?: AssistantLink[];
  preview?: {
    importKind: ImportKind;
    rows: Record<string, string>[];
    errors: string[];
    replaceWarning: string | null;
  };
  unavailable?: boolean;
}

const timeLabel = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const nextMessage = (
  role: ChatMessage['role'],
  text: string,
  extra: Partial<Pick<ChatMessage, 'table' | 'stats' | 'links' | 'report' | 'preview' | 'suggestions'>> = {},
): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  text,
  createdAt: new Date().toISOString(),
  table: extra.table ?? null,
  stats: extra.stats ?? null,
  links: extra.links ?? [],
  report: extra.report ?? null,
  preview: extra.preview ?? null,
  suggestions: extra.suggestions ?? [],
});

const readFailure = async (error: unknown): Promise<string> => {
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: { status?: number; json?: () => Promise<AssistantPayload> } }).context
    : undefined;
  if (context?.status === 401) {
    return 'Sign in to use KIKI.';
  }
  if (context?.json) {
    const body = await context.json().catch(() => null);
    if (body?.message) {
      return body.message;
    }
  }
  console.error(JSON.stringify({ event: 'kiki_request_failed', code: context?.status ?? 'unknown' }));
  return 'KIKI could not answer just now. Please try again.';
};

const askKiki = async (body: Record<string, unknown>): Promise<AssistantPayload> => {
  const { data, error } = await supabase.functions.invoke('kiki-chat', { body });
  if (error) {
    throw new Error(await readFailure(error));
  }
  return (data ?? {}) as AssistantPayload;
};

const KikiAssistant = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState<CallerRole>('guest');
  const [messages, setMessages] = useState<ChatMessage[]>([
    nextMessage('assistant', welcomeText, { suggestions: starterQuestions(false) }),
  ]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAdmin = role === 'admin';

  useEffect(() => {
    if (!user) {
      setRole('guest');
      return;
    }
    let cancelled = false;
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle().then(({ data, error }) => {
      if (cancelled) {
        return;
      }
      if (error) {
        console.error(JSON.stringify({ event: 'kiki_role_lookup_failed', code: error.code }));
        setRole('student');
        return;
      }
      const nextRole = data?.role;
      setRole(nextRole === 'admin' || nextRole === 'instructor' || nextRole === 'student' ? nextRole : 'student');
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const starters = starterQuestions(isAdmin);
    setMessages((current) => {
      if (current.length !== 1 || current[0]?.text !== welcomeText) {
        return current;
      }
      if (current[0].suggestions.join('|') === starters.join('|')) {
        return current;
      }
      return [{ ...current[0], suggestions: starters }];
    });
  }, [isAdmin]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, isSending, isOpen]);

  if (hiddenAssistantPaths.has(location.pathname)) {
    return null;
  }

  const append = (message: ChatMessage) => setMessages((current) => [...current, message]);

  const sendText = async (text: string) => {
    const content = text.trim();
    if (!content || isSending) {
      return;
    }
    setMessages((current) => [...current, nextMessage('user', content)]);
    setDraft('');
    setIsSending(true);
    try {
      const local = await answerLocally(content, isAdmin ? 'admin' : role, user?.id ?? null);
      const suggestions = followUpQuestions(content, isAdmin);
      if (local) {
        append(nextMessage('assistant', local.text, {
          table: local.table,
          stats: local.stats,
          links: sanitizeAssistantLinks(local.links, isAdmin),
          report: local.report,
          suggestions,
        }));
        if (local.report?.downloadNow) {
          downloadExcelReport(local.report.filename, local.report.sheets);
        }
        return;
      }
      append(nextMessage('assistant', notUnderstoodText, { suggestions }));
    } catch (error) {
      console.error(JSON.stringify({ event: 'kiki_request_failed', code: error instanceof Error ? error.name : 'unknown' }));
      append(nextMessage('assistant', notUnderstoodText, {
        suggestions: followUpQuestions(content, isAdmin),
      }));
    } finally {
      setIsSending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void sendText(draft);
  };

  const uploadFile = async (file: File) => {
    if (!isAdmin) {
      append(nextMessage('assistant', 'Only an administrator can prepare records for import.'));
      return;
    }
    setIsSending(true);
    try {
      const { extractDocument } = await import('@/lib/kiki/extractDocument');
      const extracted = await extractDocument(file);
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'csv') {
        const rows = recordsFromCsv(extracted.text);
        const kind = detectImportKind(rows);
        if (typeof kind !== 'string') {
          append(nextMessage('assistant', kind.error));
          return;
        }
        await showPreview(kind, rows, extracted.truncated);
        return;
      }
      const payload = await askKiki({ mode: 'structure', documentText: extracted.text });
      if (!payload.preview) {
        append(nextMessage('assistant', payload.message || 'KIKI could not match that document to a template.'));
        return;
      }
      await showPreview(payload.preview.importKind, payload.preview.rows, extracted.truncated, payload.preview.errors, payload.preview.replaceWarning);
    } catch (error) {
      append(nextMessage('assistant', error instanceof Error ? error.message : 'KIKI could not read that file.'));
    } finally {
      setIsSending(false);
    }
  };

  const showPreview = async (
    kind: ImportKind,
    rows: Record<string, string>[],
    truncated: boolean,
    serverErrors: string[] = [],
    serverWarning: string | null = null,
  ) => {
    const errors = [...new Set([...validateClientRows(kind, rows), ...serverErrors])];
    const warning = kind === 'assessments' ? serverWarning ?? await findAssessmentReplaceWarning(rows) : null;
    const limitNote = truncated ? ' Only the first part of the document was read.' : '';
    append(nextMessage('assistant', `Review these rows. Nothing is saved until you confirm.${limitNote}`, {
      preview: { importKind: kind, rows, errors, replaceWarning: warning, status: 'pending', report: null },
    }));
  };

  const updatePreview = (messageId: string, change: (preview: ImportPreview) => ImportPreview) => {
    setMessages((current) => current.map((message) => (
      message.id === messageId && message.preview ? { ...message, preview: change(message.preview) } : message
    )));
  };

  const editCell = (messageId: string, rowIndex: number, column: string, value: string) => {
    updatePreview(messageId, (preview) => {
      const rows = preview.rows.map((row, index) => index === rowIndex ? { ...row, [column]: value } : row);
      return { ...preview, rows, errors: validateClientRows(preview.importKind, rows) };
    });
  };

  const removeRow = (messageId: string, rowIndex: number) => {
    updatePreview(messageId, (preview) => {
      const rows = preview.rows.filter((_, index) => index !== rowIndex);
      return { ...preview, rows, errors: validateClientRows(preview.importKind, rows) };
    });
  };

  const confirmPreview = async (messageId: string) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message?.preview || !isAdmin || message.preview.status !== 'pending') {
      return;
    }
    const preview = message.preview;
    if (preview.importKind === 'assessments') {
      const warning = await findAssessmentReplaceWarning(preview.rows);
      if (warning && warning !== preview.replaceWarning) {
        updatePreview(messageId, (current) => ({ ...current, replaceWarning: warning }));
        return;
      }
    }
    updatePreview(messageId, (current) => ({ ...current, status: 'saving' }));
    try {
      const result = await confirmProposedRows(preview.importKind, preview.rows);
      const report = `Checked ${preview.rows.length} rows. ${describeSheetImport(result)}`;
      updatePreview(messageId, (current) => ({ ...current, status: 'done', report }));
    } catch (error) {
      console.error(JSON.stringify({
        event: 'kiki_import_failed',
        code: error instanceof Error ? error.name : 'import_failed',
      }));
      updatePreview(messageId, (current) => ({
        ...current,
        status: 'pending',
        report: 'Those rows could not be saved. Nothing else was changed.',
      }));
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-[80] flex items-center gap-2 rounded-full bg-kiki-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-kiki-purple-700"
        >
          <MessageCircle className="h-5 w-5" />
          KIKI
        </button>
      )}
      {isOpen && (
        <section className="fixed inset-0 z-[80] flex flex-col bg-white lg:inset-auto lg:bottom-5 lg:right-5 lg:h-[620px] lg:max-h-[calc(100vh-2.5rem)] lg:w-[400px] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-gray-200 lg:shadow-2xl">
          <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">KIKI</h2>
              <p className="text-xs text-gray-500">{isAdmin ? 'Administrator' : 'Learning assistant'}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setMessages([nextMessage('assistant', welcomeText, { suggestions: starterQuestions(isAdmin) })])} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Clear conversation">
                <Trash2 className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Close KIKI">
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isAdmin={isAdmin}
                onEdit={editCell}
                onRemove={removeRow}
                onConfirm={confirmPreview}
                onAsk={(question) => void sendText(question)}
              />
            ))}
            {isSending && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                KIKI is thinking
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={submit} className="flex items-end gap-2 border-t border-gray-200 p-3">
            {isAdmin && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,.txt,.pdf,.docx,text/csv,text/plain,application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) {
                      void uploadFile(file);
                    }
                  }}
                />
                <button type="button" onClick={() => fileInput.current?.click()} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Upload a document">
                  <Paperclip className="h-4 w-4" />
                </button>
              </>
            )}
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendText(draft);
                }
              }}
              rows={1}
              placeholder="Ask KIKI"
              className="max-h-24 flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-kiki-purple-400"
            />
            <button type="submit" disabled={isSending || draft.trim().length === 0} className="rounded-full bg-kiki-purple-600 p-2 text-white disabled:opacity-40" aria-label="Send">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
};

interface MessageBubbleProps {
  message: ChatMessage;
  isAdmin: boolean;
  onEdit: (messageId: string, rowIndex: number, column: string, value: string) => void;
  onRemove: (messageId: string, rowIndex: number) => void;
  onConfirm: (messageId: string) => void;
  onAsk: (question: string) => void;
}

const replyBlocks = (text: string) => {
  const blocks: Array<{ kind: 'text' | 'points'; lines: string[] }> = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const isPoint = line.startsWith('→') || line.startsWith('->');
    const content = line.replace(/^(?:→|->)\s*/, '');
    const previous = blocks[blocks.length - 1];
    if (isPoint && previous?.kind === 'points') {
      previous.lines.push(content);
      continue;
    }
    blocks.push({ kind: isPoint ? 'points' : 'text', lines: [content] });
  }
  return blocks;
};

const ReplyBody = ({ text, isUser }: { text: string; isUser: boolean }) => {
  const blocks = replyBlocks(text);
  if (isUser || blocks.length === 0 || (blocks.length === 1 && blocks[0].kind === 'text')) {
    return <p className="whitespace-pre-wrap">{text}</p>;
  }
  return (
    <div className="space-y-2">
      {blocks.map((block, blockIndex) => (
        block.kind === 'text' ? (
          <p key={`${block.lines[0]}-${blockIndex}`}>{block.lines[0]}</p>
        ) : (
          <ul key={`points-${blockIndex}`} className="space-y-1.5">
            {block.lines.map((line, lineIndex) => (
              <li key={`${line}-${lineIndex}`} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 font-semibold text-kiki-purple-600" aria-hidden="true">→</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )
      ))}
    </div>
  );
};

const MessageBubble = ({ message, isAdmin, onEdit, onRemove, onConfirm, onAsk }: MessageBubbleProps) => {
  const isUser = message.role === 'user';
  const columns = message.preview ? [...new Set(message.preview.rows.flatMap((row) => Object.keys(row)))] : [];
  return (
    <article className={`max-w-[95%] rounded-2xl px-3 py-2 text-sm ${isUser ? 'ml-auto bg-kiki-purple-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <ReplyBody text={message.text} isUser={isUser} />
      {message.stats && message.stats.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {message.stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-white px-2 py-1 text-gray-900">
              <p className="text-[11px] text-gray-500">{stat.label}</p>
              <p className="font-semibold">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
      {message.table && <DataTable table={message.table} />}
      {message.report && (
        <button
          type="button"
          onClick={() => downloadExcelReport(message.report.filename, message.report.sheets)}
          className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-kiki-purple-700"
        >
          Download report
        </button>
      )}
      {message.links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {message.links.map((link) => (
            <Link key={link.path} to={link.path} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-kiki-purple-700">
              {link.label}
            </Link>
          ))}
        </div>
      )}
      {message.preview && (
        <div className="mt-2 space-y-2 text-gray-900">
          {message.preview.replaceWarning && <p className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">{message.preview.replaceWarning}</p>}
          {message.preview.errors.map((error) => <p key={error} className="text-xs text-red-700">{error}</p>)}
          {columns.length > 0 && (
            <div className="max-h-48 overflow-auto rounded-lg bg-white">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr>{columns.map((column) => <th key={column} className="px-2 py-1 font-medium">{column}</th>)}<th /></tr>
                </thead>
                <tbody>
                  {message.preview.rows.map((row, rowIndex) => (
                    <tr key={`${message.id}-${rowIndex}`}>
                      {columns.map((column) => (
                        <td key={column} className="px-1 py-1">
                          <input
                            value={row[column] ?? ''}
                            disabled={message.preview?.status !== 'pending'}
                            onChange={(event) => onEdit(message.id, rowIndex, column, event.target.value)}
                            className="w-28 rounded border border-gray-200 px-1 py-1"
                          />
                        </td>
                      ))}
                      <td>
                        {message.preview?.status === 'pending' && (
                          <button type="button" onClick={() => onRemove(message.id, rowIndex)} className="text-red-600">Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {message.preview.report && <p className="text-xs">{message.preview.report}</p>}
          {isAdmin && message.preview.status !== 'done' && (
            <button
              type="button"
              disabled={message.preview.status === 'saving' || savableRowCount(message.preview.importKind, message.preview.rows) === 0}
              onClick={() => onConfirm(message.id)}
              className="rounded-full bg-kiki-purple-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              {message.preview.status === 'saving' ? 'Saving' : 'Confirm import'}
            </button>
          )}
        </div>
      )}
      {!isUser && message.suggestions.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] font-medium text-gray-500">
            {message.text === welcomeText ? 'Suggested questions' : 'Related questions'}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onAsk(suggestion)}
                className="rounded-full border border-kiki-purple-200 bg-white px-3 py-1 text-left text-xs text-kiki-purple-800 hover:bg-kiki-purple-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className={`mt-1 text-[10px] ${isUser ? 'text-kiki-purple-100' : 'text-gray-500'}`}>{timeLabel(message.createdAt)}</p>
    </article>
  );
};

const DataTable = ({ table }: { table: AssistantTable }) => (
  <div className="mt-2 max-h-48 overflow-auto rounded-lg bg-white text-gray-900">
    <table className="min-w-full text-left text-xs">
      <thead>
        <tr>{table.columns.map((column) => <th key={column} className="px-2 py-1 font-medium">{column}</th>)}</tr>
      </thead>
      <tbody>
        {table.rows.map((row, index) => (
          <tr key={`${row.join('-')}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="px-2 py-1">{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default KikiAssistant;
