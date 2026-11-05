export async function avvisa(tipo, messaggio, tag = {}) {
  console.error(`⚠️ avviso ${tipo}: ${String(messaggio).slice(0, 500)} ${JSON.stringify(tag)}`);
  return true;
}
