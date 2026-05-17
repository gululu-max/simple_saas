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

// ─── N-photo → N distinct scenes (used by N→N fusion mode) ────────
// Each input tag set is matched to its own best scene, with the global
// constraint that no two photos share the same scene_category. Uses a
// simple greedy assignment over photos sorted by candidate-pool tightness
// (photos with the fewest candidates pick first, so we don't starve them).
//
// Returns one MatchResult per input photo, aligned by index. If a photo's
// candidate pool is empty after full relaxation, its slot in the output is
// the corresponding MatchResult with `scene` taken from the global library
// (last-resort) — never returns a short array.
export function matchScenesForPhotos(
  perPhotoTags: SceneTags[],
  library: SceneEntry[],
): MatchResult[] {
  if (perPhotoTags.length === 0) return [];

  // 1. Gather scored candidates per photo
  type PhotoSlot = {
    index: number;
    tags: SceneTags;
    candidates: SceneEntry[];
    relaxation: number;
    reasoning: string[];
    scored: { scene: SceneEntry; score: number }[];
  };
  const slots: PhotoSlot[] = perPhotoTags.map((tags, index) => {
    const { candidates, relaxation, reasoning } = gatherCandidates(tags, library);
    const scored = candidates
      .map(s => ({ scene: s, score: scoreScene(tags, s) + Math.random() * 0.01 }))
      .sort((a, b) => b.score - a.score);
    return { index, tags, candidates, relaxation, reasoning, scored };
  });

  // 2. Greedy assignment: tightest pools pick first, prefer unused categories
  const order = [...slots].sort((a, b) => a.scored.length - b.scored.length);
  const usedCategories = new Set<string>();
  const usedSceneIds = new Set<string>();
  const assignments = new Map<number, { scene: SceneEntry; score: number }>();

  for (const slot of order) {
    let pick: { scene: SceneEntry; score: number } | null = null;
    for (const cand of slot.scored) {
      if (usedSceneIds.has(cand.scene.id)) continue;
      if (usedCategories.has(cand.scene.scene_category)) continue;
      pick = cand;
      break;
    }
    if (!pick) {
      for (const cand of slot.scored) {
        if (usedSceneIds.has(cand.scene.id)) continue;
        pick = cand;
        break;
      }
    }
    if (!pick) {
      // pool exhausted — fall back to any unused scene from the library
      const anyScene = library.find(s => !usedSceneIds.has(s.id));
      if (anyScene) {
        pick = { scene: anyScene, score: 0 };
        slot.reasoning.push(`Last-resort fallback: ${anyScene.id} (no compatible candidates left)`);
      }
    }
    if (pick) {
      assignments.set(slot.index, pick);
      usedSceneIds.add(pick.scene.id);
      usedCategories.add(pick.scene.scene_category);
    }
  }

  // 3. Emit in original photo order, with per-photo reasoning
  const summary = `N→N picks: [${slots
    .map(s => {
      const a = assignments.get(s.index);
      return a ? `#${s.index}=${a.scene.id}(${a.score.toFixed(1)})` : `#${s.index}=∅`;
    })
    .join(', ')}]`;

  return slots.map(slot => {
    const a = assignments.get(slot.index);
    if (!a) {
      // Should be unreachable given the last-resort fallback, but keep types honest
      return {
        scene: library[0],
        candidates_count: slot.candidates.length,
        relaxation_level: slot.relaxation,
        score: 0,
        reasoning: [...slot.reasoning, `No scene could be assigned to photo ${slot.index}`],
      };
    }
    return {
      scene: a.scene,
      candidates_count: slot.candidates.length,
      relaxation_level: slot.relaxation,
      score: Math.round(a.score),
      reasoning: slot.index === 0 ? [...slot.reasoning, summary] : [summary],
    };
  });
}

// ─── Top-3 diverse match (legacy 1→3 fusion mode) ─────────────────
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