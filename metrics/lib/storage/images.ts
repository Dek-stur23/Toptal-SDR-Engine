import type { SupabaseClient } from "@supabase/supabase-js";

// Meeting screenshots. Objects are keyed as:
//   {user_id}/meetings/{random-uuid}.{ext}
// so the storage RLS policy (split_part(name,'/',1) = auth.uid()::text)
// scopes reads and writes to the owner.

const BUCKET = "meeting-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

function extForContentType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

// Upload a File selected in the browser. Returns the storage object
// key (which is what we persist on meetings.image_key).
export async function uploadMeetingImage(
  supabase: SupabaseClient,
  file: File
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const ext = extForContentType(file.type);
  const uuid = crypto.randomUUID();
  const path = `${user.id}/meetings/${uuid}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });
  if (error) throw error;
  return path;
}

// Delete a stored screenshot. Safe to call for keys that no longer
// exist — the request just no-ops. Only used from the "Remove image"
// action in the modal.
export async function deleteMeetingImage(
  supabase: SupabaseClient,
  key: string
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([key]);
  if (error) throw error;
}

// Signed URL for rendering. Kept internal — components use the
// useImage hook so the URL is cached across mounts.
export async function signMeetingImageUrl(
  supabase: SupabaseClient,
  key: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

// Fetch a signed URL, then download the object and return a data:
// URL. Used by the autofill flow which needs base64 to send to the
// Anthropic API.
export async function downloadMeetingImageAsDataUrl(
  supabase: SupabaseClient,
  key: string
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(key);
  if (error) throw error;
  return await new Promise<string | null>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () =>
      typeof reader.result === "string" ? resolve(reader.result) : resolve(null);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(data);
  });
}
