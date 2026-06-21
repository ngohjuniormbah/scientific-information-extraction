export interface Paper {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  published: string;
  year: number;
  updated: string;
  pdfUrl: string;
  absUrl: string;
  categories: string[];
  primaryCategory: string;
}

export interface Analysis {
  tldr: string;
  plainLanguage: string;
  keyContributions: string[];
  methodology: string;
  findings: string[];
  limitations: string[];
  significance: string;
  futureWork: string[];
  field: string;
  keywords: string[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type SortBy = "relevance" | "newest" | "updated";
