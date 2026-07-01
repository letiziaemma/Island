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
  const payload = {
    date,
    user,
    moments:      fields.moments    ?? '',
    learnings:    fields.learnings  ?? '',
    song:         fields.song       ?? '',
    emoji:        fields.emoji      ?? '',
    submitted_at: fields._submittedAt ?? null,
    is_submitted: fields._isSubmitted ?? false,
  };

  // Check if a row already exists for this date+user combination.
  const { data: existing, error: checkError } = await supabase
    .from('reflections')
    .select('date')
    .eq('date', date)
    .eq('user', user)
    .maybeSingle();

  if (checkError) {
    console.error('upsertReflection check:', checkError);
    return false;
  }

  const { error } = existing
    ? await supabase.from('reflections').update(payload).eq('date', date).eq('user', user)
    : await supabase.from('reflections').insert(payload);

  if (error) {
    console.error('upsertReflection save:', error);
    return false;
  }

  return true;
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

// ── Accommodation ────────────────────────────────────────────────

export async function getAccommodation() {
  const { data, error } = await supabase.from('accommodation').select('*').order('check_in_date');
  if (error) { console.error('getAccommodation:', error); return []; }
  return data.map(r => ({
    id:          r.id,
    name:        r.name,
    person:      r.person || '',
    checkInDate: r.check_in_date,
    checkInTime: r.check_in_time || null,
    checkOutDate:r.check_out_date,
    url:         r.url || null,
  }));
}

export async function upsertAccommodation(accom) {
  const { error } = await supabase.from('accommodation').upsert({
    id:            accom.id,
    name:          accom.name,
    person:        accom.person || '',
    check_in_date: accom.checkInDate,
    check_in_time: accom.checkInTime || null,
    check_out_date:accom.checkOutDate,
    url:           accom.url || null,
  }, { onConflict: 'id' });
  if (error) console.error('upsertAccommodation:', error);
}

export async function deleteAccommodation(id) {
  const { error } = await supabase.from('accommodation').delete().eq('id', id);
  if (error) console.error('deleteAccommodation:', error);
}

// ── Milestones ────────────────────────────────────────────────────

export async function getMilestones() {
  const { data, error } = await supabase.from('milestones').select('*');
  if (error) { console.error('getMilestones:', error); return []; }
  return data.map(r => ({
    id:    r.id,
    title: r.title,
    date:  r.date  || null,
    time:  r.time  || null,
    url:   r.url   || null,
  }));
}

export async function insertMilestone(m) {
  const { error } = await supabase.from('milestones').insert({
    id: m.id, title: m.title,
    date: m.date || null, time: m.time || null, url: m.url || null,
  });
  if (error) console.error('insertMilestone:', error);
}

export async function deleteMilestone(id) {
  const { error } = await supabase.from('milestones').delete().eq('id', id);
  if (error) console.error('deleteMilestone:', error);
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
