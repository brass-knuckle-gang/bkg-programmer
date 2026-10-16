import type { Profile } from '../types';
import { nr7yCwSettingsV14 } from '../modules/index';
import { uvK1F4hwnNr7y } from './uv-k1-f4hwn-nr7y';

/**
 * UV-K1 / UV-K5 V3 running NR7Y v1.4 (briand/uv-k1-k5v3-firmware-custom).
 *
 * Identical to uv-k1-f4hwn-nr7y except for the 8-byte CW settings block
 * at virtual 0xA140, which v1.4 repacked (keyer mode + Farnsworth in
 * byte 4, roger dah in byte 5, hang time in byte 7, auto spacing in
 * byte 2 bit 5, sidetone stored as a code). Per the composition rule
 * (docs/03-schema.md), the base module list is reused verbatim and the
 * v1.4 block is appended last so it replaces the v1.0-v1.1 module by ID.
 *
 * Routed to by the `f4hwn-nr7y-v14` registry entry
 * (src/detection/registry.ts), which matches "NR7Y v1.4" / "v1.4.x".
 */
export const uvK1F4hwnNr7yV14: Profile = {
  id: 'uv-k1-f4hwn-nr7y-v14',
  displayName: 'UV-K1 / UV-K5 V3 with F4HWN Fusion (NR7Y fork) v1.4',
  appliesTo: {
    radioModels: ['uv-k1', 'uv-k5-v3'],
    firmwareFamily: 'f4hwn-nr7y',
    versionRange: '1.4.x',
  },
  eepromSize: uvK1F4hwnNr7y.eepromSize,
  modules: [
    ...uvK1F4hwnNr7y.modules,
    // Replaces the nr7y_cw_settings binding above (last-write-wins by
    // module ID). Same address; layout verified against v1.4
    // App/settings.c:416-444 (read) and :1148-1161 (write).
    { ...nr7yCwSettingsV14, baseOffset: 0xA140 },
  ],
  notes:
    uvK1F4hwnNr7y.notes +
    '\n\n' +
    'v1.4 CW block (nr7y-cw-settings-v14.ts) supersedes the v1.0-v1.1 ' +
    'layout described above: cw_key_wpm is 10..45; cw_keyer_mode (Iambic ' +
    'A/B, Ultimatic, Semi-Auto Bug) and cw_farnsworth_wpm share byte 4, ' +
    'which has no validity bit and is discarded wholesale unless Farnsworth ' +
    'is 0 or 5..44; cw_key_input_menu gains USB Port modes 8-10; ' +
    'cw_farnsworth_auto is byte 2 bit 5; cw_roger_dah_dits is byte 5; ' +
    'cw_hang_10ms is byte 7; cw_sidetone_code replaces cw_sidetone_level ' +
    'and stores a code from the App/settings.c:56-59 table. Version string ' +
    'derived from the v1.4 build config, not yet captured from a radio.',
};
