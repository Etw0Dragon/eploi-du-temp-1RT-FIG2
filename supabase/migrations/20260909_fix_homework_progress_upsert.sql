-- Correctif pour une base où la première migration a déjà été exécutée.
grant update on public.homework_progress to authenticated;

create policy "Un étudiant met à jour sa coche"
  on public.homework_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
