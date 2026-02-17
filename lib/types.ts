export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  category?: string | null;
  description?: string | null;
  publication_date?: string | null;
  apply_url: string;
  experience_level?: string | null;
  created_at?: string;
}

export type SortOption = "newest" | "oldest";

export interface JobFilters {
  search?: string;
  location?: string;
  category?: string;
  experience?: string;
  remote?: boolean;
  sort?: SortOption;
  page?: number;
  limit?: number;
}

export const EXPERIENCE_OPTIONS = [
  { value: "", label: "Any experience" },
  { value: "Internship", label: "Internship" },
  { value: "Entry Level", label: "Entry Level" },
  { value: "Mid Level", label: "Mid Level" },
  { value: "Senior Level", label: "Senior Level" },
  { value: "Lead", label: "Lead" },
  { value: "Executive", label: "Executive" },
] as const;
