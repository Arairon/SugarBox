import { z } from "zod";

export function formatZodIssue(issue: z.ZodIssue) {
  return `${issue.path}: ${issue.message}`;
}
