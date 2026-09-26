-- شاشة أسعار — رفع أسعار MT5 للموبايل والتلفزيون (Supabase Storage)
-- شغّل من SQL Editor بعد إنشاء المشروع.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-board',
  'shop-board',
  true,
  65536,
  array['application/json', 'text/plain']
)
on conflict (id) do update set public = true;

-- قراءة عامة للملف (التلفزيون والهاتف)
create policy "shop-board public read"
on storage.objects for select
using (bucket_id = 'shop-board');

-- الرفع من لوحة التحكم أو service role فقط (لا anon)
-- على كمبيوتر المحل استخدم service role في relay.json
