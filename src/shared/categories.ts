import { z } from 'zod'

export const categoryIds = [
  'general',
  'business',
  'technology',
  'science',
  'health',
  'sports',
  'entertainment',
] as const
export const categorySchema = z.enum(categoryIds)
export type Category = z.infer<typeof categorySchema>

export const categoryLabels: Record<Category, string> = {
  general: 'General',
  business: 'Business',
  technology: 'Technology',
  science: 'Science',
  health: 'Health',
  sports: 'Sports',
  entertainment: 'Entertainment',
}
