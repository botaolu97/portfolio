import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { ThemeSwitch } from '../ui/ThemeSwitch';
import { MapList } from './MapList';
import { MapPage } from './MapPage';

// Hash routes (#/m/slug) work on any static host without server rewrites.
export function App() {
  return (
    <>
      <ThemeSwitch />
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/">
            <MapList />
          </Route>
          <Route path="/m/:slug">{(params) => <MapPage slug={params.slug} />}</Route>
          <Route>
            <MapList />
          </Route>
        </Switch>
      </Router>
    </>
  );
}
