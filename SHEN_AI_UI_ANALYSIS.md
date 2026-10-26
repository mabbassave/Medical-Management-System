# Shen AI Homepage UI Analysis

**Reviewed:** 2026-10-15  
**Source:** [shen.ai](https://shen.ai/) and its publicly loaded page resources.

## Design overview

Shen AI is a long-form B2B healthcare technology landing page promoting camera-based measurement of health markers. Its design alternates spacious white/light sections with deep navy-black feature areas. A pale mint green accent is reserved for primary calls to action and brand details. Large, tightly tracked grotesk headings, product visuals, customer proof, tabs, carousels, and conversion prompts structure the page.

## Page structure

1. **Hero and navigation:** Shen AI logo, hamburger navigation, large face-scan video, headline “Monitor 30+ health markers through a face scan using any camera,” supporting copy, four benefit points, and “Start a free trial” / “Talk to sales” actions. The menu opens grouped Platform, Solutions, Use cases, Company, and Resources links, plus Pricing, Get started, and Scan yourself.
2. **Partner trust strip:** “Trusted by leading health & insurance innovators” and a repeated horizontal logo rail.
3. **Built for health and insurance leaders:** 30+ markers overview; Vital signs, Health indices, and Risks tabs; capability content for video processing, clinical validation, reliability, and ease of use.
4. **What you see vs what camera & AI see:** dark section with a four-slide visual carousel—Precise measurement, Detailed facial data, Micro-movement detection, Tracking the pulse—and a Scan yourself link.
5. **Backed by science and the most innovative technology:** dark technical/science section covering multimodal sensing/rPPG, training data, research, and on-device processing, with product graphics.
6. **Engineered to meet your business and users needs:** use-case tabs for Insurance, Telehealth, Mobile health, Corporate wellness, and Innovation; the selected Insurance view has a three-slide carousel.
7. **Medical-device certification:** ANVISA and CE claims, measurement details, certificate artwork, and Learn more link.
8. **Testimonials and customer stories:** dark section with four testimonial slides and customer-story cards.
9. **Fully customizable SDK:** dark integration section with copy about integrating the SDK into existing apps.
10. **Data governance:** Data ownership, Data processing, and Data integration content with an accompanying illustration.
11. **Conversion CTA:** “Ready to implement AI health monitoring?” and a Start a free trial link on a dark illustrated background.
12. **FAQ:** accordion-style questions about measurement, accuracy, timing, inclusivity, privacy, integration, customization, and EHR/FHIR.
13. **Footer:** dark multi-column footer with platform, solutions, resources, company, contact, and social links.

## Layout and responsive behavior

- Centered content containers, broad section spacing, and two-column hero/feature layouts at wider widths; feature content collapses to a single-column arrangement on narrow screens.
- Partner logos form a horizontal, repeated rail. Feature areas use image/text pairings and card groupings; tabs and carousels progressively reveal content.
- Desktop navigation becomes a hamburger menu at narrower widths; opening it exposes grouped dropdown navigation and prominent actions.
- Measured samples: hero H1 is 52 px at a broad width and 32 px at a narrow width; wide hero section measured about 736 px high in one capture. Heights and wrapping vary by viewport.
- Mobile inspection confirmed a single-column capability grid and menu button. Exact breakpoint thresholds were not established; viewport sizing in the inspection browser varied slightly from requested sizes.

## Colors

Values below were read from public CSS variables or computed styles:

| Role | HEX |
|---|---|
| Main brand/text (`dark-brand`) | `#171B1A` |
| Dark sections/footer (`dark-second`) | `#0E121A` |
| Primary CTA mint (`light-green`) | `#C7FFBE` |
| Logo green (`logo-green`) | `#ABE6A1` |
| Green accent (`green`) | `#52B441` |
| Green text accent (`text-green`) | `#82CC75` |
| Dark-section foreground | `#EEEEEE` |
| White surface | `#FFFFFF` |
| Neutrals | `#222222`, `#444444`, `#666666`, `#AAAAAA`, `#CCCCCC` |
| Gray ramp | `#F8FAFC`, `#EEF2F6`, `#E3E8EF`, `#CDD5DF`, `#9AA4B2`, `#717680`, `#4B5565`, `#364152`, `#202939`, `#121926` |

Dark camera-analysis, technology, testimonial, SDK, and footer areas compute to `#0E121A`. The hero primary CTA computes to `#C7FFBE`. Gradient overlays are used on cards and image edges; the CTA background image is described as a dark gradient with subtle grid lines and diagonal light streaks.

## Typography

- The computed site font stack is `"Esklarheitgroteskvar Xlt", Verdana, sans-serif`. A public `ESKlarheitGroteskVar-Xlt.ttf` resource is loaded; the browser reports a variable weight range of 200–800.
- Hero H1 sample: 52 px, weight 500, 62.4 px line height, -2.6 px tracking; mobile sample 32 px.
- Prominent H2 sample: 48 px / 52.8 px line height, weight 500, -2.4 px tracking. Smaller heading sample: 40 px / 48 px, weight 500.
- Body default sample: 16 px / 24 px; hero supporting copy: 18 px / 27 px. Primary button label sample: 16 px, weight 600.
- Roboto Variable and other font faces were declared/visible in browser font metadata but not loaded in the observed state; they are not identified as active site typography.

## Images and assets

- The inspected document referenced 65 unique `<img>` URLs during one browser session. Assets came primarily from `cdn.prod.website-files.com`; the count may vary with lazy loading and responsive source selection.
- Formats observed: SVG, PNG, JPG/JPEG, WEBP, AVIF, TTF, and MP4.
- The hero MP4 is configured to autoplay, loop, remain muted, play inline, and hide native controls; a JPEG poster image is also supplied.
- SVGs are used for logos, health-marker visuals, solution icons, and certification artwork. WEBP assets cover feature/technology illustrations and background imagery. AVIF appears among solution imagery.
- Examples: [hero MP4](https://cdn.prod.website-files.com/680280c18df8e68403545b30/68a9e1f99ef659e6c76a8259_Hero%20video%20loop-transcode.mp4), [hero poster](https://cdn.prod.website-files.com/680280c18df8e68403545b30/68a9e1f99ef659e6c76a8259_Hero%20video%20loop-poster-00001.jpg), [Shen AI logo SVG](https://cdn.prod.website-files.com/680280c18df8e68403545b30/6a7da25ae951fd2704d3950d_Logo.svg), [health indices SVG](https://cdn.prod.website-files.com/680280c18df8e68403545b30/680280c18df8e68403545d94_Health%20indices.svg), [technology WEBP](https://cdn.prod.website-files.com/680280c18df8e68403545b30/680280c18df8e68403545bc8_home-ai_graphic1.webp), [certificate SVG](https://cdn.prod.website-files.com/680280c18df8e68403545b30/69d8d3e1a0f7e2d7addb8eec_certificate%20hero%20.svg), [governance WEBP](https://cdn.prod.website-files.com/680280c18df8e68403545b30/680280c18df8e68403545e0f_Data%20governance.webp), [font TTF](https://cdn.prod.website-files.com/680280c18df8e68403545b30/680280c18df8e68403545bc1_ESKlarheitGroteskVar-Xlt.ttf).

## Components, interactions, and motion

- Hamburger navigation with expandable dropdown groups.
- Rounded primary mint CTA and secondary transparent/outlined CTA; observed button corners are about 12 px with short CSS transitions.
- Tabbed panels for health markers and industry/use-case categories.
- Previous/next controls for face-analysis, solution, and testimonial carousels; previous is disabled at the first item in the observed state.
- Disclosure/accordion-style capability and FAQ items.
- Repeated partner logos suggest a looping/marquee rail; exact motion was not measured.
- Webflow interaction classes and CSS transitions are present. Specific scroll-trigger sequences and reduced-motion behavior were not verified.

## Verified technologies and publicly identifiable packages

- **Webflow** is verified by `data-wf-*` attributes, Webflow classes (`w-nav`, `w-dropdown`, `w-tabs`, `w-inline-block`), CDN stylesheets, and the Webflow JavaScript bundle.
- **jQuery 3.5.1** is loaded from a Webflow-hosted script.
- **Swiper 8.4.7** is loaded from cdnjs.
- **Finsweet** scripts include `@finsweet/attributes-scrolldisable@1` and `@finsweet/fs-components@2`.
- Browser resources also include HubSpot, Cookiebot, Google Tag Manager/Google tag, LinkedIn Insight, Meta/Facebook pixel, DoubleClick, and Claydar scripts. Their presence is verified; exact configuration and UI dependency are not.
- No React/Vue application runtime was verified for this website.

## Verification notes and unknowns

**Verified:** section order, visible copy and controls, computed font stack and representative sizes, selected CSS color variables, public asset URLs/formats, hero video attributes, Webflow markers, and loaded script URLs.

**Variable/estimated:** section heights, responsive wrapping, logo-rail motion, and page-wide image count depend on viewport, state, lazy loading, and browser timing.

**Not verified:** private Webflow authoring structure, full design-token/breakpoint specification, image licensing or production origin, exact implementation of each interaction, whether third-party scripts are essential, and complete animation behavior across devices.
