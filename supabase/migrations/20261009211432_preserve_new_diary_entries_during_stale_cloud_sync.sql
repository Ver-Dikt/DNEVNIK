-- Protect server-side additions against a stale client's delayed full-snapshot upsert.
-- Entries omitted by a stale snapshot remain in the cloud.
-- Explicit deletions are represented by sync.deleted.entries[id] tombstones.
create or replace function public.preserve_unacknowledged_diary_entries()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_entry jsonb;
  submitted_entries jsonb;
  submitted_deletions jsonb;
  entry_id text;
begin
  if pg_catalog.jsonb_typeof(old.data->'entries') is distinct from 'array'
     or pg_catalog.jsonb_typeof(new.data->'entries') is distinct from 'array' then
    return new;
  end if;
  submitted_entries := new.data->'entries';
  submitted_deletions := case
    when pg_catalog.jsonb_typeof(new.data#>'{sync,deleted,entries}') = 'object'
      then new.data#>'{sync,deleted,entries}'
    else '{}'::jsonb
  end;

  for saved_entry in select value from pg_catalog.jsonb_array_elements(old.data->'entries') as records(value) loop
    entry_id := saved_entry->>'id';
    if entry_id is null then continue; end if;
    if not (submitted_deletions ? entry_id)
       and not exists (
         select 1
         from pg_catalog.jsonb_array_elements(submitted_entries) as incoming(value)
         where incoming.value->>'id' = entry_id
       ) then
      submitted_entries := submitted_entries || pg_catalog.jsonb_build_array(saved_entry);
    end if;
  end loop;

  new.data := pg_catalog.jsonb_set(new.data, '{entries}', submitted_entries, true);
  return new;
end;
$$;

revoke all on function public.preserve_unacknowledged_diary_entries() from public, anon, authenticated;
drop trigger if exists preserve_unacknowledged_diary_entries_on_update on public.app_state;
create trigger preserve_unacknowledged_diary_entries_on_update
before update of data on public.app_state
for each row
execute function public.preserve_unacknowledged_diary_entries();
