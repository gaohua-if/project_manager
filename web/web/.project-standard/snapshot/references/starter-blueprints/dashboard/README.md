# Dashboard Pattern

Copy this complete pattern into the business feature, then adapt data and labels.

## Stable visual layer

Keep these files together:

- `dashboard-components.tsx`: metric, chart, and grid components.
- `dashboard-pattern.css`: gradients, shadows, states, spacing, and responsive layout.

Do not replace the stable components with plain page-local `div` or raw `Card` implementations unless the product explicitly provides a different design system.
Metric cards use a non-interactive semantic icon at the top right. Keep the icon outside API data, pass it through the component's `icon` prop, and select its visual `tone` in the page mapping. Do not restore decorative status dots.

## Business layer

Use `dashboard-page.tsx` as the assembly example. Replace:

- query hooks and API fields;
- metric labels, values, descriptions, trends, and statuses;
- semantic metric icons and tones;
- chart content and business-specific filters.

Preserve loading, empty, error, and responsive behavior. A supplied visual design is a product contract: retain its hierarchy, color accents, card treatment, and density while mapping it to these components.
