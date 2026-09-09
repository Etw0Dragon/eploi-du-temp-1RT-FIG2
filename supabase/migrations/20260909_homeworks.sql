-- Base collaborative des devoirs FI1G2.
create table public.homeworks (
  id uuid primary key default gen_random_uuid(),
  group_id text not null default 'fi1g2' check (group_id = 'fi1g2'),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(trim(author_name)) between 2 and 32),
  subject text not null check (char_length(trim(subject)) between 1 and 60),
  title text not null check (char_length(trim(title)) between 1 and 120),
  due_date date not null,
  due_time time,
  description text check (description is null or char_length(description) <= 1200),
  link text check (link is null or link ~ '^https://[^[:space:]]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index homeworks_group_due_date_idx on public.homeworks (group_id, due_date, due_time);
create index homeworks_author_created_at_idx on public.homeworks (author_id, created_at desc);

create function public.set_homework_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger homeworks_set_updated_at
before update on public.homeworks
for each row execute function public.set_homework_updated_at();

create table public.homework_progress (
  homework_id uuid not null references public.homeworks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (homework_id, user_id)
);

alter table public.homeworks enable row level security;
alter table public.homework_progress enable row level security;

revoke all on public.homeworks from anon, authenticated;
revoke all on public.homework_progress from anon, authenticated;
grant select, update, delete on public.homeworks to authenticated;
grant select, insert, update, delete on public.homework_progress to authenticated;

create policy "Les étudiants connectés lisent les devoirs FI1G2"
  on public.homeworks for select to authenticated
  using (group_id = 'fi1g2');

create policy "Un auteur modifie son devoir"
  on public.homeworks for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id and group_id = 'fi1g2');

create policy "Un auteur supprime son devoir"
  on public.homeworks for delete to authenticated
  using ((select auth.uid()) = author_id);

create policy "Un étudiant lit ses coches"
  on public.homework_progress for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Un étudiant ajoute sa coche"
  on public.homework_progress for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Un étudiant met à jour sa coche"
  on public.homework_progress for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Un étudiant retire sa coche"
  on public.homework_progress for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Cette fonction est le seul moyen d'ajouter un devoir.
-- Le verrou empêche deux requêtes simultanées de contourner la limite de 10 secondes.
create or replace function public.create_homework(
  p_group_id text,
  p_author_name text,
  p_subject text,
  p_title text,
  p_due_date date,
  p_due_time time,
  p_description text,
  p_link text
)
returns public.homeworks
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  previous_publication timestamptz;
  created_homework public.homeworks;
begin
  if current_user_id is null then
    raise exception 'Connexion anonyme requise.';
  end if;

  if p_group_id <> 'fi1g2' then
    raise exception 'Groupe non autorisé.';
  end if;

  if char_length(trim(coalesce(p_author_name, ''))) not between 2 and 32
    or char_length(trim(coalesce(p_subject, ''))) not between 1 and 60
    or char_length(trim(coalesce(p_title, ''))) not between 1 and 120
    or p_due_date is null
    or (p_description is not null and char_length(p_description) > 1200)
    or (p_link is not null and p_link !~ '^https://[^[:space:]]+$') then
    raise exception 'Les informations du devoir sont invalides.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));
  select created_at into previous_publication
    from public.homeworks
    where author_id = current_user_id
    order by created_at desc
    limit 1;

  if previous_publication is not null and previous_publication > now() - interval '10 seconds' then
    raise exception 'Attends 10 secondes entre deux publications.';
  end if;

  insert into public.homeworks (group_id, author_id, author_name, subject, title, due_date, due_time, description, link)
  values (p_group_id, current_user_id, trim(p_author_name), trim(p_subject), trim(p_title), p_due_date, p_due_time, nullif(trim(p_description), ''), nullif(trim(p_link), ''))
  returning * into created_homework;

  return created_homework;
end;
$$;

revoke all on function public.create_homework(text, text, text, text, date, time, text, text) from public;
grant execute on function public.create_homework(text, text, text, text, date, time, text, text) to authenticated;

alter publication supabase_realtime add table public.homeworks, public.homework_progress;
