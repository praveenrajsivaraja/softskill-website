const EMAIL_LINK_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;

export type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number];

export function getEmailConfirmRedirectUrl(): string {
  return `${window.location.origin}/auth/confirm`;
}

export function isEmailLinkType(value: string | null): value is EmailLinkType {
  return EMAIL_LINK_TYPES.some((type) => type === value);
}

export function readEmailLinkError(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const description = params.get('error_description');
  if (description) {
    return description;
  }

  if (params.get('error_code') || params.get('error')) {
    return 'This email link is invalid or has expired.';
  }

  return null;
}
