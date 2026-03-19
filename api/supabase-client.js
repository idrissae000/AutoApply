const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function saveProfile(profile) {
  const row = {
    name: profile.name || null,
    email: profile.email || null,
    phone: profile.phone || null,
    skills: profile.skills || [],
    experience: profile.experience || [],
    education: profile.education || [],
    target_roles: profile.target_roles || [],
    location: profile.location || null,
    salary_range: profile.salary_range || null,
    job_type: profile.job_type || null,
    avoid_list: profile.avoid_list || null
  };

  const { data, error } = await supabase
    .from('user_profiles')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }

  return data;
}

module.exports = { saveProfile };
