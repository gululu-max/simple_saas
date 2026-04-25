// app/api/enhance-photo/match-scene.ts
//
// 从 scripts/match-scene.ts 拷贝过来，保持逻辑不变。
// 从 scripts/tag-user-photo.ts 的 UserPhotoTags 改成从 scanner 复用的 SceneTags。

import type { SceneTags } from '@/app/api/scanner/tag-prompt';

export interface SceneEntry {
  id: string;
  file: string;
  color_temperature: 'warm' | 'neutral' | 'cool';
  light_direction: 'left' | 'right' | 'front' | 'top' | 'back' | 'ambient';
  recommended_person_size: 'close' | 'medium' | 'far';
  person_scale_reference: 'has_reference' | 'no_reference';
  light_intensity: 'harsh' | 'soft' | 'dim';
  background_complexity: 'simple' | 'moderate' | 'busy';
  subject_slot: 'center' | 'left' | 'right';
  scene_category: string;
  vibe: string;
}

export interface MatchResult {
  scene: SceneEntry;
  candidates_count: number;
  relaxation_level: number;
  score: number;
  reasoning: string[];
}

function isColorCompatible(a: string, b: string, strict: boolean): boolean {
  if (a === b) return true;
  if (strict) return false;
  const adjacent: Record<string, string[]> = {
    warm: ['neutral'],
    neutral: ['warm', 'cool'],
    cool: ['neutral'],
  };
  return adjacent[a]?.includes(b) ?? false;
}

function isLightDirectionCompatible(a: string, b: string, strict: boolean): boolean {
  if (a === b) return true;
  if (a === 'ambient' || b === 'ambient') return true;
  if (strict) return false;
  const compatible: Record<string, string[]> = {
    front: ['left', 'right'],
    left: ['front'],
    right: ['front'],
    top: [],
    back: [],
  };
  return compatible[a]?.includes(b) ?? false;
}

const BODY_SIZE_COMPATIBILITY: Record<string, string[]> = {
  face_only: ['close'],
  upper_chest: ['close', 'medium'],
  waist_up: ['medium'],
  full_body: ['medium', 'far'],
};

function isSizeCompatible(visibleBody: string, recommendedSize: string): boolean {
  return BODY_SIZE_COMPATIBILITY[visibleBody]?.includes(recommendedSize) ?? false;
}

function scoreScene(userTags: SceneTags, scene: SceneEntry): number {
  let score = 0;
  if (scene.light_intensity === userTags.light_intensity) score += 2;
  if (scene.background_complexity === 'simple') score += 2;
  else if (scene.background_complexity === 'moderate') score += 1;
  if (userTags.visible_body === 'face_only' || userTags.visible_body === 'upper_chest') {
    if (scene.person_scale_reference === 'no_reference') score += 1;
  } else {
    if (scene.person_scale_reference === 'has_reference') score += 1;
  }
  return score;
}

// ─── Internal: gather candidates with progressive relaxation ──────
interface GatheredCandidates {
  candidates: SceneEntry[];
  relaxation: number;
  reasoning: string[];
}

function gatherCandidates(userTags: SceneTags, library: SceneEntry[]): GatheredCandidates {
  const reasoning: string[] = [];

  let candidates = library.filter(s =>
    isSizeCompatible(userTags.visible_body, s.recommended_person_size) &&
    isColorCompatible(s.color_temperature, userTags.color_temperature, true) &&
    isLightDirectionCompatible(s.light_direction, userTags.light_direction, true),
  );
  let relaxation = 0;
  reasoning.push(`Level 0 (strict): ${candidates.length} candidates`);

  if (candidates.length < 3) {
    candidates = library.filter(s =>
      isSizeCompatible(userTags.visible_body, s.recommended_person_size) &&
      isColorCompatible(s.color_temperature, userTags.color_temperature, false) &&
      isLightDirectionCompatible(s.light_direction, userTags.light_direction, true),
    );
    relaxation = 1;
    reasoning.push(`Level 1 (relax color): ${candidates.length} candidates`);
  }

  if (candidates.length < 3) {
    candidates = library.filter(s =>
      isSizeCompatible(userTags.visible_body, s.recommended_person_size) &&
      isColorCompatible(s.color_temperature, userTags.color_temperature, false) &&
      isLightDirectionCompatible(s.light_direction, userTags.light_direction, false),
    );
    relaxation = 2;
    reasoning.push(`Level 2 (relax direction): ${candidates.length} candidates`);
  }

  if (candidates.length === 0) {
    candidates = library.filter(s =>
      isSizeCompatible(userTags.visible_body, s.recommended_person_size),
    );
    relaxation = 3;
    reasoning.push(`Level 3 (fallback size-only): ${candidates.length} candidates`);
  }

  if (candidates.length === 0) {
    candidates = library;
    relaxation = 4;
    reasoning.push(`Level 4 (full library): ${candidates.length} candidates — tag system has holes`);
  }

  return { candidates, relaxation, reasoning };
}

// ─── Single match (kept for legacy callers, e.g. scripts/scene-fusion-test) ─
export function matchScene(
  userTags: SceneTags,
  library: SceneEntry[],
  options: { topN?: number } = {},
): MatchResult {
  const topN = options.topN ?? 3;
  const { candidates, relaxation, reasoning } = gatherCandidates(userTags, library);

  const scored = candidates.map(s => ({ scene: s, score: scoreScene(userTags, s) }));
  scored.sort((a, b) => b.score - a.score);
  const topK = scored.slice(0, Math.min(topN, scored.length));
  const chosen = topK[Math.floor(Math.random() * topK.length)];

  reasoning.push(`Top ${topK.length} scores: [${topK.map(x => x.score).join(', ')}]`);
  reasoning.push(`Chosen: ${chosen.scene.id} (score ${chosen.score})`);

  return {
    scene: chosen.scene,
    candidates_count: candidates.length,
    relaxation_level: relaxation,
    score: chosen.score,
    reasoning,
  };
}

// ─── Top-3 diverse match (used by 3-variant fusion mode) ───────────
// Returns up to 3 scenes prioritising different scene_category, falling
// back to filling from the remaining pool if we can't get 3 distinct
// categories. Each is wrapped in its own MatchResult so the caller can
// log/track them individually.
export function matchScenesTop3(
  userTags: SceneTags,
  library: SceneEntry[],
): MatchResult[] {
  const { candidates, relaxation, reasoning } = gatherCandidates(userTags, library);

  if (candidates.length === 0) {
    return [];
  }

  // Score and sort high-to-low. Add small jitter so equal-score ties don't
  // always resolve in the same library order across requests.
  const scored = candidates
    .map(s => ({ scene: s, score: scoreScene(userTags, s) + Math.random() * 0.01 }))
    .sort((a, b) => b.score - a.score);

  // First pass: greedy pick by category diversity.
  const picked: typeof scored = [];
  const usedCategories = new Set<string>();
  for (const item of scored) {
    if (usedCategories.has(item.scene.scene_category)) continue;
    picked.push(item);
    usedCategories.add(item.scene.scene_category);
    if (picked.length >= 3) break;
  }

  // Second pass: if fewer than 3 categories available, fill from highest
  // remaining scores regardless of category.
  if (picked.length < 3) {
    for (const item of scored) {
      if (picked.find(p => p.scene.id === item.scene.id)) continue;
      picked.push(item);
      if (picked.length >= 3) break;
    }
  }

  const summary = `Top-3 picks: [${picked.map(p => `${p.scene.id}(${p.score.toFixed(1)})`).join(', ')}]`;

  return picked.map((item, idx) => ({
    scene: item.scene,
    candidates_count: candidates.length,
    relaxation_level: relaxation,
    score: Math.round(item.score),
    reasoning: idx === 0 ? [...reasoning, summary] : [summary],
  }));
}