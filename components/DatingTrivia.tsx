'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { TRIVIA_QUESTIONS, type TriviaQuestion, type TriviaOption } from '@/lib/trivia-questions';
import { useT } from '@/lib/i18n/provider';

// FEEDBACK_HOLD_MS controls how long a picked answer's feedback shows before
// the next question loads. Kept short (1000ms) because analysis windows can
// be 5-8s in fast paths — at 2000ms users were only seeing one question.
const FEEDBACK_HOLD_MS = 1000;
const INTERRUPT_HOLD_MS = 700;
const INTERRUPT_DEBOUNCE_MS = 350;

type TrackFn = (event: string, params?: Record<string, any>) => void;

type Props = {
  active: boolean;
  onTrack?: TrackFn;
};

const pickRandom = (excludeId?: number): TriviaQuestion => {
  const pool = excludeId != null
    ? TRIVIA_QUESTIONS.filter((q) => q.id !== excludeId)
    : TRIVIA_QUESTIONS;
  return pool[Math.floor(Math.random() * pool.length)];
};

type Selection = { questionId: number; opt: TriviaOption };

export default function DatingTrivia({ active, onTrack }: Props) {
  const t = useT().trivia;
  const [current, setCurrent] = useState<TriviaQuestion | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [interrupting, setInterrupting] = useState(false);

  // Question-id guard: only honor selection if it belongs to the current
  // question. Option ids are 'a'|'b'|'c'|'d' which collide across questions,
  // so a stale selection would otherwise paint the same letter on every
  // new question.
  const selected = selection && current && selection.questionId === current.id ? selection.opt : null;

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef = useRef<TriviaQuestion | null>(null);
  const selectedRef = useRef<Selection | null>(null);
  const onTrackRef = useRef<TrackFn | undefined>(onTrack);

  const scheduleAdvance = useCallback(() => {
    if (advanceTimer.current) return;
    advanceTimer.current = setTimeout(() => {
      const cur = currentRef.current;
      if (!cur) {
        advanceTimer.current = null;
        return;
      }
      const next = pickRandom(cur.id);
      setSelection(null);
      setCurrent(next);
      onTrackRef.current?.('trivia_shown', { question_id: next.id });
      advanceTimer.current = null;
    }, FEEDBACK_HOLD_MS);
  }, []);

  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { selectedRef.current = selection; }, [selection]);
  useEffect(() => { onTrackRef.current = onTrack; }, [onTrack]);

  useEffect(() => {
    if (active) {
      if (interruptDebounceTimer.current) {
        clearTimeout(interruptDebounceTimer.current);
        interruptDebounceTimer.current = null;
      }
      if (interruptTimer.current) {
        clearTimeout(interruptTimer.current);
        interruptTimer.current = null;
      }
      setInterrupting(false);
      if (!currentRef.current) {
        const first = pickRandom();
        setCurrent(first);
        onTrackRef.current?.('trivia_shown', { question_id: first.id });
      } else if (
        selectedRef.current &&
        selectedRef.current.questionId === currentRef.current.id &&
        !advanceTimer.current
      ) {
        scheduleAdvance();
      }
      return;
    }

    if (!currentRef.current || interrupting) return;

    if (interruptDebounceTimer.current) clearTimeout(interruptDebounceTimer.current);
    // If the user just answered and a next-question advance is pending, give
    // it room to fire first — otherwise they'd see "answer feedback → trivia
    // vanished" with no second question (which felt buggy at FEEDBACK_HOLD_MS
    // = 2s + fast 3-5s scans). Letting the advance run means they get one
    // more question even if the paywall starts to cover it.
    const debounce = advanceTimer.current
      ? FEEDBACK_HOLD_MS + INTERRUPT_DEBOUNCE_MS
      : INTERRUPT_DEBOUNCE_MS;
    interruptDebounceTimer.current = setTimeout(() => {
      interruptDebounceTimer.current = null;
      if (!currentRef.current) return;
      onTrackRef.current?.('trivia_interrupted', {
        question_id: currentRef.current.id,
        had_selection: !!selectedRef.current,
      });
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
      setInterrupting(true);
      interruptTimer.current = setTimeout(() => {
        setCurrent(null);
        setSelection(null);
        setInterrupting(false);
        interruptTimer.current = null;
      }, INTERRUPT_HOLD_MS);
    }, debounce);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      if (interruptTimer.current) clearTimeout(interruptTimer.current);
      if (interruptDebounceTimer.current) clearTimeout(interruptDebounceTimer.current);
    };
  }, []);

  const handleSelect = useCallback((opt: TriviaOption) => {
    if (selected || !current) return;
    setSelection({ questionId: current.id, opt });
    onTrackRef.current?.('trivia_answered', {
      question_id: current.id,
      option_id: opt.id,
    });
    // [fix 2026-05-18] 点完立即 blur，避免下一题渲染时浏览器把焦点 ring 留在
    // 上一题相同位置的按钮上（视觉上像"下一题默认选中上次的选项"）。
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    scheduleAdvance();
  }, [selected, current, scheduleAdvance]);

  if (!active && !interrupting) return null;
  if (interrupting) {
    return (
      <div className="rounded-card border border-hairline bg-canvas shadow-ab-card px-5 py-4 flex items-center justify-center gap-2 animate-in fade-in duration-300">
        <Sparkles className="size-4 text-rausch shrink-0" />
        <span className="text-sm font-medium text-ink">
          {t.interrupting}
        </span>
      </div>
    );
  }
  if (!current) return null;

  return (
    <div className="rounded-card border border-hairline bg-canvas shadow-ab-card px-5 py-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase tracking-[0.32px] text-ink-muted font-bold">
          {t.whileYouWait}
        </span>
        <span className="text-xs text-ink-muted">{t.datingIq}</span>
      </div>

      <h4 className="text-[20px] font-semibold text-ink leading-[1.2] tracking-[-0.18px] mb-5">
        {current.question}
      </h4>

      <div className="flex flex-col gap-2">
        {current.options.map((opt) => {
          const isSelected = selected?.id === opt.id;
          const isOther = !!selected && !isSelected;
          return (
            // [fix 2026-05-18] key 同时包含 question.id，让 React 每换题就
            // remount 按钮 → 焦点自然消失，下一题不会"默认选中上次的位置"。
            <button
              key={`${current.id}-${opt.id}`}
              type="button"
              disabled={!!selected}
              onClick={() => handleSelect(opt)}
              className={[
                'group text-left rounded-card border px-4 py-3 transition-all duration-200',
                'flex items-start gap-3',
                isSelected
                  ? 'border-ink border-2 bg-surface-soft'
                  : isOther
                    ? 'border-hairline-soft bg-canvas opacity-40 cursor-default'
                    : 'border-hairline bg-canvas hover:border-ink hover:bg-surface-soft cursor-pointer active:scale-[0.99]',
              ].join(' ')}
            >
              <span
                className={[
                  'shrink-0 grid size-7 place-items-center rounded-full font-semibold text-xs uppercase border transition-colors tabular-nums',
                  isSelected
                    ? 'bg-ink border-ink text-canvas'
                    : 'bg-surface-strong border-transparent text-ink-muted group-hover:bg-ink group-hover:text-canvas group-hover:border-ink',
                ].join(' ')}
              >
                {opt.id}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm leading-relaxed ${isSelected ? 'text-ink font-medium' : 'text-ink-body'}`}>
                  {opt.text}
                </div>
                {isSelected && (
                  <div className="mt-2 text-sm text-ink-muted leading-relaxed animate-in fade-in slide-in-from-top-1 duration-300">
                    {opt.feedback}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-muted">
          <span className="inline-block size-1 rounded-full bg-ink-muted animate-pulse" />
          <span>{t.nextLoading}</span>
        </div>
      )}
    </div>
  );
}
