/**
 * Converts any technical, backend, or network error into a clear, reassuring,
 * non-technical message suitable for everyday health workers and visitors.
 * Never exposes server stack traces, HTTP codes, database names, or internal API details.
 */
export function toFriendlyErrorMessage(
  error: unknown,
  context: 'login' | 'google' | 'save' | 'sync' | 'load' | 'ai' | 'general' = 'general'
): string {
  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
      ? error.message || ''
      : '';

  const lower = raw.toLowerCase();

  if (context === 'login') {
    if (lower.includes('invalid') || lower.includes('401') || lower.includes('credentials')) {
      return 'Invalid username or password. Please check your credentials and try again.';
    }
    if (lower.includes('network') || lower.includes('fetch')) {
      return 'We could not reach the sign-in service. Please check your internet connection and try again.';
    }
    return 'We could not sign you in right now. Please verify your username and password and try again.';
  }

  if (context === 'google') {
    if (lower.includes('popup-closed') || lower.includes('cancelled')) {
      return 'Google Sign-In was closed before finishing. You can try again anytime or sign in with your username and password.';
    }
    return 'Google Sign-In is temporarily unavailable in this browser window. Please sign in using your username and password.';
  }

  if (context === 'save') {
    return 'We could not save this record to the central clinic right now. You can switch to Offline Mode to save it safely on your device.';
  }

  if (context === 'sync') {
    return 'Some records could not be sent right now because the connection was interrupted. Your records remain safely saved on this device—please try again in a moment.';
  }

  if (context === 'ai') {
    return 'The AI Care Assistant is taking a quick pause right now. Please try again in a moment.';
  }

  if (context === 'load') {
    return 'Showing the most recent records saved on your device while we reconnect to the clinic server.';
  }

  return 'Something did not go as planned, but your work is safe. Please try again in a moment.';
}
