import type { ApplicationModel, ModuleLink } from '../utils/moduleDetails';
import { DataChips } from './ModuleCard';

type ModuleOption = { id: string; name: string };

type Props = {
  model: ApplicationModel;
  links: ModuleLink[];
  modules: ModuleOption[];
  /** What crosses the application border, derived from the modules. */
  externalInputs: string[];
  externalOutputs: string[];
};

const NO_TEXT = 'Not described yet.';
const NO_OBJECT_TEXT = 'No business object yet.';
const NO_LINK_TEXT = 'No link between modules yet.';

function linkLabel(link: ModuleLink, modules: ModuleOption[]): string {
  const nameOf = (moduleId: string) =>
    modules.find((module) => module.id === moduleId)?.name ?? moduleId;
  return `${nameOf(link.sourceId)} → ${nameOf(link.targetId)}${link.object ? ` (${link.object})` : ''}`;
}

/** Read view of the application level: scope, workflows, lexicon, links and border crossings. */
export function ApplicationModelView({
  model,
  links,
  modules,
  externalInputs,
  externalOutputs,
}: Props) {
  return (
    <>
      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Scope</h3>
        <p className="graph-details-text">{model.scope || NO_TEXT}</p>
      </section>
      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Workflows</h3>
        <p className="graph-details-text">{model.mainJourney || NO_TEXT}</p>
      </section>
      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Business objects</h3>
        {model.businessObjects.length === 0 ? (
          <p className="graph-details-text">{NO_OBJECT_TEXT}</p>
        ) : (
          <DataChips items={model.businessObjects} />
        )}
      </section>
      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Links between modules</h3>
        {links.length === 0 ? (
          <p className="graph-details-text">{NO_LINK_TEXT}</p>
        ) : (
          <ul className="module-drawer-links">
            {links.map((link) => (
              <li key={`${link.sourceId}-${link.targetId}-${link.object}`} className="graph-details-text">
                {linkLabel(link, modules)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="graph-details-section">
        <h3 className="graph-details-section-title">Crossing the application border</h3>
        <p className="graph-drawer-field-label">Inputs</p>
        <DataChips items={externalInputs} />
        <p className="graph-drawer-field-label">Outputs</p>
        <DataChips items={externalOutputs} />
      </section>
    </>
  );
}
