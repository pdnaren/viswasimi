export type Topic    = { id: string; name: string; state: "done"|"in_progress"|"available"|"locked"; durationM: number; mastery: number };
export type Chapter  = { id: string; name: string; topics: Topic[] };
export type Subject  = { id: string; name: string; chapters: Chapter[] };
export type PlanItem = { id: string; topicId: string; topicName: string; state: string };

export interface Message {
  id:          string;
  role:        "user" | "assistant";
  content:     string;
  createdAt?:  string;
  /** If this assistant message ended with a [CHECKPOINT] question, store it here */
  checkpoint?: string;
  /** After grading, store the result. undefined = not graded yet, null = NA (no score) */
  gradeResult?: { correct: boolean; score: number } | null;
}
