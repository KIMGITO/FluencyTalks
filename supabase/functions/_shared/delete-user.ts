// Deletes one account for good: its photos in storage, then the auth user (the database cascades the rest).
// Used when a member deletes their account, and when a parent or guardian refuses or withdraws their agreement.
// Proof of consent stays: the consent ledger is append-only and keyed by email hash, not by the account.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export async function deleteUserAndFiles(admin: SupabaseClient, uid: string): Promise<string | null> {
  const { data: files } = await admin.storage.from('avatars').list(uid);
  if (files?.length) await admin.storage.from('avatars').remove(files.map((f) => `${uid}/${f.name}`));
  const { error } = await admin.auth.admin.deleteUser(uid);
  return error ? error.message : null;
}
