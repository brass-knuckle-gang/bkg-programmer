import type { BlockModuleDef } from '../types';

/**
 * NR7Y CW-modulator settings block, v1.4 layout. 8 bytes.
 *
 * Same module ID and address as nr7y-cw-settings.ts (v1.0-v1.1 layout);
 * the v1.4 profile lists this module last so it replaces the old one by
 * ID. Do not bind both in one profile.
 *
 * Verified against briand/uv-k1-k5v3-firmware-custom tag v1.4:
 *   App/settings.c:416-444    (READ path)
 *   App/settings.c:1148-1161  (WRITE path)
 *   App/settings.c:50-70      (sidetone code <-> level table)
 *   App/settings.h:68-108     (key input table, keyer mode enum, limits)
 * Cross-checked with chirp/nr7y.k1-k5v3.chirp.py:833-899 and :4420-4515
 * at the same tag, which carries the same tables.
 *
 * Base address: physical/virtual 0x00A140 on V3/K1 (identity-mapped
 * inside the settings region 0xA000..0xA170 per
 * App/driver/eeprom_compat.c:56). Bound per-profile.
 *
 * Byte map:
 *   [0]  bits 0-3  cw_tone_frequency_idx   0..10  -> 450..950 Hz step 50
 *        bits 4-7  cw_sidetone_code        0..15  CODE, not level (see
 *                                          s_cw_sidetone_code_to_level)
 *   [1]  bits 0-6  cw_key_wpm              10..45 (firmware default 18)
 *        bit  7    unused                  (firmware writes 0, ignores on
 *                                          read; v1.0-v1.1 kept keyer
 *                                          mode here)
 *   [2]  bits 0-4  cw_key_input_menu       0..10
 *        bit  5    cw_farnsworth_auto      copy practice auto spacing
 *        bit  6    cw_breakin_enable       0=off, 1=on
 *        bit  7    cw_byte2_invalid        0 = struct valid (REQUIRED).
 *                                          Firmware reads `Data[2] < 0x80`.
 *   [3]  bits 0-6  cw_message_repeat_delay seconds (default 4)
 *        bit  7    cw_byte3_invalid        same validity-marker pattern
 *   [4]  bits 0-1  cw_keyer_mode           0=A, 1=B, 2=Ultimatic, 3=Bug
 *        bits 2-7  cw_farnsworth_wpm       0=off, 5..44 effective WPM
 *   [5]  byte      cw_roger_dah_dits       3..20 (default 9)
 *   [6]            unused                  firmware keeps 0xFF (pre-1.0
 *                                          betas kept an ADC byte here)
 *   [7]  byte      cw_hang_10ms            1..200 x 10 ms (default 30)
 *
 * Byte 4 has NO validity bit. The firmware accepts the byte only when
 * the Farnsworth field is 0 or 5..44 (App/settings.c:425-433); anything
 * else (0xFF on a radio upgraded from v1.1 reads as 63) discards the
 * whole byte, keyer mode included, and falls back to Iambic B. Writers
 * that touch cw_keyer_mode on such a radio must also write
 * cw_farnsworth_wpm (Quick CW Setup writes "Off"). Bytes 5 and 7 are
 * range-checked on read and fall back to their defaults when 0xFF.
 */
export const nr7yCwSettingsV14: BlockModuleDef = {
  kind: 'block',
  id: 'nr7y_cw_settings',
  // baseOffset deliberately omitted — supplied inline by the profile.
  size: 8,
  sensitivity: 'shareable',
  fields: [
    // Byte 0 — sidetone
    {
      id: 'cw_tone_frequency_idx',
      label: 'CW Tone Frequency',
      description:
        'Stored index 0..10. Actual frequency = 450 + idx*50 Hz (450..950 Hz). ' +
        'Firmware: gEeprom.CW_TONE_FREQUENCY = 45 + (Data[0] & 0xf) * 5 (in 10-Hz ' +
        'units). The v1.4 CWfreq menu and CHIRP stop at index 7 (800 Hz).',
      group: 'cw.tone',
      type: { kind: 'int', min: 0, max: 10, unit: 'step' },
      location: { kind: 'bits', offset: 0, bitOffset: 0, bitWidth: 4 },
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },
    {
      id: 'cw_sidetone_code',
      label: 'CW Sidetone Level',
      description:
        'Stored as a 4-bit CODE, not the menu level. Codes 1-6 are the old ' +
        '6-level curve and map to new levels 6, 11..15 so an upgraded radio ' +
        'keeps its loudness; codes 7-15 hold the levels the old curve lacked. ' +
        'Table: App/settings.c:56-59 (s_cw_sidetone_code_to_level). Labels ' +
        'below are the menu level each code selects. Firmware default is ' +
        'level 7 (code 12); 0xFF in byte 0 also yields level 7.',
      group: 'cw.tone',
      type: {
        kind: 'enum',
        values: [
          { value: 0, label: 'Off' },
          { value: 7, label: 'Level 1' },
          { value: 8, label: 'Level 2' },
          { value: 9, label: 'Level 3' },
          { value: 10, label: 'Level 4' },
          { value: 11, label: 'Level 5' },
          { value: 1, label: 'Level 6' },
          { value: 12, label: 'Level 7' },
          { value: 13, label: 'Level 8' },
          { value: 14, label: 'Level 9' },
          { value: 15, label: 'Level 10' },
          { value: 2, label: 'Level 11' },
          { value: 3, label: 'Level 12' },
          { value: 4, label: 'Level 13' },
          { value: 5, label: 'Level 14' },
          { value: 6, label: 'Level 15' },
        ],
      },
      location: { kind: 'bits', offset: 0, bitOffset: 4, bitWidth: 4 },
      defaultValue: 12,
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },

    // Byte 1 — speed (keyer mode moved to byte 4 in v1.2)
    {
      id: 'cw_key_wpm',
      label: 'CW Keyer Speed',
      description:
        'Words-per-minute. Firmware clamps to [10,45] on load; out-of-range ' +
        'values fall back to default 18. Bit 7 is unused in this layout.',
      group: 'cw.keyer',
      type: { kind: 'int', min: 10, max: 45, unit: 'WPM' },
      location: { kind: 'bits', offset: 1, bitOffset: 0, bitWidth: 7 },
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },

    // Byte 2 — key input wiring + auto spacing + break-in + validity marker
    {
      id: 'cw_key_input_menu',
      label: 'CW Key Input Mode',
      description:
        'Index into the CW_KEY_INPUT submenu (also stored separately as ' +
        'the bitmap via CW_KEY_INPUT_menu_to_bitmap[]). See ' +
        'App/settings.h:68-80. Modes 8-10 hand the USB-C port pins to the ' +
        'paddle (App/app/cwhardware.c:616-626) and drop a USB-C programming ' +
        'link. Firmware reads bits 0-3 and clamps to 10; writes bits 0-4.',
      group: 'cw.keyer',
      type: {
        kind: 'enum',
        values: [
          { value: 0, label: 'PTT HandKey' },
          { value: 1, label: 'Port HandKey' },
          { value: 2, label: 'Side Btn Iambic' },
          { value: 3, label: 'Side Btn Iambic Reversed' },
          { value: 4, label: 'Port Iambic' },
          { value: 5, label: 'Port Iambic Reversed' },
          { value: 6, label: 'Port+Btn Iambic' },
          { value: 7, label: 'Port+Btn Iambic Reversed' },
          { value: 8, label: 'USB Port Iambic' },
          { value: 9, label: 'USB Port Iambic Reversed' },
          { value: 10, label: 'USB Port HandKey' },
        ],
      },
      location: { kind: 'bits', offset: 2, bitOffset: 0, bitWidth: 5 },
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },
    {
      id: 'cw_farnsworth_auto',
      label: 'CW Copy Practice Auto Spacing',
      description:
        'Copy practice (CPO) auto spacing. Firmware default: OFF. Only ' +
        'honoured when cw_byte2_invalid is 0 (App/settings.c:437).',
      group: 'cw.keyer',
      type: { kind: 'bool' },
      location: { kind: 'bits', offset: 2, bitOffset: 5, bitWidth: 1 },
      defaultValue: 0,
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },
    {
      id: 'cw_breakin_enable',
      label: 'CW Break-in',
      description:
        'When ON, transmits RF while keying. When OFF, sidetone only ' +
        '(no RF). Firmware default: ON.',
      group: 'cw.keyer',
      type: { kind: 'bool' },
      location: { kind: 'bits', offset: 2, bitOffset: 6, bitWidth: 1 },
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },
    {
      id: 'cw_byte2_invalid',
      label: 'CW Byte 2 Invalid Marker',
      description:
        'MUST be 0 for the firmware to honour key-input-mode, auto spacing ' +
        'and break-in. Cleared by the firmware on every save ' +
        '(App/settings.c:1152). If you are writing to byte 2 of this block, ' +
        'also write 0 here, otherwise the firmware discards the byte and ' +
        'reverts to defaults on next load. On a blank byte (0xFF) clearing ' +
        'this alone leaves auto spacing at 1; write cw_farnsworth_auto too.',
      group: 'cw.internal',
      type: { kind: 'bool' },
      location: { kind: 'bits', offset: 2, bitOffset: 7, bitWidth: 1 },
      defaultValue: 0,
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },

    // Byte 3 — message repeat delay + validity marker
    {
      id: 'cw_message_repeat_delay',
      label: 'CW Message Repeat Delay',
      description:
        'Seconds between auto-repeat playbacks of a CW macro. Firmware ' +
        'default 4 s when the byte is invalid.',
      group: 'cw.macro',
      type: { kind: 'int', min: 0, max: 127, unit: 's' },
      location: { kind: 'bits', offset: 3, bitOffset: 0, bitWidth: 7 },
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },
    {
      id: 'cw_byte3_invalid',
      label: 'CW Byte 3 Invalid Marker',
      description:
        'Same validity-marker pattern as cw_byte2_invalid. Clear to 0 ' +
        'whenever cw_message_repeat_delay is being set.',
      group: 'cw.internal',
      type: { kind: 'bool' },
      location: { kind: 'bits', offset: 3, bitOffset: 7, bitWidth: 1 },
      defaultValue: 0,
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },

    // Byte 4 — keyer mode + Farnsworth speed. No validity bit; see header.
    {
      id: 'cw_keyer_mode',
      label: 'CW Keyer Mode',
      description:
        'CW_IambicMode_t (App/settings.h:84-89). Keyer is disabled when the ' +
        'key input is a HandKey mode. Only honoured when cw_farnsworth_wpm ' +
        'holds a valid value (App/settings.c:425-433); otherwise the firmware ' +
        'uses Iambic B.',
      group: 'cw.keyer',
      type: {
        kind: 'enum',
        values: [
          { value: 0, label: 'Iambic A' },
          { value: 1, label: 'Iambic B' },
          { value: 2, label: 'Ultimatic' },
          { value: 3, label: 'Semi-Auto Bug' },
        ],
      },
      location: { kind: 'bits', offset: 4, bitOffset: 0, bitWidth: 2 },
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },
    {
      id: 'cw_farnsworth_wpm',
      label: 'CW Copy Practice Speed',
      description:
        'Copy practice (Farnsworth) effective speed. 0 = off; otherwise ' +
        '5..44 WPM (CW_FARNSWORTH_WPM_MIN, App/settings.h:108; upper bound ' +
        'from App/settings.c:425 `< 45`). Any other value makes the firmware ' +
        'discard byte 4 entirely, keyer mode included. A radio upgraded from ' +
        'v1.0/v1.1 holds 0xFF here (reads as 63) until it saves settings.',
      group: 'cw.keyer',
      type: {
        kind: 'enum',
        values: [
          { value: 0, label: 'Off' },
          ...Array.from({ length: 40 }, (_, i) => ({
            value: 5 + i,
            label: `${5 + i} WPM`,
          })),
        ],
      },
      location: { kind: 'bits', offset: 4, bitOffset: 2, bitWidth: 6 },
      defaultValue: 0,
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },

    // Byte 5 — proper roger dah length
    {
      id: 'cw_roger_dah_dits',
      label: 'CW Proper Roger Dah Length',
      description:
        'Length of the proper-roger dah in dits (CWrgr menu); 3 is a plain R. ' +
        'Range 3..20, default 9 (App/settings.h:93-95). Out-of-range or 0xFF ' +
        'reads as the default.',
      group: 'cw.keyer',
      type: { kind: 'int', min: 3, max: 20, unit: 'dits' },
      location: { kind: 'byte', offset: 5, size: 1 },
      defaultValue: 9,
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },

    // Byte 6 — unused, firmware keeps 0xFF. Deliberately unmodeled.

    // Byte 7 — break-in hang time
    {
      id: 'cw_hang_10ms',
      label: 'CW Break-in Hang Time',
      description:
        'Break-in hang time in 10 ms units. Range 1..200 (10 ms..2 s), ' +
        'default 30 (300 ms) (App/settings.h:102-104). Out-of-range or 0xFF ' +
        'reads as the default.',
      group: 'cw.keyer',
      type: { kind: 'int', min: 1, max: 200, unit: 'x10 ms' },
      location: { kind: 'byte', offset: 7, size: 1 },
      defaultValue: 30,
      applyMode: 'reload-settings',
      requires: ['ENABLE_CW_MODULATOR'],
    },
  ],
};
