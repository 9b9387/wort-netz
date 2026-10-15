-- Keep profiles in sync with Supabase Auth users.
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_fkey"
  FOREIGN KEY ("id") REFERENCES auth.users(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill profiles for users created before this migration.
INSERT INTO public.profiles (id, display_name)
SELECT
  id,
  coalesce(
    raw_user_meta_data->>'display_name',
    split_part(coalesce(email, ''), '@', 1)
  )
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- RLS is a defense-in-depth layer for direct PostgREST access. Prisma uses the
-- database owner role and still scopes every personal query by user id.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lexemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lexemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dwds_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "lexemes_select_authenticated"
  ON public.lexemes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "encounters_select_own"
  ON public.encounters
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "encounters_insert_own"
  ON public.encounters
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_lexemes_select_own"
  ON public.user_lexemes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_lexemes_insert_own"
  ON public.user_lexemes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_lexemes_update_own"
  ON public.user_lexemes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.lexemes TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.encounters TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_lexemes TO authenticated;
