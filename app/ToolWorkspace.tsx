"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ToolId } from "./types";
import { ConnectPanel } from "./ConnectPanel";
import { RadioIdentityHelp } from "./RadioIdentityHelp";
import { StockFirmwareGuide } from "./StockFirmwareGuide";
import { SelfTestPanel } from "./SelfTestPanel";
import { WritePanel } from "./WritePanel";
import { ConfigPanel } from "./ConfigPanel";
import { CwQuickSetupPanel } from "./CwQuickSetupPanel";
import { ChannelProgramPanel } from "./ChannelProgramPanel";
import { BackupPanel } from "./BackupPanel";
import { SplashTestPanel } from "./SplashTestPanel";
import { WelcomeStringsPanel } from "./WelcomeStringsPanel";
import { SplashFlasherPanel } from "./SplashFlasherPanel";
import {
  FlashGuideK1V3,
  FlashGuideK5V1,
  FlashPathChooser,
  flashPathForModels,
} from "./FlashGuides";
import type { FlashPath } from "./FlashGuides";
import { radioCatalog } from "./radioCatalog";
import { useSession } from "./SessionContext";
import type { ConnState } from "./SessionContext";
import { StepGroup } from "./ui";

import type { UtilityId } from "./types";

interface ToolMeta {
  num: string;
  name: string;
  blurb: ReactNode;
}

const TOOL_META: Record<ToolId, ToolMeta> = {
  flash: {
    num: "01",
    name: "Install firmware",
    blurb: (
      <>
        This app can&rsquo;t install firmware itself — that&rsquo;s on purpose.
        You&rsquo;ll use a separate installer; which one depends on your
        radio. Pick your model below, follow the steps, then come back here
        to set up your radio.
      </>
    ),
  },
  program: {
    num: "02",
    name: "Program radio",
    blurb: (
      <>
        Back up your radio first, then set up channels and text. Every change
        is read back to confirm it saved — if anything doesn&rsquo;t match,
        the tool stops and tells you rather than leaving things half-done.
      </>
    ),
  },
  splash: {
    num: "03",
    name: "Boot screen",
    blurb: (
      <>
        Change what your radio shows when it powers on — the display style,
        two lines of welcome text, or a custom logo image (on firmware that
        supports it). Each option backs up the original first so you can put
        it back.
      </>
    ),
  },
};

const UTILITY_META: Record<UtilityId, ToolMeta> = {
  "self-test": {
    num: "U-1",
    name: "Check this radio",
    blurb: (
      <>
        Confirms that changes you make will actually stick on this radio.
        It temporarily writes to one unused channel, reads it back, restarts
        the radio, and checks again — then puts everything back. The result
        is remembered for this firmware so you only run it once.
      </>
    ),
  },
  identity: {
    num: "U-2",
    name: "Which radio is this?",
    blurb: (
      <>
        We couldn&rsquo;t be completely sure which radio is connected.
        Compare the photos and notes below against the radio in your hand.
      </>
    ),
  },
  "connection-details": {
    num: "U-3",
    name: "Connection details",
    blurb: (
      <>
        Everything we detected when you connected: the radio model, its
        firmware, whether changes are safe to make, and a few status flags.
      </>
    ),
  },
};

export function ToolWorkspace({
  tool,
  onBack,
}: {
  tool: ToolId | UtilityId;
  onBack: () => void;
}) {
  const isUtility = tool === "self-test" || tool === "identity" || tool === "connection-details";
  const meta = isUtility
    ? UTILITY_META[tool as UtilityId]
    : TOOL_META[tool as ToolId];

  return (
    <>
      <div className="tool-view-head">
        <div className="tool-view-title">
          <span className="tool-view-num">{meta.num}</span>
          <h1 className="tool-view-name">{meta.name}</h1>
        </div>
        <button className="tool-view-back" onClick={onBack}>
          ← back to hub
        </button>
      </div>
      <p className="tool-view-blurb">{meta.blurb}</p>

      <div className="tool-stack">
        <ToolContent tool={tool} />
      </div>
    </>
  );
}

function ToolContent({ tool }: { tool: ToolId | UtilityId }) {
  const { state } = useSession();
  const connected = state.kind === "connected";

  switch (tool) {
    case "flash":
      return <FlashTool />;

    case "program": {
      if (!connected)
        return (
          <ConnectPrompt lead="Connect your radio when you're ready to make changes — you can set everything up after." />
        );
      const guard = firmwareGuard(state, "program");
      if (guard) return guard;
      return (
        <>
          <StepGroup
            n={1}
            title="Back up your radio"
            importance="important"
            hint="Save a copy of everything on your radio before changing anything. If a change ever goes wrong, this is what puts it back."
          >
            <BackupPanel />
          </StepGroup>
          <StepGroup
            n={2}
            title="Make your changes"
            importance="optional"
            hint="Use whichever of these you need — they're independent. Nothing is sent to the radio until you review the changes and choose to save."
          >
            <ChannelProgramPanel />
            <CwQuickSetupPanel />
            <WritePanel />
            <ConfigPanel />
          </StepGroup>
        </>
      );
    }

    case "splash": {
      if (!connected)
        return (
          <ConnectPrompt lead="Connect your radio when you're ready to change the boot screen." />
        );
      const guard = firmwareGuard(state, "splash");
      if (guard) return guard;
      return (
        <>
          <p className="tool-view-blurb" style={{ marginBottom: 0 }}>
            Pick whichever option fits what you want to change. Each one backs
            up the original first.
          </p>
          <WelcomeStringsPanel />
          <SplashFlasherPanel />
          <SplashTestPanel />
        </>
      );
    }

    case "self-test":
      if (!connected)
        return <ConnectPrompt lead="Connect your radio to run the check." />;
      return <SelfTestPanel />;

    case "identity":
      if (!connected)
        return (
          <ConnectPrompt lead="Connect your radio so we can compare what it reports against the radio in your hand." />
        );
      return <RadioIdentityHelp />;

    case "connection-details":
      return <ConnectPanel />;
  }
}

/**
 * Firmware-compatibility gate, enforced here rather than at the hub so the
 * tools stay openable without a connection. Returns a callout to render in
 * place of the tool when the connected radio's firmware can't safely accept
 * changes; null when it can (or when not connected — that case is handled
 * by the caller before reaching here).
 */
function firmwareGuard(
  state: ConnState,
  tool: "program" | "splash",
): ReactNode {
  if (state.kind !== "connected") return null;
  const fw = state.result.firmware;

  if (fw.kind === "matched" && fw.entry.family === "stock") {
    return (
      <div className="callout">
        {tool === "program"
          ? "Your radio's factory firmware won't accept changes. Install custom firmware first (the Install firmware tool walks you through it)."
          : "Factory firmware won't let the boot screen be changed. Install custom firmware first (the Install firmware tool walks you through it)."}
      </div>
    );
  }

  if (fw.kind !== "matched") {
    return (
      <div className="callout">
        We don&rsquo;t recognize this firmware, so we won&rsquo;t risk changing
        anything. Check the connection details to see what the radio reported.
      </div>
    );
  }

  return null;
}

/**
 * Actionable not-connected state. Instead of pointing at the rail, this lets
 * the user connect right where they are, just before they make changes —
 * connection is no longer a gate to opening the tool.
 */
function ConnectPrompt({ lead }: { lead: string }) {
  const { state, connect } = useSession();

  if (state.kind === "unsupported") {
    return (
      <div className="callout">
        Connecting to a radio needs Chrome or Edge on a desktop computer, over
        a secure (https) page. Open this page there to continue.
      </div>
    );
  }

  const busy = state.kind === "connecting";
  return (
    <div className="callout">
      <p style={{ marginTop: 0 }}>{lead}</p>
      <p>
        Put the radio in programming mode — hold the lower side button
        (Side&nbsp;2) while turning it on — plug in the programming cable, then
        connect.
      </p>
      <button onClick={connect} disabled={busy}>
        {busy ? "connecting…" : "connect radio"}
      </button>
      {state.kind === "error" ? (
        <p
          style={{
            marginTop: "var(--space-3)",
            color: "var(--err)",
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function FlashTool() {
  const { state } = useSession();

  // Only the identifications that actually name models feed the default.
  // `conflict` means the firmware fingerprint and the EEPROM model bytes
  // disagree — exactly the case where guessing an install path is the
  // wrong move — and `unknown` names nothing. Both leave the pick to the
  // user. (See `RadioIdentity` in src/detection/detect.ts.)
  const radio = state.kind === "connected" ? state.result.radio : null;
  const detectedModels =
    radio !== null &&
    (radio.kind === "confirmed" ||
      radio.kind === "inferred" ||
      radio.kind === "ambiguous")
      ? radio.models
      : null;
  const detectedPath = detectedModels
    ? flashPathForModels(detectedModels)
    : null;

  // Default to the K1 / K5 V3 path — the flow this site shipped with and
  // the firmware we host. Detection promotes the right path once a radio
  // is connected, but a manual pick always wins: installing happens with
  // the radio in bootloader mode (and often in another tab), so the user
  // is frequently reading these steps with nothing connected.
  const [path, setPath] = useState<FlashPath>("k1-v3");
  const [userPicked, setUserPicked] = useState(false);

  useEffect(() => {
    if (!userPicked && detectedPath !== null) setPath(detectedPath);
  }, [userPicked, detectedPath]);

  const detectedNames = detectedModels
    ? detectedModels.map((m) => radioCatalog[m].displayName).join(" / ")
    : null;
  const detectedNote =
    detectedNames === null
      ? undefined
      : detectedPath !== null
        ? `Connected radio reports ${detectedNames} — these steps are selected to match.`
        : `Connected radio reports ${detectedNames} — we have no confirmed install path for that, so check it against the options above and pick one.`;

  const connectedToStock =
    state.kind === "connected" &&
    state.result.firmware.kind === "matched" &&
    state.result.firmware.entry.family === "stock";

  return (
    <>
      <FlashPathChooser
        value={path}
        onChange={(next) => {
          setUserPicked(true);
          setPath(next);
        }}
        {...(detectedNote === undefined ? {} : { detectedNote })}
      />

      {/* The stock-firmware walkthrough is written against the K1 / K5 V3
          flow (UVTools2, the build we host). Suppress it on the V1 path so
          a classic-K5 owner isn't handed the wrong links. */}
      {connectedToStock && path === "k1-v3" ? <StockFirmwareGuide /> : null}

      {path === "k5-v1" ? <FlashGuideK5V1 /> : <FlashGuideK1V3 />}
    </>
  );
}
