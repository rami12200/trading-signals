import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  
  // Simple protection
  if (key !== process.env.EA_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_signal_executions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          signal_id UUID NOT NULL REFERENCES trade_signals(id) ON DELETE CASCADE,
          executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, signal_id)
        );

        ALTER TABLE user_signal_executions ENABLE ROW LEVEL SECURITY;

        -- Allow users to read their own executions
        CREATE POLICY IF NOT EXISTS "Users can read own executions" ON user_signal_executions
          FOR SELECT USING (auth.uid() = user_id);

        -- Allow service role to manage all
        CREATE POLICY IF NOT EXISTS "Service role can manage all executions" ON user_signal_executions
          FOR ALL USING (true) WITH CHECK (true);
      `
    })

    if (error) {
       return NextResponse.json({
        success: false,
        message: 'RPC failed. Run this SQL in Supabase Editor:',
        sql: `
          CREATE TABLE IF NOT EXISTS public.user_signal_executions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            signal_id UUID NOT NULL REFERENCES public.trade_signals(id) ON DELETE CASCADE,
            executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, signal_id)
          );
          
          ALTER TABLE public.user_signal_executions ENABLE ROW LEVEL SECURITY;
          
          CREATE POLICY "Users can read own executions" ON public.user_signal_executions
            FOR SELECT USING (auth.uid() = user_id);
            
          CREATE POLICY "Service role can manage all executions" ON public.user_signal_executions
            FOR ALL USING (true) WITH CHECK (true);
        `
       })
    }

    return NextResponse.json({ success: true, message: 'Table created via RPC' })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
