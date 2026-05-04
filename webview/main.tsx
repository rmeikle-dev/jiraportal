import { createRoot } from 'react-dom/client';
import { App } from './App';
import { FeatureRunsApp } from './FeatureRunsApp';

const root = document.getElementById('root');
if (root) {
  const which = root.getAttribute('data-app') ?? 'jiraBrowser';
  const tree =
    which === 'featureRuns' ? <FeatureRunsApp /> : <App />;
  createRoot(root).render(tree);
}
