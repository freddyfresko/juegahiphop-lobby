-- ============================================================
-- 00010 — Auto-crear player_profiles al registrar usuario
--
-- Problema: cuando un usuario se registraba via Supabase Auth,
-- no se creaba su fila en player_profiles. El GameContainer
-- hacia .single() y Supabase respondia 406 (PGRST116) porque
-- no habia filas. El session_context llegaba al juego con
-- level=1, xp=0 en vez del perfil real.
--
-- Solucion: trigger que inserta automaticamente una fila en
-- player_profiles cuando se crea un nuevo usuario en auth.users.
-- ============================================================

-- Function que inserta el perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.player_profiles (user_id, xp, level, total_games_completed, current_streak, last_played_date, display_name, avatar_url)
  VALUES (
    NEW.id,
    0,   -- xp
    1,   -- level
    0,   -- total_games_completed
    0,   -- current_streak
    NULL, -- last_played_date
    COALESCE(
      split_part(NEW.email, '@', 1),
      'player'
    ),  -- display_name = parte antes del @ del email
    NULL  -- avatar_url
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger sobre auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── Backfill: crear perfiles para usuarios existentes sin fila ───
INSERT INTO public.player_profiles (user_id, xp, level, total_games_completed, current_streak, last_played_date, display_name, avatar_url)
SELECT
  u.id,
  0, 1, 0, 0, NULL,
  COALESCE(split_part(u.email, '@', 1), 'player'),
  NULL
FROM auth.users u
LEFT JOIN public.player_profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
