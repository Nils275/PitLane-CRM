/*
# Create documents storage bucket

1. Storage
- Create a public bucket "documents" for file uploads (drag-and-drop).
2. Security
- Public read access for the bucket (files are shared across the team, single-tenant app).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_upload_documents" ON storage.objects;
CREATE POLICY "anon_upload_documents" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "anon_read_documents" ON storage.objects;
CREATE POLICY "anon_read_documents" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "anon_delete_documents" ON storage.objects;
CREATE POLICY "anon_delete_documents" ON storage.objects
FOR DELETE TO anon, authenticated
USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "anon_update_documents" ON storage.objects;
CREATE POLICY "anon_update_documents" ON storage.objects
FOR UPDATE TO anon, authenticated
USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');
