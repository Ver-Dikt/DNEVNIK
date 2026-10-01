revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

drop policy if exists "Profiles are owned by user" on public.profiles;
create policy "Profiles are owned by user" on public.profiles
  for all
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "App state is owned by user" on public.app_state;
create policy "App state is owned by user" on public.app_state
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Projects are owned by user" on public.projects;
create policy "Projects are owned by user" on public.projects
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Entries are owned by user" on public.entries;
create policy "Entries are owned by user" on public.entries
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists projects_parent_id_idx on public.projects(parent_id);
