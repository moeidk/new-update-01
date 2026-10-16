/**
 * Unit tests for src/vault/schema.ts (the shared add/edit form definition).
 * Run: npm run test:vault
 * All data below is fictitious.
 */
import {
  toForm, fromForm, emptyForm, applyCategoryDefaults, validateForm, hasErrors, newlyHiddenValues,
  legacyViews, normalizeUrl, safeHref, validateCardNumber, validateExpiry, monthsUntilExpiry,
  validateSheba, wifiQrPayload, toLatinDigits, suggestTitle, maskCard, addressText, fieldsFor, isRequired,
} from '../src/vault/schema';
import type { VaultItem } from '../src/types';

let passed = 0;
let failed = 0;
function ok(name: string, cond: unknown, extra?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : '');
  }
}
const base = { isFavorite: false, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' };
const save = (state: ReturnType<typeof toForm>, original: VaultItem | null, initial = original ? toForm(original) : emptyForm(state.category), keep = true) =>
  fromForm(state, original, initial, keep) as VaultItem;

// ---------------------------------------------------------------- legacy bank card
const legacyBank: VaultItem = {
  ...base, id: 'b1', title: 'کارت تست', category: 'bank',
  cardNumber: '6037 9900 0000 0000', cardHolder: 'FAKE HOLDER', cvv2: '123', expireDate: '07/28', pin: '99999',
  username: 'fake-user', password: 'fake-pass', url: 'https://bank.example.com', notes: 'note', tags: ['t1'],
};
{
  const f = toForm(legacyBank);
  ok('bank: card number loaded', f.values.cardNumber === legacyBank.cardNumber);
  ok('bank: legacy expiry calendar unknown (no guessing)', f.values.expiryCalendar === '');
  const lv = legacyViews(f, legacyBank);
  const keys = lv.map((x) => x.key).sort();
  ok('bank: legacy username/password/url/pin shown under previous info', JSON.stringify(keys) === JSON.stringify(['top:password', 'top:pin', 'top:url', 'top:username']), keys);
  ok('bank: legacy pin marked secret', lv.find((x) => x.key === 'top:pin')?.secret === true);
  const issues = validateForm(f, legacyBank, f);
  ok('bank: unchanged legacy record has no blocking errors', !hasErrors(issues), issues);
  ok('bank: unknown calendar → warning', !!issues.expireDate?.warning);
  const out = save(f, legacyBank);
  ok('bank: edit w/o changes keeps every legacy value in place', out.pin === '99999' && out.username === 'fake-user' && out.password === 'fake-pass' && out.url === 'https://bank.example.com');
  ok('bank: card number untouched (formatting preserved)', out.cardNumber === legacyBank.cardNumber);
  ok('bank: expiry untouched, no conversion', out.expireDate === '07/28' && !out.extra?.expiryCalendar);
  ok('bank: notes & tags kept', out.notes === 'note' && out.tags?.[0] === 't1');
  // explicit removal of the old PIN
  const g = { ...f, legacyRemovals: ['top:pin'] };
  ok('bank: explicit removal deletes only that value', save(g, legacyBank).pin === undefined && save(g, legacyBank).username === 'fake-user');
  // new PIN goes to its own slot, not the old combined field
  const h = { ...f, values: { ...f.values, cardPin: '۱۲۳۴' } };
  const outH = save(h, legacyBank);
  ok('bank: new PIN stored separately & digits normalized', outH.extra?.cardPin === '1234' && outH.pin === '99999');
}

// ---------------------------------------------------------------- category change: no silent loss, no misattribution
const legacyEmail: VaultItem = { ...base, id: 'e1', title: 'mail', category: 'email', username: 'someone@example.com', password: 'P@ss-fake', url: 'mail.example.com' };
{
  const f = toForm(legacyEmail);
  ok('email: address loaded from legacy username', f.values.emailAddress === 'someone@example.com');
  const switched = applyCategoryDefaults(f, 'wifi');
  ok('switch email→wifi: email address NOT shown as SSID', switched.values.ssid === '');
  ok('switch email→wifi: password not reused as wifi password', switched.values.wifiPassword === '');
  const hiddenNew = newlyHiddenValues(switched, f);
  ok('switch: values stored before are not "new" (no prompt needed)', hiddenNew.length === 0, hiddenNew);
  switched.values.ssid = 'Home Net ';
  switched.values.wifiPassword = 'Wifi Pass 1';
  const out = save(switched, legacyEmail);
  ok('switch: ssid stored exactly (trailing space kept)', out.username === 'Home Net ');
  ok('switch: wifi password exact', out.password === 'Wifi Pass 1');
  const labels = (out.legacy || []).map((e) => e.label).join(' | ');
  ok('switch: old email address kept as legacy entry', (out.legacy || []).some((e) => e.value === 'someone@example.com'), labels);
  ok('switch: old password kept as secret legacy entry', (out.legacy || []).some((e) => e.value === 'P@ss-fake' && e.secret));
  ok('switch: old webmail kept', (out.legacy || []).some((e) => e.value === 'mail.example.com'));
  // switching back does NOT silently reassign legacy entries
  const back = applyCategoryDefaults(toForm(out), 'email');
  ok('switch back: legacy not re-attributed to email address', back.values.emailAddress === '');
}
{
  // values typed in this session then hidden by a category switch → must be confirmed
  const f = emptyForm('login');
  f.title = 'x';
  f.values.identifier = 'typed-id';
  f.values.password = 'typed-pass';
  const g = applyCategoryDefaults(f, 'note');
  g.values.notes = 'body';
  const pending = newlyHiddenValues(g, emptyForm('login'));
  ok('typed then hidden → listed for confirmation', pending.map((p) => p.id).sort().join() === 'identifier,password', pending);
  const discard = save(g, null, emptyForm('login'), false);
  ok('discard: hidden typed values dropped', !discard.username && !discard.password && !(discard.legacy || []).length);
  const keep = save(g, null, emptyForm('login'), true);
  ok('keep: hidden typed values kept in legacy, not top-level', !keep.username && (keep.legacy || []).length === 2);
}

// ---------------------------------------------------------------- login: conditional password
{
  const f = emptyForm('login');
  f.title = 'acc';
  f.values.identifier = 'me@example.com';
  f.values.loginMethod = 'sso';
  const issues = validateForm(f, null, null);
  ok('login sso: password not required', !issues.password && !hasErrors(issues), issues);
  f.values.loginMethod = 'password';
  ok('login password method: password required', !!validateForm(f, null, null).password?.error);
  f.values.password = '123';
  ok('weak password allowed (no error)', !validateForm(f, null, null).password?.error);
  f.values.loginUrls = 'example.com/login\njavascript:alert(1)';
  ok('unsafe URL rejected', !!validateForm(f, null, null).loginUrls?.error);
  f.values.loginUrls = 'example.com/login\nhttps://m.example.com';
  const out = save(f, null);
  ok('multiple URLs: first in url, rest in urls, normalized', out.url === 'https://example.com/login' && out.urls?.[0] === 'https://m.example.com/', out);
  ok('formVersion set', out.formVersion === 2);
  ok('hidden default select (sso provider) not stored', out.extra?.ssoProvider === undefined, out.extra);
}

// ---------------------------------------------------------------- legacy login with sso switch keeps stored password
{
  const legacyLogin: VaultItem = { ...base, id: 'l1', title: 'old', category: 'login', username: 'u', password: 'stored-pass' };
  const f = toForm(legacyLogin);
  ok('legacy login: method defaults to password', f.values.loginMethod === 'password');
  f.values.loginMethod = 'sso';
  ok('stored password not counted as newly hidden', newlyHiddenValues(f, toForm(legacyLogin)).length === 0);
  const out = save(f, legacyLogin);
  ok('switch to sso: stored password kept (same meaning, same place)', out.password === 'stored-pass');
  ok('hidden stored password visible in previous/hidden info', legacyViews(toForm(out), out).some((x) => x.key === 'field:password'));
}

// ---------------------------------------------------------------- wifi
{
  const f = emptyForm('wifi');
  f.title = 'w';
  f.values.ssid = 'Café Net';
  f.values.wifiSecurity = 'open';
  ok('wifi open: password not required', !hasErrors(validateForm(f, null, null)));
  const out = save(f, null);
  const qr = wifiQrPayload(out);
  ok('wifi open: QR nopass', 'payload' in qr && qr.payload === 'WIFI:T:nopass;S:Café Net;;');
  f.values.wifiSecurity = 'enterprise';
  f.values.eapMethod = 'TLS';
  const iss = validateForm(f, null, null);
  ok('wifi enterprise TLS: identity required, password not', !!iss.wifiIdentity?.error && !iss.wifiPassword);
  f.values.eapMethod = 'PEAP';
  ok('wifi enterprise PEAP: password required', !!validateForm(f, null, null).wifiPassword?.error);
  const ent = save({ ...f, values: { ...f.values, wifiIdentity: 'id', wifiPassword: 'p' } }, null);
  ok('wifi enterprise: no QR', 'unsupported' in wifiQrPayload(ent));
  const per = save({ ...emptyForm('wifi'), title: 'p', values: { ...emptyForm('wifi').values, ssid: 'a;b', wifiPassword: 'p:w"1', wifiHidden: 'true' } }, null);
  const q2 = wifiQrPayload(per);
  ok('wifi QR escapes ; : " and sets hidden', 'payload' in q2 && q2.payload === 'WIFI:T:WPA;S:a\\;b;P:p\\:w\\"1;H:true;;', q2);
  ok('wifi password: Persian digits NOT converted', save({ ...emptyForm('wifi'), title: 't', values: { ...emptyForm('wifi').values, ssid: 's', wifiPassword: 'رمز۱۲۳' } }, null).password === 'رمز۱۲۳');
}

// ---------------------------------------------------------------- note
{
  const f = emptyForm('note');
  f.title = 'n';
  ok('note: body required', !!validateForm(f, null, null).notes?.error);
  ok('note: no username/password/url fields', !fieldsFor('note').some((x) => ['identifier', 'password', 'loginUrls'].includes(x.id)));
}

// ---------------------------------------------------------------- address
{
  const f = emptyForm('address');
  f.title = 'home';
  f.values.fullAddress = 'Fake street 1';
  ok('address: country default Iran, full address enough', !hasErrors(validateForm(f, null, null)));
  f.values.postalCode = '123';
  ok('address Iran: postal code must be 10 digits', !!validateForm(f, null, null).postalCode?.error);
  f.values.country = 'Germany';
  ok('address other country: postal code rule relaxed', !validateForm(f, null, null).postalCode?.error);
  f.values.postalCode = '';
  f.values.contactPhone = '+49 30 000000';
  ok('address other country: no Iranian phone rule', !validateForm(f, null, null).contactPhone);
  const out = save({ ...f, values: { ...f.values, recipientName: 'Fake Name', city: 'Berlin' } }, null);
  ok('address copy text w/o contact', !addressText(out, false).includes('Fake Name'));
  ok('address copy text with contact', addressText(out, true).includes('Fake Name'));
}

// ---------------------------------------------------------------- card / expiry / sheba / urls / digits
ok('card ir: 16 digits + luhn ok', validateCardNumber('4111 1111 1111 1111', 'ir') === undefined);
ok('card ir: 15 digits error', !!validateCardNumber('603799000000000', 'ir')?.error);
ok('card intl: 15 digits accepted (Amex length)', !validateCardNumber('378282246310005', 'intl')?.error);
ok('card luhn failure → warning only', !!validateCardNumber('4111111111111112', 'intl')?.warning);
ok('card persian digits accepted', !validateCardNumber('۴۱۱۱۱۱۱۱۱۱۱۱۱۱۱۱', 'intl'));
ok('mask card', maskCard('4111111111111111') === '•••• •••• •••• 1111');
ok('expiry jalali YY/MM', !validateExpiry('07/05', 'jalali'));
ok('expiry gregorian MM/YY', !validateExpiry('05/28', 'gregorian'));
ok('expiry gregorian 13/28 invalid', !!validateExpiry('13/28', 'gregorian')?.error);
ok('expiry months', monthsUntilExpiry('1405/09', 'jalali', { jy: 1405, jm: 7, gy: 2026, gm: 10 }) === 2);
ok('sheba invalid format', !!validateSheba('IR12')?.error);
ok('sheba valid checksum', !validateSheba('IR062960000000100324200001'));
ok('url javascript blocked', normalizeUrl('javascript:alert(1)') === null && safeHref('JavaScript:alert(1)') === null);
ok('url data blocked', safeHref('data:text/html,x') === null);
ok('url scheme-less normalized', normalizeUrl('example.com') === 'https://example.com/');
ok('digits', toLatinDigits('۱۲۳٤٥') === '12345');
ok('title suggestion bank', suggestTitle({ ...emptyForm('bank'), values: { ...emptyForm('bank').values, issuer: 'ملت', cardNumber: '6104330000001234' } }) === 'کارت ملت — 1234');
ok('email required unless login username given', isRequired(fieldsFor('email').find((x) => x.id === 'emailAddress')!, { emailLoginUsername: 'x' }) === false);

// ---------------------------------------------------------------- custom fields
{
  const f = emptyForm('login');
  f.title = 'c';
  f.values.loginMethod = 'otp';
  f.customFields = [{ id: 'cf1', label: 'سؤال امنیتی', type: 'secret', value: 'answer' }, { id: 'cf2', label: 'لینک', type: 'url', value: 'javascript:x' }];
  ok('custom url validated', !!validateForm(f, null, null)['custom:cf2']?.error);
  f.customFields[1].value = 'example.org';
  const out = save(f, null);
  ok('custom fields saved, url normalized', out.customFields?.length === 2 && out.customFields[1].value === 'https://example.org/');
  const again = toForm(out);
  ok('custom fields round-trip', again.customFields[0].type === 'secret' && again.customFields[0].value === 'answer');
}

// ---------------------------------------------------------------- unknown fields preserved
{
  const weird = { ...base, id: 'z', title: 'z', category: 'login', username: 'a', futureField: 'keep-me' } as unknown as VaultItem;
  const out = save(toForm(weird), weird) as unknown as Record<string, unknown>;
  ok('unknown future fields preserved', out.futureField === 'keep-me');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
