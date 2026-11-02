const tables = {};
const listeners = [];
let lang = localStorage.getItem('lang') || (navigator.language?.toLowerCase().startsWith('da') ? 'da' : 'en');

export async function loadLocales() {
  await Promise.all(['da', 'en'].map(async l => { tables[l] = await (await fetch(`locales/${l}.json`)).json(); }));
  applyDom();
}

export const t = k => tables[lang]?.[k] ?? tables.en?.[k] ?? k;
export const getLang = () => lang;
export const onLang = f => listeners.push(f);

export function setLang(l) {
  lang = l;
  localStorage.setItem('lang', l);
  applyDom();
  listeners.forEach(f => f(l));
}

function applyDom() {
  document.documentElement.lang = lang;
  document.title = `${t('title')} ${t('title_sub')} · RaMBio`;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
}
