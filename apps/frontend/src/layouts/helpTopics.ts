export type HelpTopic = {
  title: string;
  text: string;
};

/** How each header destination is used. Contact stays a form, not a paragraph. */
export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    title: 'Cartography',
    text: 'The map of applications and the flows between them. Production is the shared cartography. Sandbox is a private copy you can rearrange. My views keeps the diagrams you pin.',
  },
  {
    title: 'Data Model',
    text: 'Declares the fields on applications and on flows. Those fields become the filters on the map and the attributes in an application details drawer.',
  },
  {
    title: 'Sources',
    text: 'Lists the GitHub repositories linked to this account and imports them into the map. Module and connection suggestions start from a repository here.',
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
