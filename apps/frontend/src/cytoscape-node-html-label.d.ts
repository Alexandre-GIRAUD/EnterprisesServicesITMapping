declare module 'cytoscape-node-html-label' {
  import type cytoscape from 'cytoscape';

  export default function registerNodeHtmlLabel(cy: typeof cytoscape): void;
}
