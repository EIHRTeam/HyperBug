import { reviewedPluginUI } from '../plugins.ts';

export function TrustedPluginSlot() {
  return reviewedPluginUI.map(({ id, component: Component }) => (
    <Component key={id} />
  ));
}
