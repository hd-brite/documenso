import { setupI18n } from "@lingui/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getEnvelopeSenderName,
  getSenderInviteText,
  isSenderNameAllowedForTeam,
  withEnvelopeSenderName,
} from "./envelope-sender";

const RLN_TEAM_ID = 7;

beforeEach(() => {
  vi.stubEnv("NEXT_PRIVATE_BRITE_SENDER_NAME_TEAM_IDS", ` ${RLN_TEAM_ID}, 42 `);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSenderNameAllowedForTeam", () => {
  it("allows only the listed teams", () => {
    expect(isSenderNameAllowedForTeam(RLN_TEAM_ID)).toBe(true);
    expect(isSenderNameAllowedForTeam(42)).toBe(true);
    expect(isSenderNameAllowedForTeam(8)).toBe(false);
    expect(isSenderNameAllowedForTeam(null)).toBe(false);
    expect(isSenderNameAllowedForTeam(undefined)).toBe(false);
  });

  it("allows no team when the setting is unset or empty", () => {
    vi.stubEnv("NEXT_PRIVATE_BRITE_SENDER_NAME_TEAM_IDS", "");
    expect(isSenderNameAllowedForTeam(RLN_TEAM_ID)).toBe(false);
  });
});

const i18n = setupI18n({ locale: "en", messages: { en: {} } });

describe("getEnvelopeSenderName", () => {
  it("returns null when the envelope has no meta or no sender name", () => {
    expect(getEnvelopeSenderName(undefined, RLN_TEAM_ID)).toBeNull();
    expect(getEnvelopeSenderName(null, RLN_TEAM_ID)).toBeNull();
    expect(getEnvelopeSenderName({}, RLN_TEAM_ID)).toBeNull();
    expect(getEnvelopeSenderName({ senderName: null }, RLN_TEAM_ID)).toBeNull();
  });

  it("treats a blank sender name as no sender name", () => {
    expect(getEnvelopeSenderName({ senderName: "" }, RLN_TEAM_ID)).toBeNull();
    expect(
      getEnvelopeSenderName({ senderName: "   " }, RLN_TEAM_ID),
    ).toBeNull();
  });

  it("trims and collapses whitespace, including line breaks", () => {
    expect(
      getEnvelopeSenderName({ senderName: "  Shaun   Ross " }, RLN_TEAM_ID),
    ).toBe("Shaun Ross");
    expect(
      getEnvelopeSenderName(
        { senderName: "Shaun\r\nBcc: x@example.com" },
        RLN_TEAM_ID,
      ),
    ).toBe("Shaun Bcc: x@example.com");
  });

  it("drops bidi overrides and zero-width characters", () => {
    expect(
      getEnvelopeSenderName(
        { senderName: "Sha\u202Eun\u200B Ross" },
        RLN_TEAM_ID,
      ),
    ).toBe("Shaun Ross");
    expect(
      getEnvelopeSenderName({ senderName: "\u200B\u202E" }, RLN_TEAM_ID),
    ).toBeNull();
  });

  it("keeps the zero-width joiners a name needs and trims them at the edges", () => {
    expect(
      getEnvelopeSenderName(
        { senderName: "Mehr\u200Cnoosh Ka\u200Dur" },
        RLN_TEAM_ID,
      ),
    ).toBe("Mehr\u200Cnoosh Ka\u200Dur");
    expect(
      getEnvelopeSenderName(
        { senderName: "\u200D Shaun Ross\u200C " },
        RLN_TEAM_ID,
      ),
    ).toBe("Shaun Ross");
    expect(
      getEnvelopeSenderName({ senderName: " \u200C\u200D " }, RLN_TEAM_ID),
    ).toBeNull();
  });

  it("ignores the sender name for a team that is not allowed", () => {
    expect(
      getEnvelopeSenderName({ senderName: "Hunter Douglas Billing" }, 8),
    ).toBeNull();
    expect(
      getEnvelopeSenderName({ senderName: "Hunter Douglas Billing" }, null),
    ).toBeNull();
  });
});

describe("withEnvelopeSenderName", () => {
  const instanceSender = { name: "Brite Sign", address: "sign@hdbrite.com" };

  it("keeps the sending address and uses the envelope sender name as the display name", () => {
    expect(
      withEnvelopeSenderName(
        instanceSender,
        { senderName: "Shaun Ross" },
        RLN_TEAM_ID,
      ),
    ).toEqual({
      name: "Shaun Ross",
      address: "sign@hdbrite.com",
    });
  });

  it("keeps the instance sender for a team that is not allowed", () => {
    expect(
      withEnvelopeSenderName(
        instanceSender,
        { senderName: "Hunter Douglas Billing" },
        8,
      ),
    ).toEqual(instanceSender);
  });

  it("returns the instance sender unchanged when the envelope has no sender name", () => {
    expect(withEnvelopeSenderName(instanceSender, null, RLN_TEAM_ID)).toEqual(
      instanceSender,
    );
    expect(
      withEnvelopeSenderName(instanceSender, { senderName: " " }, RLN_TEAM_ID),
    ).toEqual(instanceSender);
  });
});

describe("getSenderInviteText", () => {
  it("names the sender and the document in the subject and the message", () => {
    expect(
      getSenderInviteText(i18n, {
        senderName: "Shaun Ross",
        actionVerb: "sign",
        documentTitle: "John Smith (Project 98783983)",
      }),
    ).toEqual({
      subject:
        "Shaun Ross has invited you to sign John Smith (Project 98783983)",
      message:
        'Shaun Ross has invited you to sign the document "John Smith (Project 98783983)".',
    });
  });
});
