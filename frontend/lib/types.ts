// /lib/types.ts
export type Subject = { id: string; name: string; practical_count?: number };
export type Practical = {
  id: string;
  title: string;
  deadline?: string;
  submission_count?: number;
  marks?: number;
};
export type Student = {
  id: string;
  name: string;
  email?: string;
  submissions?: Record<string, any>;
};
export type EventItem = {
  id: string;
  date: string;
  title: string;
  type: "deadline" | "lab";
  description?: string;
};
