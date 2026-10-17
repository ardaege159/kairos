---
name: Kairos Financial
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#464554'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#8127cf'
  on-secondary: '#ffffff'
  secondary-container: '#9c48ea'
  on-secondary-container: '#fffbff'
  tertiary: '#006c49'
  on-tertiary: '#ffffff'
  tertiary-container: '#00885d'
  on-tertiary-container: '#000703'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#f0dbff'
  secondary-fixed-dim: '#ddb7ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#6900b3'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 20px
  card-gap: 16px
  section-margin: 40px
---

## Brand & Style

The design system is engineered for a high-end fintech experience that balances institutional authority with cutting-edge technological sophistication. The brand personality is precise, visionary, and calm. It targets high-net-worth individuals and financial analysts who require clarity amidst complexity.

The visual direction utilizes a **Refined Glassmorphism** style. It focuses on multi-layered depth, using frosted translucency to simulate physical glass panes. Unlike heavy skeuomorphism, this approach remains airy and light, emphasizing "data as light." The interface should feel like a premium command center—professional enough for banking, but modern enough to feel like the future of finance.

## Colors

The palette is anchored in a professional "Light Mode" foundation with high-vibrancy accents. 

- **Primary & Secondary:** A gradient bridge between Vibrant Blue and Deep Purple creates the "power" brand color used for primary actions and key data visualizations.
- **Positive Indicators:** A soft Emerald Green is reserved strictly for growth, profit, and successful completions, providing a calming psychological cue.
- **Surface Colors:** Surfaces are not solid white; they are semi-transparent white (rgba 255, 255, 255, 0.7) with a backdrop blur to create the frosted effect.
- **Typography Colors:** Use deep navy-grays for text to maintain high legibility against the translucent backgrounds. Avoid pure black.

## Typography

The typography system uses **Geist** for its mathematical precision and clean, neutral architecture. 

- **Numerical Data:** Financial figures must use the `data-mono` role, which utilizes tabular figures (`tnum`) to ensure columns of numbers align perfectly in tables and dashboards.
- **Hierarchy:** Use weight (SemiBold/Bold) rather than size increases for dashboard headers to maintain a compact, information-dense layout.
- **Mobile Scaling:** For mobile devices, `headline-lg` should scale down to 24px to prevent excessive wrapping in small card components.

## Layout & Spacing

The layout utilizes a **Fluid Grid** system with fixed-width margins on large displays to ensure readability.

- **Grid:** A 12-column grid for desktop, 8-column for tablet, and 4-column for mobile. 
- **Rhythm:** An 8px linear scale (4, 8, 16, 24, 32, 48, 64) is used for all padding and margins.
- **Density:** The dashboard is high-density. Information is grouped into logical "Glass Containers." Spacing between internal card elements should be tight (8px or 12px) to maximize the visible data above the fold.
- **Breakpoints:** 
  - Desktop: 1440px+
  - Tablet: 768px - 1439px
  - Mobile: Under 768px

## Elevation & Depth

Depth is the defining characteristic of this design system, achieved through **Glassmorphism** and **Ambient Shadows**.

1.  **The Base:** The background is a soft, subtle gradient.
2.  **Layer 1 (The Canvas):** Large content areas use a very high backdrop blur (30px) and a low-opacity white fill (10%). They feature a 1px inner border (white, 20% opacity) to simulate a glass edge.
3.  **Layer 2 (The Cards):** Interactive cards use a medium backdrop blur (20px) and a slightly higher opacity fill (40%). They cast a "Long Soft Shadow"—a very diffused purple-tinted shadow (Offset: 0 10px, Blur: 30px, Color: rgba(99, 102, 241, 0.08)).
4.  **Layer 3 (Popovers/Modals):** Floating elements use the highest opacity and sharpest shadows to signify they are closest to the user.

## Shapes

The shape language is **Rounded (0.5rem / 8px base)**. 

- **Primary Cards:** Use `rounded-xl` (24px) to create a friendly, modern container feel.
- **Small Elements:** Buttons and input fields use `rounded-md` (8px) for a more precise, tool-like appearance.
- **Status Pills:** Chips and status indicators use `pill-shaped` (100px) to distinguish them clearly from interactive buttons.
- **Connectors:** Lines in charts and data paths should use soft curves (4px radius) rather than sharp angles.

## Components

### Buttons
- **Primary:** Solid gradient (Vibrant Blue to Deep Purple) with a white label. 
- **Secondary (Glass):** Frosted background with a primary-colored border and text. 
- **Interaction:** On hover, the backdrop blur increases and the shadow deepens.

### Frosted Cards
The core container. Must include a 1px "Light Leak" border on the top and left sides (white, 30% opacity) to enhance the 3D glass effect.

### Input Fields
Soft gray backgrounds (5% opacity) that turn into frosted glass on focus. Use "Geist Mono" for any numeric input fields to maintain financial precision.

### Data Visualization
- **Line Charts:** Use thick, 3px strokes with a soft glow effect (drop shadow matching the line color).
- **Bar Charts:** Semi-transparent fills with 4px corner radii on the top of bars.
- **Positive/Negative Indicators:** Use the Emerald Green and Red with small directional arrows (↑/↓) and "Geist Mono" labels.

### Sidebar/Navigation
The sidebar should be a vertical "Glass Pane" pinned to the left, using a higher backdrop blur (40px) to separate it from the main content scroll area. Icons should be thin-stroke (1.5px) and use the primary color for the active state.