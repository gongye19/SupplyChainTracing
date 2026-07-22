# SemiconFlow product design system

## Product character

SemiconFlow is a professional semiconductor trade-data workspace. It should feel precise, calm, dense, and trustworthy. Data is the visual protagonist; interface chrome exists only to help users search, filter, compare, and research.

## Information architecture

- Use one persistent top application bar.
- Primary destinations are Overview, Explore, Companies, and Research.
- Country and product analysis are dimensions inside Explore, not separate primary destinations.
- Never add a second permanent sidebar. Advanced filters use a temporary drawer.
- Quick Answer is opened from Search / Ask. Long-running Insight Factory work lives in Research.

## Color roles

- Canvas: `#f7f7f8`
- Surface: `#ffffff`
- Primary ink: `#171717`
- Muted ink: `#6b6b6f`
- Hairline: `#e5e5e7`
- Strong hairline: `#d7d7da`
- Accent: `#1456d9`
- Success: `#16845b`

Use the accent only for selected state, focus, links, and data emphasis. Use semantic red, amber, and green only for genuine status meaning. Do not use gradients or decorative color glows.

## Typography

- Interface: Geist Sans, with Inter and system sans fallbacks.
- Data tokens: Geist Mono, with SF Mono and Consolas fallbacks.
- Page title: 27–36px, weight 620, tight tracking.
- Section title: 16–20px, weight 600.
- Body and table cells: 13–14px, weight 400–500.
- Caption and metadata: 10–12px.
- Use sentence case. Reserve uppercase for short taxonomy labels.

## Spacing and layout

- Base unit: 4px.
- Control heights: 32–36px.
- Application bar: 58px.
- Page gutter: 36px desktop, 20px tablet, 12px mobile.
- Page content maximum: 1560px.
- Keep charts and tables broad. Do not constrain data into narrow decorative cards.

## Shape and elevation

- Small controls: 6px radius.
- Panels: 8px radius.
- Large dialogs: at most 10–12px radius.
- Pills are reserved for compact status values, not general buttons.
- Default panels use a 1px hairline and no shadow.
- Shadows are limited to drawers, menus, and dialogs that actually float.

## Components

### Navigation

One top application bar contains brand, primary navigation, Search / Ask, data status, and language. On mobile, primary navigation collapses into a temporary dropdown.

### Filter bar

Show the current period, direction, and primary scope inline. `All filters` opens the complete existing filter set in a temporary drawer. The data canvas must never be permanently narrowed by filters.

### Data panels

Charts, maps, rankings, and tables sit on white surfaces with hairline borders. Titles are compact and left aligned. Data numbers and identifiers use the mono family.

### Research

Quick Answer and Deep Research are visibly different modes. Long-running jobs must state that they can take considerable time and must never be triggered by a normal dashboard interaction.

## Motion

- Use 120–180ms transitions for navigation, drawers, view changes, and hover feedback.
- Use skeletons or compact spinners for loading.
- Honor reduced-motion preferences.
- Do not use spotlight effects, parallax, animated backgrounds, cursor effects, or large entrance choreography.

## Responsive behavior

- Below 900px, navigation becomes a temporary dropdown and Search / Ask becomes an icon button.
- Filters remain horizontally scrollable; advanced filters become a full-width drawer on small screens.
- Data visualizations preserve their functional minimum width and may scroll when collapsing would destroy readability.

## Do

- Lead with the user's current data question and analysis context.
- Prefer a table, chart, or map to a decorative card.
- Keep filtering and navigation close to the data they affect.
- Preserve functional color meaning and consistent density.

## Don't

- Do not add permanent left or right sidebars.
- Do not duplicate navigation at multiple levels.
- Do not add floating chat launchers.
- Do not use 20–28px card radii, glassmorphism, gradients, spotlight cards, or heavy shadows.
- Do not split the same exploration workflow into several unrelated dashboard pages.
