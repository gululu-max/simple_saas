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

export function matchScene(
  userTags: SceneTags,
  library: SceneEntry[],
  options: { topN?: number } = {},
): MatchResult {
  const topN = options.topN ?? 3;
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