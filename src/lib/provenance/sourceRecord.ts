export type SourceRecordReference = {
  source_id: string;
  source_name: string;
  source_url: string;
  retrieved_at: string;
  raw_file_path: string;
  raw_record_id: string;
};

export function buildRawRecordId(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join(":");
}
