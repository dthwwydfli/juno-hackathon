import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import App from './App';
import { StoreProvider } from './data/store';
import { applyThemeToDocument, readStoredTheme, ThemeProvider } from './lib/theme';
// Self-hosted, not the Google CDN: the app is an offline-capable PWA and a
// CDN font would fail to render on a cold offline start.
// Explicit .css path: the bare specifier makes tsc try to resolve the package
// as a TS project. unicode-range in index.css means only the latin subset is
// actually downloaded.
import '@fontsource-variable/lexend/index.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/texture.css';
import './styles/motion.css';

applyThemeToDocument(readStoredTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The CSS reduced-motion guard in base.css cannot reach Motion, which
        writes inline styles from JS. Without this, a reduce-motion user would
        get a still CSS layer and a fully animated JS layer. "user" keeps
        opacity and colour animating while dropping transforms — the WCAG
        intent — and deliberately leaves drag interactive, since direct
        manipulation is exempt. */}
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <StoreProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </StoreProvider>
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
