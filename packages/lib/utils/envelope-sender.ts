import type { I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { DocumentMeta } from "@prisma/client";

import { env } from "./env";

type SenderNameMeta =
  | Partial<Pick<DocumentMeta, "senderName">>
  | null
  | undefined;

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
 */
export const isSenderNameAllowedForTeam = (
  teamId: number | null | undefined,
) => {
  if (teamId === null || teamId === undefined) {
    return false;
  }

  const allowed = (env("NEXT_PRIVATE_BRITE_SENDER_NAME_TEAM_IDS") ?? "")
    .split(",")
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
export const getEnvelopeSenderName = (
  meta: SenderNameMeta,
  teamId: number | null | undefined,
) => {
  if (!isSenderNameAllowedForTeam(teamId)) {
    return null;
  }

  const senderName = meta?.senderName
    ?.replace(/(?![\u200C\u200D])\p{Cf}/gu, "")
    .replace(/[\s\p{Cc}]+/gu, " ")
    .replace(/^[\s\u200C\u200D]+|[\s\u200C\u200D]+$/gu, "");

  return senderName || null;
};

export const withEnvelopeSenderName = <
  T extends { name: string; address: string },
>(
  sender: T,
  meta: SenderNameMeta,
  teamId: number | null | undefined,
): T => {
  const senderName = getEnvelopeSenderName(meta, teamId);

  return senderName ? { ...sender, name: senderName } : sender;
};

type SenderInviteTextOptions = {
  senderName: string;
  actionVerb: string;
  documentTitle: string;
};

export const getSenderInviteText = (
  i18n: I18n,
  { senderName, actionVerb, documentTitle }: SenderInviteTextOptions,
) => ({
  subject: i18n._(
    msg`${senderName} has invited you to ${actionVerb} ${documentTitle}`,
  ),
  message: i18n._(
    msg`${senderName} has invited you to ${actionVerb} the document "${documentTitle}".`,
  ),
});
