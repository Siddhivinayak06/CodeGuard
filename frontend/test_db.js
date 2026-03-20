const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('practicals').select('id, title, is_exam').order('id', { ascending: false }).limit(5);
  console.log('Recent practicals:', data, error);
}
run();
