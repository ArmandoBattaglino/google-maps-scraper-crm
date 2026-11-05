// Cosa può finire nei log: mai email né numeri di telefono.
export function senzaContatti(testo) {
  return String(testo ?? "")
    .replace(/[^\s<>()"'`,;:@]+@[^\s<>()"'`,;:@]+\.[a-z]{2,}/gi, "[email]")
    .replace(/(?<![\w-])(?:\+|00)?\d(?:[\s.\-/]?\d){8,14}(?![\w-])/g, "[numero]");
}
