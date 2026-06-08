export type TransformReceipt = {
  canonical_file_path: string;
  canonical_file_sha256: string;
  transform_script: string;
  transform_version: string | null;
  rows_read: number;
  rows_written: number;
  rows_skipped: number;
  skip_reasons: Record<string, number>;
  generated_at: string;
};

export type SourceReceiptEntry = {
  receipt_id: string;
  source_id: string;
  raw_file_path: string;
  raw_file_sha256: string;
  raw_file_size_bytes: number;
  collected_at: string | null;
  collected_by: string | null;
  official_homepage: string | null;
  official_download_page: string | null;
  license_or_terms_note: string | null;
  source_org: string | null;
  source_title: string | null;
  notes: string | null;
  transforms: TransformReceipt[];
};

export type SourceReceiptFile = {
  version: "1.0";
  source_id: string;
  last_updated: string;
  entries: SourceReceiptEntry[];
};

export type Batch1ManifestDataset = {
  source_ingest_id: string;
  source_name: string;
  source_org: string;
  official_homepage: string;
  official_download_page: string;
  license_or_terms_note: string;
};
