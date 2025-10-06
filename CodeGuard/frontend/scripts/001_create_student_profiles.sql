-- Create student profiles table
create table if not exists public.student_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  student_id text unique not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  grade_level integer,
  enrollment_date timestamp with time zone default now(),
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table public.student_profiles enable row level security;

-- Create RLS policies for student profiles
create policy "Students can view their own profile"
  on public.student_profiles for select
  using (auth.uid() = id);

create policy "Students can insert their own profile"
  on public.student_profiles for insert
  with check (auth.uid() = id);

create policy "Students can update their own profile"
  on public.student_profiles for update
  using (auth.uid() = id);

-- Create function to auto-create student profile on signup
create or replace function public.handle_new_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.student_profiles (
    id, 
    student_id, 
    first_name, 
    last_name, 
    email
  )
  values (
    new.id,
    'STU' || to_char(now(), 'YYYYMMDD') || substr(new.id::text, 1, 6),
    coalesce(new.raw_user_meta_data ->> 'first_name', 'Student'),
    coalesce(new.raw_user_meta_data ->> 'last_name', 'User'),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Create trigger to auto-create student profile
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_student();
