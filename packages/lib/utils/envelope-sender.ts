import type { I18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { DocumentMeta } from '@prisma/client';
import { DocumentSource } from '@prisma/client';

import { env } from './env';

type SenderNameMeta = Partial<Pick<DocumentMeta, 'senderName'>> | null | undefined;

/**
 * Brite (BL-3903): an envelope can carry the display name of the person who sent it
 * (`DocumentMeta.senderName`). When set, recipient emails use it as the From name and
 * say "<sender> has invited you to sign" instead of naming the API token owner and the
 * team. The sending address never changes: mail still goes out from the instance or
 * organisation address, so SPF/DKIM keep passing.
 *
 * Only teams listed in NEXT_PRIVATE_BRITE_SENDER_NAME_TEAM_IDS may use it. Any SSO user
 * gets a personal team, so without the allowlist anyone could choose the From name of
 * mail sent from our domain. Unset means no team: the field is stored but ignored.
 *
 * Brite (BL-3923): the From display name is "No Reply - <sender>" (see
 * `withEnvelopeSenderName`), because mail leaves from a no-reply address. The invite wording
 * ("<sender> has invited you to sign") keeps the plain name, and replies still go to
 * `meta.emailReplyTo`.
 */
export const isSenderNameAllowedForTeam = (teamId: number | null | undefined) => {
  if (teamId === null || teamId === undefined) {
    return false;
  }

  const allowed = (env('NEXT_PRIVATE_BRITE_SENDER_NAME_TEAM_IDS') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return allowed.includes(String(teamId));
};

/**
 * The cleaned sender name, or null when unset, blank or the team is not allowed.
 * Format characters (bidi overrides, zero-width spaces) are dropped, except the
 * zero-width non-joiner and joiner that some names need (Persian, Indic scripts),
 * which are only trimmed at the edges. Control characters and whitespace (line
 * breaks included) collapse to single spaces. Same rules as CleanSenderName in the
 * brite Go SDK (libs/go-modules/sdks/documenso).
 */
export const getEnvelopeSenderName = (meta: SenderNameMeta, teamId: number | null | undefined) => {
  if (!isSenderNameAllowedForTeam(teamId)) {
    return null;
  }

  const senderName = meta?.senderName
    ?.replace(/(?![\u200C\u200D])\p{Cf}/gu, '')
    .replace(/[\s\p{Cc}]+/gu, ' ')
    .replace(/^[\s\u200C\u200D]+|[\s\u200C\u200D]+$/gu, '');

  return senderName || null;
};

/** Brite (BL-3923): prefix of the From display name for envelopes that carry a sender name. */
export const BRITE_NO_REPLY_SENDER_PREFIX = 'No Reply - ';

const withNoReplyPrefix = (senderName: string) =>
  /^no[\s-]?reply\b/i.test(senderName) ? senderName : `${BRITE_NO_REPLY_SENDER_PREFIX}${senderName}`;

/**
 * Swaps only the From display name to "No Reply - <sender name>" (not doubled when the
 * name already starts with "No Reply"). Only for the From name: the invite wording uses
 * `getInviteSenderName` and stays plain.
 */
export const withEnvelopeSenderName = <T extends { name: string; address: string }>(
  sender: T,
  meta: SenderNameMeta,
  teamId: number | null | undefined,
): T => {
  const senderName = getEnvelopeSenderName(meta, teamId);

  return senderName ? { ...sender, name: withNoReplyPrefix(senderName) } : sender;
};

type InviteSenderNameOptions = {
  meta: SenderNameMeta;
  teamId: number | null | undefined;
  source: DocumentSource;
  isSelfSigner: boolean;
};

/**
 * The sender name for the invite wording of a signing email (first invite, resend and
 * reminder), or null to keep the upstream wording. A self-signer keeps "your document",
 * and a document from a direct template link has no sending person to name.
 */
export const getInviteSenderName = ({ meta, teamId, source, isSelfSigner }: InviteSenderNameOptions) => {
  if (isSelfSigner || source === DocumentSource.TEMPLATE_DIRECT_LINK) {
    return null;
  }

  return getEnvelopeSenderName(meta, teamId);
};

/**
 * Meta copied from a template without its sender name. The sender name names the person
 * who sends one envelope; a template is made once and used by many people.
 */
export const withoutEnvelopeSenderName = <T extends { senderName?: string | null }>(meta: T | null | undefined) =>
  meta ? { ...meta, senderName: null } : meta;

type SenderInviteTextOptions = {
  senderName: string;
  actionVerb: string;
  documentTitle: string;
};

export const getSenderInviteText = (
  i18n: I18n,
  { senderName, actionVerb, documentTitle }: SenderInviteTextOptions,
) => ({
  subject: i18n._(msg`${senderName} has invited you to ${actionVerb} ${documentTitle}`),
  message: i18n._(msg`${senderName} has invited you to ${actionVerb} the document "${documentTitle}".`),
});
