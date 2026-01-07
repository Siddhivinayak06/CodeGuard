-- 1. Holidays / Blackout Dates
CREATE TABLE IF NOT EXISTS holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Faculty Availability
CREATE TABLE IF NOT EXISTS faculty_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faculty_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT false, -- false means "marked as unavailable/busy", true means "specifically available". Let's assume this table tracks UNAVAILABILITY (exceptions) or AVAILABILITY. 
  -- Common pattern: Assume available unless marked unavailable. OR Assume unavailable unless marked available.
  -- Context: "Handle conflicts such as faculty availability". 
  -- Let's stick to the plan: is_available. If we want to mark "busy", we can set is_available = false. 
  -- Actually, usually availability is a set of "slots".
  -- Let's define this as "Time slots where faculty is available" OR "Time slots where faculty is BUSY".
  -- Let's assume it stores EXPLICIT availability or bookings. 
  -- Plan said: "is_available BOOLEAN DEFAULT false". 
  created_at TIMESTAMPTZ DEFAULT NOW()
);



-- DROP TABLES to avoid type conflicts if they exist as Integers from old schema
DROP TABLE IF EXISTS schedule_allocations CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;

-- 4. Schedules (The main event)
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  practical_id INTEGER REFERENCES practicals(id) ON DELETE SET NULL,
  faculty_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  batch_name TEXT, -- e.g., "Year 3 - Batch A"
  title_placeholder TEXT, -- For admin to create a slot without a practical yet
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Schedule Allocations (Students assigned to a schedule)
CREATE TABLE IF NOT EXISTS schedule_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
