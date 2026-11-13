import type { MessageKey } from '@/i18n/messages'
export type AuthField = 'email' | 'username' | 'password'
export type AuthErrors = Partial<Record<AuthField, MessageKey>>
/** Mirror the server register contract; the server remains authoritative. */
export function validateAuth(email: string, password: string, username?: string): AuthErrors {
  const errors: AuthErrors = {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'access.emailInvalid'
  if (username !== undefined && !/^[a-zA-Z0-9_]{2,20}$/.test(username.trim())) errors.username = 'profile.nicknameInvalid'
  if (username !== undefined) {
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#^()\-])[A-Za-z\d@$!%*?&_#^()\-]{8,100}$/.test(password)) errors.password = 'access.passwordRule'
  } else if (!password) errors.password = 'access.passwordRequired'
  return errors
}
