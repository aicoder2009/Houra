import { nowIso } from "@/lib/schemas/seed";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { FileStorageService } from "@/lib/services/interfaces";

const BUCKET = "evidence";

export const fileStorageService: FileStorageService = {
  async presignUpload(input) {
    const supabase = getSupabaseServerClient();
    const storageKey = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${input.fileName}`;

    if (!supabase) {
      return {
        storageKey,
        uploadUrl: `https://mock-storage.local/upload/${storageKey}`,
        expiresAt: nowIso(),
      };
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storageKey);

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create signed upload URL");
    }

    return {
      storageKey,
      uploadUrl: data.signedUrl,
      expiresAt: nowIso(),
    };
  },

  async presignDownload(input) {
    const supabase = getSupabaseServerClient();

    if (!supabase) {
      return {
        downloadUrl: `https://mock-storage.local/download/${input.storageKey}`,
        expiresAt: nowIso(),
      };
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(input.storageKey, 60 * 15);

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to create signed download URL");
    }

    return {
      downloadUrl: data.signedUrl,
      expiresAt: nowIso(),
    };
  },
};
