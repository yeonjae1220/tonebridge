/** Matches StudyCard.MAX_PHRASE_LENGTH and the browser's textarea length limit. */
export const MAX_CARD_PHRASE_LENGTH = 500

/**
 * Card tag limits. The server enforces the same numbers (StudyCardController.MAX_TAGS and
 * MAX_TAG_LENGTH): tags are stored comma-joined in one 500-character column.
 */
export const MAX_CARD_TAGS = 20
export const MAX_CARD_TAG_LENGTH = 24

export function parseCardTags(tagText: string): string[] {
  return tagText.split(',').map((tag) => tag.trim()).filter(Boolean)
}

export function cardTagsWithinLimits(tags: readonly string[]): boolean {
  return tags.length <= MAX_CARD_TAGS && tags.every((tag) => tag.length <= MAX_CARD_TAG_LENGTH)
}
