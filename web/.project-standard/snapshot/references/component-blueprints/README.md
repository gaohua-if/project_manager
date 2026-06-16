# Component Blueprints

These files are reference blueprints for AI agents.

They are not runtime features, are not registered in routes, and should not be imported by business code. Copy the usage pattern, not the mock labels.

## Relationship To Runtime Components

- `src/shared/components/*` is the source of truth for component implementation.
- `src/features/component-gallery` is an executable visual gallery when runtime examples are kept.
- `references/component-blueprints/*` is a stable usage reference for agents when runtime examples are removed.

Do not duplicate shared component implementation here. Keep these files small and focused on correct usage.

## Agent Usage

Before generating business pages:

1. Read the matching page blueprint in `references/starter-blueprints`.
2. Read the relevant component usage file in this directory.
3. Use shared components from `src/shared/components`.
4. Do not register `references/component-blueprints` in runtime routes.

## Available References

- `basic-controls.tsx`: Input, Search, Password, InputNumber, Select, DatePicker, Checkbox, Radio, Switch, Slider, Upload, and colorful business tags.
- `table-controls.tsx`: `TableLayout`, `ResourceTable`, `ResourceActions`, status tags, date formatting, and no-scroll table boundaries.
- `feedback-display.tsx`: Alert, Empty, Skeleton, Progress, confirm danger modal, log viewer, and detail fields.
- `form-patterns.tsx`: special left/right configuration usage with `PagePanel`, `FormPageWrap`, `FormSubmitButton`, `TwoColumnFormLayout`, and `ParameterListField`. Use the Table CRUD form blueprint for ordinary flat resource forms.
