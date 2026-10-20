export const FLOWRA_HEADLINE_LINES = ['Know your', 'information system'] as const;

export const FLOWRA_HEADLINE = FLOWRA_HEADLINE_LINES.join(' ');

export const FLOWRA_LEAD =
  'Flowra maps the applications in an information system and the flows between them.';

export const FLOWRA_MODES = [
  {
    title: 'Production',
    text: 'The shared cartography. What the organisation agrees is in the system.',
  },
  {
    title: 'Sandbox',
    text: 'A private copy. Rearrange it, then keep only what you decide to save.',
  },
  {
    title: 'My views',
    text: 'The diagrams you pin, filed so you can return to the same frame.',
  },
] as const;
