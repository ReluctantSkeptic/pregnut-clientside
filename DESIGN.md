# Homepage design

Selected by user: concept B, centered food gallery. Preserve the remainder of the landing page, food tools, and all nutrient cards.

Palette: existing cream #f3f0e8, forest #244940, ink #263038, muted #535c59.
Typography: self-hosted Instrument Serif headings and food labels; Geist body and controls. Hero 43–80px, body 16–17px, support 12–13px.
Spacing: 8, 12, 16, 24, 32, 40, 64px. Content maximum 1180px. Existing pill buttons and lower card radii remain.
Composition: centered heading, explanatory copy and primary/secondary actions, then a panoramic row of nine individual foods. No image frame or floating cards. Mobile keeps the same centered hierarchy with a responsive food strip.
Motion: calm 12px entrance, 600–800ms ease-out; native smooth anchor scrolling. Reduced motion disables animations and smooth scrolling.

Gallery integration: feather empty top/bottom and outer 2% edges with intersecting CSS masks. Keep food pixels opaque and natural shadows intact. Caption spacing closes the photographic backdrop gap.

Nutrient deck: native sticky cards on desktop and mobile; stable layout measurements, 3.5% recession and alternating 0.45-degree tilt as the next opaque card overlaps. Paper edges and soft shadows create depth. Tall cards pin low enough for their bottom to remain readable. Reduced motion uses a static list.

Reference stack replaces the earlier wide-card design: realfood.gov dga-module__LrmiHG__stack inspected 2026-09-27. Four groups preserve all 14 nutrient cards. Desktop uses 300vh sections, bottom-origin 8:10 cards, poses (25,-140,-8deg), (-30,-60,5deg), (15,20,-3deg), (-25,100,6deg), sequential 20% scroll segments, and 1.03 hover spring (stiffness400, damping25). Exact reference outer shadow 0 12px 24px #0000001a and 24px radius. Portrait mobile uses 80/128/176/224px sticky offsets and .88/.91/.94/.97 end scales. Live-text accommodation: minimum 280px cards on compact landscape and narrower typography at 320px. Preserve PregNut typography, nutrient content, and source links.
