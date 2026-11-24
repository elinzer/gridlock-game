export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const BLOCKED = [
  'ASS', 'AZZ', 'BCH', 'BJS', 'BUM', 'CNT', 'COC', 'COK', 'CUM', 'CUN', 'DIC', 'DIK', 'DCK',
  'DMN', 'FAG', 'FCK', 'FKU', 'FUC', 'FUK', 'FUQ', 'FUX', 'HOE', 'JIZ',
  'KKK', 'KYS', 'NAZ', 'NGR', 'NIG', 'NIP', 'PIS', 'PNS', 'PUS', 'SEX', 'SHT', 'SLT',
  'SUK', 'TIT', 'TWT', 'VAG', 'WTF', 'XXX', 'FAP', 'KIL', 'RAP',
];
const BLOCKED_SET = new Set(BLOCKED);

export function isBlocked(initials) {
  return BLOCKED_SET.has(String(initials).toUpperCase());
}
