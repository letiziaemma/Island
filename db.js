import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const supabase = createClient(
  'https://kzjrzjsxgpvrpqxbmhfx.supabase.co',
  'sb_publishable_uLArsr2dvWWz67r5qrAkdA_ly6cnUGu'
);

// ── Reflections ──────────────────────────────────────────────────

export async function getAllReflections() {
  const { data, error } = await supabase.from('reflections').select('*');
  if (error) { console.error('getAllReflections:', error); return {}; }
  const out = {};
  for (const r of data) {
    if (!out[r.date]) out[r.date] = {};
    out[r.date][r.user] = {
      moments:      r.moments,
      learnings:    r.learnings,
      song:         r.song,
      emoji:        r.emoji,
      _submittedAt: r.submitted_at,
      _isSubmitted: r.is_submitted,
    };
  }
  return out;
}

export async function upsertReflection(date, user, fields) {
  const { error } = await supabase.from('reflections').upsert({
    date,
    user,
    moments:      fields.moments    ?? '',
    learnings:    fields.learnings  ?? '',
    song:         fields.song       ?? '',
    emoji:        fields.emoji      ?? '',
    submitted_at: fields._submittedAt ?? null,
    is_submitted: fields._isSubmitted ?? false,
  }, { onConflict: 'date,user' });
  if (error) console.error('upsertReflection:', error);
}

// ── Meals ────────────────────────────────────────────────────────

export async function getMeals(date) {
  const { data, error } = await supabase.from('meals').select('*').eq('date', date);
  if (error) { console.error('getMeals:', error); return { lunch: { dish: '', tags: [] }, dinner: { dish: '', tags: [] } }; }
  const out = { lunch: { dish: '', tags: [] }, dinner: { dish: '', tags: [] } };
  for (const r of data) out[r.meal_type] = { dish: r.dish, tags: r.tags };
  return out;
}

export async function upsertMeal(date, mealType, dish, tags) {
  const { error } = await supabase.from('meals').upsert(
    { date, meal_type: mealType, dish, tags },
    { onConflict: 'date,meal_type' }
  );
  if (error) console.error('upsertMeal:', error);
}

// ── Custom stops ─────────────────────────────────────────────────

export async function getStops(date) {
  const { data, error } = await supabase.from('stops').select('*').eq('date', date);
  if (error) { console.error('getStops:', error); return []; }
  return data;
}

export async function insertStop(stop) {
  const { error } = await supabase.from('stops').insert({
    id: stop.id, title: stop.title, date: stop.date,
    time: stop.time ?? null, url: stop.url ?? null,
  });
  if (error) console.error('insertStop:', error);
}

export async function deleteStop(id) {
  const { error } = await supabase.from('stops').delete().eq('id', id);
  if (error) console.error('deleteStop:', error);
}

// ── Hidden stops ─────────────────────────────────────────────────

export async function getHiddenIndices(date) {
  const { data, error } = await supabase.from('hidden_stops').select('stop_index').eq('date', date);
  if (error) { console.error('getHiddenIndices:', error); return []; }
  return data.map(r => r.stop_index);
}

export async function addHiddenIndex(date, index) {
  const { error } = await supabase.from('hidden_stops').upsert(
    { date, stop_index: index },
    { onConflict: 'date,stop_index' }
  );
  if (error) console.error('addHiddenIndex:', error);
}

export async function removeHiddenIndex(date, index) {
  const { error } = await supabase.from('hidden_stops')
    .delete().eq('date', date).eq('stop_index', index);
  if (error) console.error('removeHiddenIndex:', error);
}
