import { useState, type FormEvent } from 'react';
import { importThirdPartyFile, importThirdPartyText } from '../api/applicationsApi';

type ThirdPartySourcesProps = {
  onChanged: () => Promise<void>;
};

export function ThirdPartySources({ onChanged }: ThirdPartySourcesProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function onImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setBusy(true);
    try {
      if (file) {
        await importThirdPartyFile(name.trim(), description, title, file);
      } else {
        await importThirdPartyText({
          name: name.trim(),
          description,
          title,
          body,
        });
      }
      setName('');
      setDescription('');
      setTitle('');
      setBody('');
      setFile(null);
      setFormKey((key) => key + 1);
      await onChanged();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to import.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form
        key={formKey}
        className="github-import-third-party-form"
        onSubmit={(event) => void onImport(event)}
      >
        <label className="github-import-search-label">
          <span className="github-import-search-span">Name</span>
          <input
            className="github-import-search-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            aria-label="Third-party name"
          />
        </label>
        <label className="github-import-search-label">
          <span className="github-import-search-span">Description</span>
          <input
            className="github-import-search-input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-label="Third-party description"
          />
        </label>
        <label className="github-import-search-label">
          <span className="github-import-search-span">Document title</span>
          <input
            className="github-import-search-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Defaults to the file name"
            aria-label="Document title"
          />
        </label>
        <label className="github-import-search-label">
          <span className="github-import-search-span">Document text</span>
          <textarea
            className="github-import-search-input"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            aria-label="Document text"
          />
        </label>
        <label className="github-import-search-label">
          <span className="github-import-search-span">Or upload .txt, .md, or .pdf</span>
          <input
            className="github-import-search-input"
            type="file"
            accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
            aria-label="Third-party document"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="submit"
          className="github-import-primary"
          disabled={busy || name.trim().length === 0 || (!file && body.trim().length === 0)}
        >
          {busy ? 'Importing…' : 'Import third party'}
        </button>
      </form>
      {errorMessage ? (
        <p className="github-import-state github-import-state-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
