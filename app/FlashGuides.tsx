"use client";

import type { ReactNode } from "react";
import type { RadioModelId } from "../src/schema/types";

/**
 * Firmware-install guidance, split by hardware generation.
 *
 * The two generations in scope need *different firmware and a different
 * installer*, and neither is interchangeable:
 *
 *   - `k5-v1` — the original UV-K5 / UV-K5(8) V1, DP32G030 silicon. Firmware
 *     from briand/uv-k5-firmware-custom-cw, installed with egzumer's
 *     UVTools (https://egzumer.github.io/uvtools/).
 *   - `k1-v3` — UV-K1 Mini Kong and UV-K5(99) V3, PY32F071 silicon.
 *     Firmware from briand/uv-k1-k5v3-firmware-custom (we host a build),
 *     installed with armel's UVTools2.
 *
 * The DP32G030-vs-PY32F071 split is the same one the schema encodes as
 * `uv-k5-v1`/`uv-k5-v2` vs `uv-k5-v3`/`uv-k1` (see CLAUDE.md, "F4HWN
 * settings address differs by hardware").
 *
 * Only `uv-k5-v1` maps onto the `k5-v1` path, because V1 is the only
 * revision the steps have been run against. `uv-k5-v2` is almost
 * certainly the same silicon class, but "almost certainly" isn't a
 * citation — an unvalidated V2 gets no auto-selection and no claim in
 * the copy. `uv-k6` is out for a different reason: K6 is a marketing
 * rename of UV-K5(8) and lands in whichever bucket its silicon revision
 * puts it in. Both fall through to "pick one yourself".
 */
export type FlashPath = "k5-v1" | "k1-v3";

export const FLASH_PATHS: ReadonlyArray<{
  id: FlashPath;
  name: string;
  sub: string;
}> = [
  {
    id: "k5-v1",
    name: "UV-K5 / UV-K5(8) — V1",
    sub: "The original K5. Monochrome screen. Slim body, no “Mini Kong” badge.",
  },
  {
    id: "k1-v3",
    name: "UV-K1 Mini Kong, or UV-K5(99) V3",
    sub: "Chunkier “Mini Kong” body, or a K5 with a colour screen.",
  },
];

/** Models whose install path is settled. Anything absent disqualifies. */
const PATH_BY_MODEL: Partial<Record<RadioModelId, FlashPath>> = {
  "uv-k5-v1": "k5-v1",
  "uv-k5-v3": "k1-v3",
  "uv-k1": "k1-v3",
  // "uv-k5-v2" is absent on purpose — see the note above.
};

/**
 * Which install path a detected radio implies, or null when the detection
 * doesn't settle it.
 *
 * EVERY candidate must agree, not just one of them. The registry hands us
 * whole candidate sets, and a `.some()` test would pick a path off one
 * recognised member while the UI printed the rest of the set beside
 * "selected to match" — `f4hwn-v1` carries
 * `['uv-k5-v1', 'uv-k5-v2', 'uv-k6']`, so matching on `uv-k5-v1` alone
 * would assert the V1 steps suit a V2.
 *
 * `uv-k6` is dropped before the check rather than disqualifying: within a
 * firmware's candidate list it is a name, not a silicon claim. The
 * fingerprint already pins the silicon (NR7Y only runs on PY32F071), and
 * CLAUDE.md's "UV-K6 is a marketing rename" note says K6 was added to
 * these lists purely so the UI can surface the name. An empty remainder
 * still returns null.
 */
export function flashPathForModels(
  models: ReadonlyArray<RadioModelId>,
): FlashPath | null {
  const settled = models.filter((m) => m !== "uv-k6");
  if (settled.length === 0) return null;

  let agreed: FlashPath | null = null;
  for (const model of settled) {
    const path = PATH_BY_MODEL[model];
    if (path === undefined) return null;
    if (agreed === null) agreed = path;
    else if (agreed !== path) return null;
  }
  return agreed;
}

export function FlashPathChooser({
  value,
  onChange,
  detectedNote,
  detectedWarn = false,
}: {
  value: FlashPath;
  onChange: (next: FlashPath) => void;
  detectedNote?: ReactNode;
  /** Renders the note in the warning hue — used when the manual pick
   *  disagrees with what the connected radio reported. */
  detectedWarn?: boolean;
}) {
  return (
    <section className="hw-path">
      <h2>Which radio are you installing on?</h2>
      <p className="hw-path-lead">
        The two generations need different firmware and a different installer
        — they are not interchangeable. Pick yours and the steps below change
        to match. Not sure? Connect the radio first and we&rsquo;ll tell you
        what it reports.
      </p>
      <div
        className="hw-path-options"
        role="radiogroup"
        aria-label="Radio hardware generation"
      >
        {FLASH_PATHS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={value === p.id}
            className={
              value === p.id ? "hw-path-option is-selected" : "hw-path-option"
            }
            onClick={() => onChange(p.id)}
          >
            <span className="hw-path-option-name">{p.name}</span>
            <span className="hw-path-option-sub">{p.sub}</span>
          </button>
        ))}
      </div>
      {detectedNote ? (
        <p
          className={
            detectedWarn
              ? "hw-path-detected is-warn"
              : "hw-path-detected"
          }
        >
          {detectedNote}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Original UV-K5 / UV-K5(8) V1 install guide.
 *
 * Deliberately links the *releases page* rather than a pinned asset: the
 * fork ships new versions and a hardcoded filename here would rot into a
 * 404. v1.2 was latest when this was written.
 */
export function FlashGuideK5V1() {
  return (
    <div className="flash-card">
      <h2>Install custom firmware on the original UV-K5</h2>
      <p style={{ marginTop: "var(--space-2)", color: "var(--fg-muted)" }}>
        This app sets up your radio, but it doesn&rsquo;t install firmware. For
        the original K5 you need{" "}
        <a
          href="https://egzumer.github.io/uvtools/"
          target="_blank"
          rel="noopener noreferrer"
        >
          egzumer&rsquo;s UVTools
        </a>
        {" "}— <em>not</em> the UVTools2 used for the K1 and K5 V3. Follow the
        steps below, then come back here.
      </p>

      <ol className="flash-steps">
        <li>
          <div>
            <h4>Back up your calibration first</h4>
            <p>
              Before you change anything, use UVTools to save a copy of the
              radio&rsquo;s factory calibration and EEPROM. That tuning is
              unique to your radio and can&rsquo;t be recreated — if an
              install goes wrong, the backup is the only way back.
            </p>
          </div>
        </li>
        <li>
          <div>
            <h4>Download the firmware</h4>
            <p>
              Get the latest <code>.bin</code> from{" "}
              <a
                href="https://github.com/briand/uv-k5-firmware-custom-cw/releases"
                target="_blank"
                rel="noopener noreferrer"
              >
                briand/uv-k5-firmware-custom-cw releases
              </a>{" "}
              — the CW-capable custom firmware for the original K5.{" "}
              <strong>v1.2</strong> was the latest when this page was written;
              take whatever is newest on that page rather than hunting for
              that exact version.
            </p>
            <p>
              Don&rsquo;t use the K1 build we host on this site. It targets
              different silicon and won&rsquo;t run on the original K5.
            </p>
          </div>
        </li>
        <li>
          <div>
            <h4>Put the radio in install mode</h4>
            <p>
              Power the radio off (volume knob counter-clockwise until it
              clicks). Hold <strong>PTT</strong> by itself — no side buttons —
              and power on by turning the volume knob clockwise, then release
              PTT. The radio is now waiting for firmware.
            </p>
          </div>
        </li>
        <li>
          <div>
            <h4>Install it with egzumer&rsquo;s UVTools</h4>
            <p>
              Open{" "}
              <a
                href="https://egzumer.github.io/uvtools/"
                target="_blank"
                rel="noopener noreferrer"
              >
                egzumer.github.io/uvtools
              </a>{" "}
              in a new tab. You&rsquo;ll need to disconnect this page first —
              only one browser tab can hold the serial port at a time. Select
              the <code>.bin</code>{" "}
              you downloaded, pick the radio&rsquo;s
              port, and start the install. Wait for the radio to restart on
              its own.
            </p>
          </div>
        </li>
        <li>
          <div>
            <h4>Come back and reconnect</h4>
            <p>
              Turn the radio off and back on normally (no buttons held),
              reconnect the cable, and use the <em>connect radio</em> button in
              the bar above.
            </p>
          </div>
        </li>
      </ol>

      <div className="callout">
        <strong>We haven&rsquo;t captured this build yet.</strong>{" "}
        This app recognises firmware by the version string the radio reports, and
        we have no capture for briand&rsquo;s CW fork on a K5 V1. After
        installing, this app may say{" "}
        <em>&ldquo;firmware not recognized&rdquo;</em>{" "}
        and keep the Program and
        Boot screen tools locked — the radio is fine, we just don&rsquo;t yet
        know its layout. If that happens, open{" "}
        <em>Connection details</em> and send us the version string it reports
        so we can add it.
      </div>

      <div className="callout">
        <strong>Wrong installer, no install.</strong>{" "}
        The original K5
        (DP32G030) and the K1 / K5&nbsp;V3 (PY32F071) have different
        bootloaders, so the two tools aren&rsquo;t interchangeable: UVTools for
        the original K5, UVTools2 for the K1 and K5&nbsp;V3.
      </div>
    </div>
  );
}

/**
 * UV-K1 Mini Kong / UV-K5(99) V3 install guide. Unchanged content, lifted
 * out of ToolWorkspace when the V1 path was added.
 */
export function FlashGuideK1V3() {
  return (
    <div className="flash-card">
      <h2>Install custom firmware with UVTools2</h2>
      <p style={{ marginTop: "var(--space-2)", color: "var(--fg-muted)" }}>
        This app sets up your radio, but it doesn&rsquo;t install firmware.
        For that, use a separate, free tool called{" "}
        <a
          href="https://armel.github.io/uvtools2/"
          target="_blank"
          rel="noopener noreferrer"
        >
          UVTools2
        </a>
        . Follow the steps below, then come back here.
      </p>

      <ol className="flash-steps">
        <li>
          <div>
            <h4>Choose firmware</h4>
            <p>
              The F4HWN family (Fusion, Edition, NR7Y) works on UV-K5 and
              UV-K1 radios. If you want a custom logo on the boot screen,
              use a build that supports it — the download below does.
            </p>
            <div className="firmware-download">
              <div className="firmware-download-head">
                <strong>NR7Y CW (BKG build) — UV-K1</strong>
                <span className="firmware-download-meta">
                  v1.1.0 · 87 KB
                </span>
              </div>
              <p className="firmware-download-blurb">
                F4HWN NR7Y CW preset built from{" "}
                <a
                  href="https://github.com/briand/uv-k1-k5v3-firmware-custom"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  briand/uv-k1-k5v3-firmware-custom
                </a>{" "}
                with <code>ENABLE_FEAT_F4HWN_LOGO</code> and{" "}
                <code>ENABLE_FEAT_NR7Y_CW</code> on. Enables the bitmap
                splash (Splash tool) and the full CW keyer block this
                programmer's Quick CW Setup writes to (menus 71/72/73).
                Targets UV-K1 Mini Kong; the same image runs on
                UV-K5-V3 (firmware identifies as ambiguous —
                Quick CW Setup is gated to UV-K1 only for now).
              </p>
              <p className="firmware-download-blurb">
                <strong>v1.1.0 changes:</strong> CAT control over
                UART/VCP with USB status indicator; UART-safe escape
                hatches for the CW keyer PA10 conflict.{" "}
                <strong>Breaking:</strong>{" "}
                default CW paddle mapping
                is now TIP=dit, RING=dah (industry standard). If you
                had previously selected a &ldquo;Reversed&rdquo;
                key-input mode to compensate, switch to the
                non-reversed equivalent after flashing (and vice
                versa).
              </p>
              <a
                href="/firmware/nr7y.cw-bkg-logo.v1.1.0.bin"
                download
                className="firmware-download-btn"
              >
                Download nr7y.cw-bkg-logo.v1.1.0.bin
              </a>
              <p className="firmware-download-hash">
                SHA256:{" "}
                <code>
                  011fd156de29df6066e7388ee49b2b82a916fc071b86cb1f05f8048a712fe51b
                </code>
              </p>
            </div>
          </div>
        </li>
        <li>
          <div>
            <h4>Put the radio in install mode</h4>
            <p>
              <strong>UV-K1 Mini Kong:</strong> hold the <strong>PTT</strong>{" "}
              key by itself while powering on — adding the top side button
              opens a different hidden menu instead.{" "}
              <strong>UV-K5(99) V3:</strong> PTT by itself is the usual
              K5-family combo, but we have no confirmed capture from V3
              hardware, so treat it as unverified.
            </p>
          </div>
        </li>
        <li>
          <div>
            <h4>Install it with UVTools2</h4>
            <p>
              In UVTools2, open the firmware file you downloaded, pick the
              radio&rsquo;s port, and start the install. Wait for the radio
              to restart on its own.
            </p>
          </div>
        </li>
        <li>
          <div>
            <h4>Come back and reconnect</h4>
            <p>
              Turn the radio off and back on normally, reconnect the cable,
              and use the <em>connect radio</em> button in the bar above.
              The Program and Boot screen tools unlock once the new firmware
              is detected.
            </p>
          </div>
        </li>
      </ol>

      <div className="callout">
        <strong>Why is this needed?</strong> The factory firmware quietly
        ignores changes to channels, settings, and the boot screen — it
        accepts the request but nothing actually changes. Custom firmware
        allows those changes.
      </div>
    </div>
  );
}
