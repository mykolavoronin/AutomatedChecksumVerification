# Interface direction

A white, full-page utility with calm hierarchy and minimal framing. The popup summarizes the current check; the report holds detailed evidence and settings.

- White canvas (#fff), near-black text (#1d1d1f), muted supporting text (#6e6e73), and soft gray fields (#f5f5f7).
- Small, subdued green, amber, and red status badges complement explicit outcome words.
- No outer report frame, no nested settings cards, no divider borders. Settings groups use spacing and headings.
- System sans typography. Report section titles use 28px, popup results 24px, body 14px, and supporting labels 12px. Digest evidence uses monospace.
- Primary and secondary actions use pill shapes with 40px minimum height. Fields have 14px corners. Inline SVG icons have consistent 18px size and accessible labels.
- A 220px sidebar sits beside report content. Below 760px, navigation moves above the content. More options discloses interface mode controls.
- The document viewport owns scrolling. The report body must never use overflow: clip or a fixed height. Wheel, keyboard, narrow-screen scrolling, and scroll preservation across background updates are tested.
- Page progress panels use white, rounded surfaces with a soft contextual shadow. Panels preserve their controls while progress changes and remain dismissible.
- Motion confirms arrival, dismissal, stage changes, and measured progress. Reduced motion stops spatial transitions and in-flight effects.
- Results appear only after pending evidence and rechecks finish. Automatic report results belong to Downloads; manual results belong to Verify a file. Settings and Page files stay focused on their tasks.
- Light is the default. Dark and system appearance remain explicit optional preferences. The white-interface upgrade changes only appearance once; existing protection rules persist.

The user requested direct implementation and testing, with a compact popup, full report tab, rounded minimalist controls, and a white interface. No generated concept image is part of the design authority.
