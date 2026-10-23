-- 0012: Points Economy
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points_balance INT DEFAULT 100;

CREATE OR REPLACE FUNCTION public.adjust_user_points(p_user_id UUID, p_amount INT) 
RETURNS void AS $$
BEGIN
  UPDATE profiles 
  SET points_balance = points_balance + p_amount 
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
