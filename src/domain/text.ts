import { ValidationError } from "./errors";

export const MAX_TITLE_LENGTH = 240;
export const MAX_DESCRIPTION_LENGTH = 2_000;

export function normalizeEntityTitle(value: string, fallback: string): string {
  const title = value.trim() || fallback;
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer`);
  }
  return title;
}

export function normalizeDescription(value: string | null | undefined): string | null {
  const description = value?.trim() ?? "";
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ValidationError(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`);
  }
  return description.length === 0 ? null : description;
}
