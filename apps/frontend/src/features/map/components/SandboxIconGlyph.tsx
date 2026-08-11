import {
  sandboxCurrencyGlyph,
  sandboxFlagImageUrl,
  sandboxFlagIso,
  sandboxItGlyph,
  splitSandboxIconKey,
} from '../utils/sandboxDocuments';

/** Renders a palette/placed/ghost icon; supports man|dot, flag:ISO, currency/it codes. */
export function SandboxIconGlyph({ iconKey }: { iconKey: string }) {
  const flagIso = sandboxFlagIso(iconKey);
  if (flagIso) {
    return (
      <img
        className="sandbox-icon-glyph sandbox-icon-glyph--flag"
        src={sandboxFlagImageUrl(flagIso)}
        alt=""
        draggable={false}
      />
    );
  }

  const itGlyph = sandboxItGlyph(iconKey);
  if (itGlyph) {
    return (
      <span className="sandbox-icon-glyph sandbox-icon-glyph--it" aria-hidden="true">
        {itGlyph}
      </span>
    );
  }

  const currencyGlyph = sandboxCurrencyGlyph(iconKey);
  if (currencyGlyph) {
    return (
      <span className="sandbox-icon-glyph sandbox-icon-glyph--currency" aria-hidden="true">
        {currencyGlyph}
      </span>
    );
  }

  const parts = splitSandboxIconKey(iconKey);
  if (parts) {
    return (
      <span className="sandbox-icon-glyph sandbox-icon-glyph--combo" aria-hidden="true">
        <span className="sandbox-icon-glyph__man">{parts[0]}</span>
        <span className="sandbox-icon-glyph__dot">{parts[1]}</span>
      </span>
    );
  }

  return (
    <span className="sandbox-icon-glyph" aria-hidden="true">
      {iconKey}
    </span>
  );
}
