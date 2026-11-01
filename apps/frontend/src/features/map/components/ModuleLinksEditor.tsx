import type { ModuleLink } from '../utils/moduleDetails';

type ModuleOption = { id: string; name: string };

type Props = {
  links: ModuleLink[];
  modules: ModuleOption[];
  /** Lexicon of business objects a link can carry. */
  businessObjects: string[];
  disabled: boolean;
  onChange: (links: ModuleLink[]) => void;
};

const NO_OBJECT_LABEL = 'No object';

/** Edit the explicit links: one row per "module feeds module through object". */
export function ModuleLinksEditor({ links, modules, businessObjects, disabled, onChange }: Props) {
  function updateLink(index: number, patch: Partial<ModuleLink>) {
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  }

  function addLink() {
    if (modules.length < 2) return;
    onChange([...links, { sourceId: modules[0].id, targetId: modules[1].id, object: '' }]);
  }

  return (
    <fieldset className="graph-drawer-field graph-drawer-fieldset">
      <legend className="graph-drawer-field-label">Links between modules</legend>
      {links.map((link, index) => (
        <div key={index} className="module-links-row">
          <select
            className="graph-drawer-input"
            aria-label="Module that feeds"
            value={link.sourceId}
            disabled={disabled}
            onChange={(event) => updateLink(index, { sourceId: event.target.value })}
          >
            {modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.name}
              </option>
            ))}
          </select>
          <span aria-hidden="true">→</span>
          <select
            className="graph-drawer-input"
            aria-label="Module fed"
            value={link.targetId}
            disabled={disabled}
            onChange={(event) => updateLink(index, { targetId: event.target.value })}
          >
            {modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.name}
              </option>
            ))}
          </select>
          <select
            className="graph-drawer-input"
            aria-label="Business object exchanged"
            value={link.object}
            disabled={disabled}
            onChange={(event) => updateLink(index, { object: event.target.value })}
          >
            <option value="">{NO_OBJECT_LABEL}</option>
            {[...businessObjects, ...(businessObjects.includes(link.object) || !link.object ? [] : [link.object])].map(
              (object) => (
                <option key={object} value={object}>
                  {object}
                </option>
              )
            )}
          </select>
          <button
            type="button"
            className="graph-drawer-action"
            aria-label="Remove link"
            disabled={disabled}
            onClick={() => onChange(links.filter((_, i) => i !== index))}
          >
            <span className="graph-drawer-action-title">Remove</span>
          </button>
        </div>
      ))}
      <button
        type="button"
        className="graph-drawer-action"
        disabled={disabled || modules.length < 2}
        onClick={addLink}
      >
        <span className="graph-drawer-action-title">Add a link</span>
      </button>
    </fieldset>
  );
}
