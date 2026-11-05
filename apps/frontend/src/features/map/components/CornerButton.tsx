import type { ButtonHTMLAttributes } from 'react';

/** A button in the page's top corner: same height, radius and shadow as every other corner control. */
export function CornerButton({ className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={['corner-control', className].filter(Boolean).join(' ')} {...rest} />;
}
