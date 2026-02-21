import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  
  // Simple protection
  if (key !== process.env.EA_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceSupabase()

  try {
    // Create profiles table using SQL
    const { error: profilesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS profiles (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT NOT NULL,
          name TEXT NOT NULL DEFAULT '',
          plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'vip')),
          api_key TEXT UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY IF NOT EXISTS "Users can read own profile" ON profiles
          FOR SELECT USING (auth.uid() = id);
          
        CREATE POLICY IF NOT EXISTS "Users can update own profile" ON profiles
          FOR UPDATE USING (auth.uid() = id);
      `
    })

    if (profilesError) {
      console.log('Note: RPC may not exist, trying direct table creation...')
    }

    return NextResponse.json({
      success: true,
      message: 'Please create the profiles table manually in Supabase SQL Editor. See instructions below.',
      sql: `
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor):

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'vip')),
  api_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles" ON public.profiles
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, plan)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', ''), 'free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
      `,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
