export type HelpTopic = {
  title: string;
  text: string;
};

/** How each header destination is used. Contact stays a form, not a paragraph. */
export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    title: 'Cartography',
    text:
      'The map of applications and the flows between them. Production is the shared cartography. Sandbox is a private copy you can rearrange. My views keeps the diagrams you pin.\n\n' +
      'Production. Tip: double-click an application to open its module graph. Single-click for details.\n\n' +
      'Filters. Narrow the graph. Each dimension combines with AND (all conditions must match).\n\n' +
      'My views. Saved views (filters, hidden apps, layout). Select a view to apply it to the graph.\n\n' +
      'Sandbox. Sandbox — customize your graph, no changes saved.',
  },
  {
    title: 'Data Model',
    text: 'Declares the fields on applications and on flows. Those fields become the filters on the map and the attributes in an application details drawer.',
  },
  {
    title: 'Sources',
    text: 'Lists the GitHub repositories linked to this account and imports them into the map. Suggest modules and Scan connections and attributes start from a repository here.',
  },
  {
    title: 'Changes',
    text: 'Reviews GitHub suggestions and writes that a human override blocked, before they join the shared cartography.',
  },
  {
    title: 'Settings',
    text: 'Holds the GitHub connection for this account. An administrator also creates accounts from here.',
  },
];
