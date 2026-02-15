const { createClient } = require('@supabase/supabase-js');

// Using the keys from your environment/debug_col.js
const supabaseUrl = 'https://yybxeobyjukcxfkgjcxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5Ynhlb2J5anVrY3hma2dqY3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA1MjAwMiwiZXhwIjoyMDc1NjI4MDAyfQ.Lay7L0sFNWlgzE8G3CN0rUS-leMnE51NjrIIU9h5AP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConstraints() {
    console.log("Starting DB Constraint Check...");

    try {
        // 1. Get a valid subject (or create one)
        let { data: subjects } = await supabase.from('subjects').select('id').limit(1);
        let subjectId;

        if (!subjects || subjects.length === 0) {
            console.log("No subjects found, creating dummy subject...");
            const { data: newSub, error: subErr } = await supabase
                .from('subjects')
                .insert({ subject_name: 'Debug Subject', subject_code: 'DBG101' })
                .select()
                .single();
            if (subErr) throw subErr;
            subjectId = newSub.id;
        } else {
            subjectId = subjects[0].id;
        }
        console.log("Using Subject ID:", subjectId);

        // 2. Create Practical
        console.log("Creating Practical...");
        const { data: practical, error: pracErr } = await supabase
            .from('practicals')
            .insert({
                title: 'Constraint Test Practical',
                subject_id: subjectId,
                description: 'Testing Task 1/2',
                max_marks: 10
            })
            .select()
            .single();

        if (pracErr) throw new Error(`Practical Insert Failed: ${pracErr.message}`);
        const practicalId = practical.id;
        console.log("Practical Created. ID:", practicalId);

        // 3. Try Inserting 'Task 1' Level
        console.log("Attempting to insert 'Task 1'...");
        const { error: t1Err } = await supabase
            .from('practical_levels')
            .insert({
                practical_id: practicalId,
                level: 'Task 1',
                title: 'Task 1 Title',
                description: 'Desc',
                max_marks: 5
            });

        if (t1Err) {
            console.error("❌ FAILED to insert 'Task 1'. The SQL script was likely NOT run or failed.");
            console.error("Error:", t1Err.message);
        } else {
            console.log("✅ SUCCESS: 'Task 1' inserted.");
        }

        // 4. Try Inserting 'Task 2' Level
        console.log("Attempting to insert 'Task 2'...");
        const { error: t2Err } = await supabase
            .from('practical_levels')
            .insert({
                practical_id: practicalId,
                level: 'Task 2',
                title: 'Task 2 Title',
                description: 'Desc',
                max_marks: 5
            });

        if (t2Err) {
            console.error("❌ FAILED to insert 'Task 2'.");
            console.error("Error:", t2Err.message);
        } else {
            console.log("✅ SUCCESS: 'Task 2' inserted.");
        }

        // Cleanup
        console.log("Cleaning up...");
        await supabase.from('practical_levels').delete().eq('practical_id', practicalId);
        await supabase.from('practicals').delete().eq('id', practicalId);
        if (!subjects || subjects.length === 0) {
            await supabase.from('subjects').delete().eq('id', subjectId);
        }

    } catch (error) {
        console.error("Check Failed:", error.message);
    }
}

testConstraints();
