import { MessageSquare, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { formatDateAr, parseMentions } from '../lib/utils';
import type { Transaction } from '../types';

interface TeamMember {
  id: string;
  displayName: string;
}

interface Props {
  tx: Transaction;
  currentUserId?: string;
  teamMembers?: TeamMember[];
  onAddComment?: (txId: string, text: string) => void | Promise<void>;
  onClaim?: (txId: string) => void | Promise<void>;
  onReleaseClaim?: (txId: string) => void | Promise<void>;
  readOnly?: boolean;
}

function highlightMentions(text: string) {
  const parts = text.split(/(@[^\s@]+)/g);
  return parts.map((part, index) => (
    part.startsWith('@')
      ? <span key={index} className="font-semibold text-sky-400">{part}</span>
      : <span key={index}>{part}</span>
  ));
}

export function TransactionCoordination({
  tx,
  currentUserId,
  teamMembers = [],
  onAddComment,
  onClaim,
  onReleaseClaim,
  readOnly = false,
}: Props) {
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const comments = tx.comments ?? [];
  const isClaimed = !!tx.claimedByUserId;
  const isMine = isClaimed && tx.claimedByUserId === currentUserId;

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || !onAddComment) return;
    setSubmitting(true);
    try {
      await Promise.resolve(onAddComment(tx.id, text));
      setCommentText('');
    } finally {
      setSubmitting(false);
    }
  }

  function insertMention(name: string) {
    setCommentText(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}@${name} `);
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-700/80 bg-slate-900/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {isClaimed ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-lg bg-sky-500/15 px-2 py-1 text-xs text-sky-300">
              <UserCheck size={12} />
              {isMine ? 'أنت بتتابع' : `يتابع: ${tx.claimedByName}`}
            </span>
            {!readOnly && isMine && onReleaseClaim && (
              <button
                type="button"
                onClick={() => onReleaseClaim(tx.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:text-rose-400"
              >
                <UserX size={12} />
                إلغاء المتابعة
              </button>
            )}
          </>
        ) : (
          !readOnly && onClaim && (
            <button
              type="button"
              onClick={() => onClaim(tx.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-600/20 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-600/30"
            >
              <UserCheck size={12} />
              أنا بتابع هالعملية
            </button>
          )
        )}
      </div>

      {comments.length > 0 && (
        <div className="space-y-2">
          {comments.map(c => (
            <div key={c.id} className="rounded-lg bg-slate-950/70 px-2.5 py-2 text-xs">
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500">
                <span className="font-medium text-slate-300">{c.byName ?? 'موظف'}</span>
                <span>{formatDateAr(c.at.slice(0, 10))}</span>
                {c.mentions?.length ? (
                  <span className="text-sky-400/80">@{c.mentions.join(' @')}</span>
                ) : null}
              </div>
              <p className="text-slate-200 leading-relaxed">{highlightMentions(c.text)}</p>
            </div>
          ))}
        </div>
      )}

      {!readOnly && onAddComment && (
        <form onSubmit={submitComment} className="space-y-2">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <MessageSquare size={12} />
            تعليق {parseMentions(commentText).length ? `(@${parseMentions(commentText).join(' @')})` : ''}
          </div>
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="اكتب تعليق... استخدم @اسم لمنشن زميل"
            rows={2}
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2.5 py-2 text-xs text-slate-200"
          />
          {teamMembers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {teamMembers
                .filter(m => m.id !== currentUserId)
                .slice(0, 8)
                .map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => insertMention(m.displayName)}
                    className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-sky-300 hover:bg-slate-700"
                  >
                    @{m.displayName}
                  </button>
                ))}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || !commentText.trim()}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-50"
          >
            إضافة تعليق
          </button>
        </form>
      )}
    </div>
  );
}
