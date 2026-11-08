import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { ThemeSwitch } from '../ui/ThemeSwitch';
import { Home } from './Home';
import { MapPage } from './MapPage';
import { SNAPSHOT } from './snapshot';

// Hash routes (#/m/slug) work on any static host without server rewrites.
export function App() {
  return (
    <>
      {!SNAPSHOT && <ThemeSwitch />}
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/">
            <Home />
          </Route>
          <Route path="/m/:slug">{(params) => <MapPage slug={params.slug} />}</Route>
          <Route>
            <Home />
          </Route>
        </Switch>
      </Router>
    </>
  );
}
