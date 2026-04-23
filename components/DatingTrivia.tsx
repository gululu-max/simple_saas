'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { TRIVIA_QUESTIONS, type TriviaQuestion, type TriviaOption } from '@/lib/trivia-questions';

const FEEDBACK_HOLD_MS = 2000;
const INTERRUPT_HOLD_MS = 1100;

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

export default function DatingTrivia({ active, onTrack }: Props) {
  const [current, setCurrent] = useState<TriviaQuestion | null>(null);
  const [selected, setSelected] = useState<TriviaOption | null>(null);
  const [interrupting, setInterrupting] = useState(false);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interruptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef = useRef<TriviaQuestion | null>(null);
  const selectedRef = useRef<TriviaOption | null>(null);
  const onTrackRef = useRef<TrackFn | undefined>(onTrack);

  useEffect(() => { currentRef.current = current; }, [current]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { onTrackRef.current = onTrack; }, [onTrack]);

  useEffect(() => {
    if (active) {
      if (interruptTimer.current) {
        clearTimeout(interruptTimer.current);
        interruptTimer.current = null;
      }
      setInterrupting(false);
      if (!currentRef.current) {
        const first = pickRandom();
        setCurrent(first);
        onTrackRef.current?.('trivia_shown', { question_id: first.id });
      }
      return;
    }

    if (currentRef.current && !interrupting) {
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
        setSelected(null);
        setInterrupting(false);
        interruptTimer.current = null;
      }, INTERRUPT_HOLD_MS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      if (interruptTimer.current) clearTimeout(interruptTimer.current);
    };
  }, []);

  const handleSelect = useCallback((opt: TriviaOption) => {
    if (selected || !current) return;
    setSelected(opt);
    onTrackRef.current?.('trivia_answered', {
      question_id: current.id,
      option_id: opt.id,
    });
    advanceTimer.current = setTimeout(() => {
      const next = pickRandom(current.id);
      setCurrent(next);
      setSelected(null);
      onTrackRef.current?.('trivia_shown', { question_id: next.id });
      advanceTimer.current = null;
    }, FEEDBACK_HOLD_MS);
  }, [selected, current]);

  if (!active && !interrupting) return null;
  if (interrupting) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 text-center animate-in fade-in duration-300">
        <div className="text-emerald-400 font-bold text-base flex items-center justify-center gap-2">
          <Sparkles className="size-4" />
          Your result&apos;s ready — that matters more than the game 👇
        </div>
      </div>
    );
  }
  if (!current) return null;

  return (
    <div className="rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-500/[0.05] via-slate-900/60 to-pink-500/[0.04] p-5 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="flex items-center gap-2 mb-4">
        <span className="grid size-6 place-items-center rounded-full bg-rose-500/15 border border-rose-500/30">
          <Heart className="size-3 text-rose-400 fill-rose-400" />
        </span>
        <span className="text-rose-400 font-bold text-xs uppercase tracking-[0.15em]">
          While you wait
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          Dating IQ
        </span>
      </div>

      <h4 className="text-white font-semibold text-base md:text-[17px] leading-snug mb-4">
        {current.question}
      </h4>

      <div className="flex flex-col gap-2">
        {current.options.map((opt) => {
          const isSelected = selected?.id === opt.id;
          const isOther = !!selected && !isSelected;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={!!selected}
              onClick={() => handleSelect(opt)}
              className={[
                'group text-left rounded-lg border px-4 py-3 transition-all duration-300',
                'flex items-start gap-3',
                isSelected
                  ? 'border-emerald-500/60 bg-emerald-500/10 shadow-md shadow-emerald-500/10'
                  : isOther
                    ? 'border-slate-800/40 bg-slate-900/30 opacity-30 cursor-default'
                    : 'border-slate-800/60 bg-slate-900/40 hover:border-rose-500/40 hover:bg-rose-500/[0.05] cursor-pointer active:scale-[0.99]',
              ].join(' ')}
            >
              <span
                className={[
                  'shrink-0 grid size-6 place-items-center rounded-md font-bold text-xs uppercase border transition-colors',
                  isSelected
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 group-hover:border-rose-500/40 group-hover:text-rose-400',
                ].join(' ')}
              >
                {opt.id}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm leading-relaxed ${isSelected ? 'text-white font-medium' : 'text-slate-300'}`}>
                  {opt.text}
                </div>
                {isSelected && (
                  <div className="mt-2 text-sm text-emerald-200/90 italic leading-relaxed animate-in fade-in slide-in-from-top-1 duration-300">
                    {opt.feedback}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span className="inline-block size-1 rounded-full bg-rose-400/60 animate-pulse" />
          <span>Next question loading...</span>
        </div>
      )}
    </div>
  );
}
