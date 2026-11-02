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

type ModuleSelectProps = {
  label: string;
  value: string;
  modules: ModuleOption[];
  disabled: boolean;
  onChange: (moduleId: string) => void;
};

function ModuleSelect({ label, value, modules, disabled, onChange }: ModuleSelectProps) {
  return (
    <select
      className="graph-drawer-input"
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {modules.map((module) => (
        <option key={module.id} value={module.id}>
          {module.name}
        </option>
      ))}
    </select>
  );
}

/** The lexicon, plus the object already on the link when the lexicon no longer holds it. */
function objectChoices(link: ModuleLink, businessObjects: string[]): string[] {
  const isKnown = !link.object || businessObjects.includes(link.object);
  return isKnown ? businessObjects : [...businessObjects, link.object];
}

/** Edit the explicit links: one row per "module feeds module through object". */
export function ModuleLinksEditor({ links, modules, businessObjects, disabled, onChange }: Props) {
  function updateLink(position: number, patch: Partial<ModuleLink>) {
    onChange(links.map((link, index) => (index === position ? { ...link, ...patch } : link)));
  }

  function addLink() {
    if (modules.length < 2) return;
    onChange([...links, { sourceId: modules[0].id, targetId: modules[1].id, object: '' }]);
  }

  return (
    <fieldset className="graph-drawer-field graph-drawer-fieldset">
      <legend className="graph-drawer-field-label">Links between modules</legend>
      {links.map((link, position) => (
        <div key={position} className="module-links-row">
          <ModuleSelect
            label="Module that feeds"
            value={link.sourceId}
            modules={modules}
            disabled={disabled}
            onChange={(sourceId) => updateLink(position, { sourceId })}
          />
          <span aria-hidden="true">→</span>
          <ModuleSelect
            label="Module fed"
            value={link.targetId}
            modules={modules}
            disabled={disabled}
            onChange={(targetId) => updateLink(position, { targetId })}
          />
          <select
            className="graph-drawer-input"
            aria-label="Business object exchanged"
            value={link.object}
            disabled={disabled}
            onChange={(event) => updateLink(position, { object: event.target.value })}
          >
            <option value="">{NO_OBJECT_LABEL}</option>
            {objectChoices(link, businessObjects).map((object) => (
              <option key={object} value={object}>
                {object}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="graph-drawer-action"
            aria-label="Remove link"
            disabled={disabled}
            onClick={() => onChange(links.filter((_link, index) => index !== position))}
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
