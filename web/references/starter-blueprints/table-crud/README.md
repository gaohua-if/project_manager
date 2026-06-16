# Table CRUD Pattern

Copy the list page and `list-pattern.css` together, then adapt fields, queries, routes, and labels.

## Styling layers

- `TableLayout` provides shared structure and neutral defaults.
- `list-pattern.css` provides the page-pattern treatment for primary business lists.
- Feature CSS may extend the pattern for real product needs, but must not accidentally fall back to plain shared defaults.

## Visual review

Compare only the scoped selector and the relevant property groups:

- `surface`: complete background layers, border, radius, and shadow;
- `spacing`: padding, margin, and gap;
- `control`: height, width, border, and radius;
- `responsive`: matching media or container rules.

For a toolbar issue, compare the current page-level `.table-layout__toolbar` override with the selector in `list-pattern.css`. Do not scan the whole snapshot and do not treat a partial gradient match as evidence that the complete surface matches.

Before changing visual styles, identify both the current feature selector and this closest locked page-pattern selector. Shared `TableLayout.css` defaults are not sufficient evidence when this package defines an override.
