import { Badge } from "@/components/ui/badge";
import type { ServiceEntryStatus, SyncState } from "@/lib/schemas/types";

type EntryOrSync = ServiceEntryStatus | SyncState;

export function StatusChip({ value }: { value: EntryOrSync }) {
  if (value === "Verified" || value === "Exported" || value === "Synced") {
    return <Badge variant="secondary">{value}</Badge>;
  }

  if (value === "Rejected" || value === "Failed") {
    return <Badge variant="destructive">{value}</Badge>;
  }

  if (value === "Uploading") {
    return <Badge variant="outline">Uploading</Badge>;
  }

  if (value === "Partially Synced") {
    return <Badge variant="outline">Partial</Badge>;
  }

  return <Badge variant="outline">{value}</Badge>;
}
