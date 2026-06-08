-- ====================================================================
-- DAILY & WEEKLY TASKS SETUP SCRIPT
-- Run this script in the Supabase Dashboard SQL Editor.
-- ====================================================================

-- 1. Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  task_type TEXT NOT NULL, -- faucet_claims, shortlink_claims, offerwall_points, referrals, daily_tasks_completed
  target_count INTEGER NOT NULL,
  reward_points INTEGER NOT NULL,
  reward_xp INTEGER NOT NULL,
  period TEXT NOT NULL, -- daily, weekly
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create user_task_claims table
CREATE TABLE IF NOT EXISTS public.user_task_claims (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, task_id, period_start)
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_task_claims ENABLE ROW LEVEL SECURITY;

-- 4. Grant access
GRANT SELECT ON public.tasks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT, INSERT ON public.user_task_claims TO authenticated;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Anyone can view active tasks" ON public.tasks;
CREATE POLICY "Anyone can view active tasks" ON public.tasks
  FOR SELECT USING (is_active = true OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ));

DROP POLICY IF EXISTS "Admins can manage tasks" ON public.tasks;
CREATE POLICY "Admins can manage tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Users can view their own task claims" ON public.user_task_claims;
CREATE POLICY "Users can view their own task claims" ON public.user_task_claims
  FOR SELECT USING (auth.uid() = user_id);

-- 6. RPC Function to get user tasks progress
CREATE OR REPLACE FUNCTION public.get_user_tasks_progress(p_user_id UUID)
RETURNS TABLE (
  task_id UUID,
  title TEXT,
  task_type TEXT,
  target_count INTEGER,
  reward_points INTEGER,
  reward_xp INTEGER,
  period TEXT,
  current_count INTEGER,
  completed BOOLEAN,
  claimed BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE;
  v_today_start TIMESTAMP WITH TIME ZONE;
  v_week_start TIMESTAMP WITH TIME ZONE;
BEGIN
  v_now := now() AT TIME ZONE 'UTC';
  v_today_start := date_trunc('day', v_now);
  
  -- PostgreSQL week starts on Monday, truncating to monday
  v_week_start := date_trunc('week', v_now);

  RETURN QUERY
  SELECT 
    t.id AS task_id,
    t.title,
    t.task_type,
    t.target_count,
    t.reward_points,
    t.reward_xp,
    t.period,
    COALESCE(
      CASE 
        WHEN t.task_type = 'faucet_claims' THEN (
          SELECT COUNT(*)::INTEGER FROM public.faucet_claims fc
          WHERE fc.user_id = p_user_id
            AND fc.claimed_at >= (CASE WHEN t.period = 'daily' THEN v_today_start ELSE v_week_start END)
        )
        WHEN t.task_type = 'shortlink_claims' THEN (
          SELECT COUNT(*)::INTEGER FROM public.shortlink_claims sc
          WHERE sc.user_id = p_user_id
            AND sc.status = 'completed'
            AND sc.completed_at >= (CASE WHEN t.period = 'daily' THEN v_today_start ELSE v_week_start END)
        )
        WHEN t.task_type = 'offerwall_points' THEN (
          SELECT COALESCE(SUM(oc.points_reward), 0)::INTEGER FROM public.offerwall_claims oc
          WHERE oc.user_id = p_user_id
            AND oc.status = 'completed'
            AND oc.completed_at >= (CASE WHEN t.period = 'daily' THEN v_today_start ELSE v_week_start END)
        )
        WHEN t.task_type = 'referrals' THEN (
          SELECT COUNT(*)::INTEGER FROM public.profiles pr
          WHERE pr.referred_by_id = p_user_id
            AND pr.created_at >= (CASE WHEN t.period = 'daily' THEN v_today_start ELSE v_week_start END)
        )
        WHEN t.task_type = 'daily_tasks_completed' THEN (
          SELECT COUNT(*)::INTEGER FROM public.user_task_claims utc
          JOIN public.tasks pt ON utc.task_id = pt.id
          WHERE utc.user_id = p_user_id
            AND pt.period = 'daily'
            AND utc.claimed_at >= (CASE WHEN t.period = 'daily' THEN v_today_start ELSE v_week_start END)
        )
        ELSE 0
      END,
      0
    ) AS current_count,
    -- Completed check
    (
      COALESCE(
        CASE 
          WHEN t.task_type = 'faucet_claims' THEN (
            SELECT COUNT(*)::INTEGER FROM public.faucet_claims fc
            WHERE fc.user_id = p_user_id
              AND fc.claimed_at >= (CASE WHEN t.period = 'daily' THEN v_today_start ELSE v_week_start END)
          )
          WHEN t.task_type = 'shortlink_claims' THEN (
            SELECT COUNT(*)::INTEGER FROM public.shortlink_claims sc
            WHERE sc.user_id = p_user_id
              AND sc.status = 'completed'
              AND sc.completed_at >= (CASE WHEN t.period = 'daily' THEN v_today_start ELSE v_week_start END)
          )
          WHEN t.task_type = 'offerwall_points' THEN (
            SELECT COALESCE(SUM(oc.points_reward), 0)::INTEGER FROM public.offerwall_claims oc
            WHERE oc.user_id = p_user_id
              AND oc.status = 'completed'
              AND oc.completed_at >= (CASE WHEN t.period = 'daily' THEN v_today_start ELSE v_week_start END)
          )
          WHEN t.task_type = 'referrals' THEN (
            SELECT COUNT(*)::INTEGER FROM public.profiles pr
            WHERE pr.referred_by_id = p_user_id
              AND pr.created_at >= (CASE WHEN t.period = 'daily' THEN v_today_start ELSE v_week_start END)
          )
          WHEN t.task_type = 'daily_tasks_completed' THEN (
            SELECT COUNT(*)::INTEGER FROM public.user_task_claims utc
            JOIN public.tasks pt ON utc.task_id = pt.id
            WHERE utc.user_id = p_user_id
              AND pt.period = 'daily'
              AND utc.claimed_at >= (CASE WHEN t.period = 'daily' THEN v_today_start ELSE v_week_start END)
          )
          ELSE 0
        END,
        0
      ) >= t.target_count
    ) AS completed,
    -- Claimed check
    EXISTS (
      SELECT 1 FROM public.user_task_claims utc
      WHERE utc.user_id = p_user_id
        AND utc.task_id = t.id
        AND utc.period_start = (CASE WHEN t.period = 'daily' THEN v_today_start ELSE v_week_start END)
    ) AS claimed
  FROM public.tasks t
  WHERE t.is_active = true
  ORDER BY t.period ASC, t.reward_points DESC;
END;
$$;

-- 7. RPC Function to claim task reward
CREATE OR REPLACE FUNCTION public.claim_task_reward(
  p_user_id UUID,
  p_task_id UUID
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_task RECORD;
  v_now TIMESTAMP WITH TIME ZONE;
  v_period_start TIMESTAMP WITH TIME ZONE;
  v_current_count INTEGER;
  v_claimed BOOLEAN;
  v_new_balance NUMERIC;
BEGIN
  -- 1. Fetch task details
  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Task not found or is inactive');
  END IF;

  v_now := now() AT TIME ZONE 'UTC';
  v_period_start := CASE WHEN v_task.period = 'daily' THEN date_trunc('day', v_now) ELSE date_trunc('week', v_now) END;

  -- 2. Check if already claimed
  SELECT EXISTS (
    SELECT 1 FROM public.user_task_claims
    WHERE user_id = p_user_id AND task_id = p_task_id AND period_start = v_period_start
  ) INTO v_claimed;

  IF v_claimed THEN
    RETURN json_build_object('success', false, 'message', 'Reward already claimed for this period');
  END IF;

  -- 3. Calculate current count
  v_current_count := CASE 
    WHEN v_task.task_type = 'faucet_claims' THEN (
      SELECT COUNT(*)::INTEGER FROM public.faucet_claims
      WHERE user_id = p_user_id AND claimed_at >= v_period_start
    )
    WHEN v_task.task_type = 'shortlink_claims' THEN (
      SELECT COUNT(*)::INTEGER FROM public.shortlink_claims
      WHERE user_id = p_user_id AND status = 'completed' AND completed_at >= v_period_start
    )
    WHEN v_task.task_type = 'offerwall_points' THEN (
      SELECT COALESCE(SUM(points_reward), 0)::INTEGER FROM public.offerwall_claims
      WHERE user_id = p_user_id AND status = 'completed' AND completed_at >= v_period_start
    )
    WHEN v_task.task_type = 'referrals' THEN (
      SELECT COUNT(*)::INTEGER FROM public.profiles
      WHERE referred_by_id = p_user_id AND created_at >= v_period_start
    )
    WHEN v_task.task_type = 'daily_tasks_completed' THEN (
      SELECT COUNT(*)::INTEGER FROM public.user_task_claims utc
      JOIN public.tasks pt ON utc.task_id = pt.id
      WHERE utc.user_id = p_user_id
        AND pt.period = 'daily'
        AND utc.claimed_at >= v_period_start
    )
    ELSE 0
  END;

  -- 4. Check if task completed
  IF v_current_count < v_task.target_count THEN
    RETURN json_build_object('success', false, 'message', 'Task target not met yet (' || v_current_count || '/' || v_task.target_count || ')');
  END IF;

  -- 5. Insert claim log
  INSERT INTO public.user_task_claims (user_id, task_id, period_start, claimed_at)
  VALUES (p_user_id, p_task_id, v_period_start, now());

  -- 6. Add reward points & XP to user profiles
  UPDATE public.profiles
  SET balance = balance + v_task.reward_points,
      xp = xp + v_task.reward_xp
  WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully claimed reward: ' || v_task.reward_points || ' Points & ' || v_task.reward_xp || ' XP!',
    'new_balance', v_new_balance
  );
END;
$$;

-- 8. Seed some initial active tasks
INSERT INTO public.tasks (title, task_type, target_count, reward_points, reward_xp, period, is_active)
VALUES 
  ('Claim Faucet 5 Times', 'faucet_claims', 5, 250, 10, 'daily', true),
  ('Claim Faucet 10 Times', 'faucet_claims', 10, 600, 25, 'daily', true),
  ('Complete 5 Shortlinks', 'shortlink_claims', 5, 1000, 50, 'daily', true),
  ('Earn 2000 Points from Offerwalls', 'offerwall_points', 2000, 1500, 100, 'daily', true),
  ('Complete 5 Daily Tasks this Week', 'daily_tasks_completed', 5, 2000, 100, 'weekly', true),
  ('Complete 10 Daily Tasks this Week', 'daily_tasks_completed', 10, 5000, 250, 'weekly', true),
  ('Complete 15 Daily Tasks this Week', 'daily_tasks_completed', 15, 10000, 500, 'weekly', true)
ON CONFLICT DO NOTHING;
