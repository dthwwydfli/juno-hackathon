import type { IconName } from './Icon';

/** The medication tile glyph follows the route of administration:
 *  Oral → pill, Inhaled → inhaler, Injection → syringe, Topical → tube, etc. */
const routeIconName: Record<string, IconName> = {
  Oral: 'capsule',
  Sublingual: 'tablet',
  Topical: 'liquid',
  Inhaled: 'inhaler',
  Injection: 'injection',
  Other: 'pill',
};

export function iconForRoute(route?: string): IconName {
  return (route && routeIconName[route]) || 'capsule';
}
