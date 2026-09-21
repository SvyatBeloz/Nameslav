// Subtle parallax tilt on the glass panel. Lives in its own file for two
// reasons: the share page used to carry a hand-copied inline duplicate of the
// homepage's version, and an inline <script> is exactly what a strict
// script-src CSP has to forbid (see src/routes/security.ts).

const MAX_DEGREES = 1.5;

export function enableTilt(panel) {
  panel.addEventListener("mousemove", (ev) => {
    const rect = panel.getBoundingClientRect();
    const px = (ev.clientY - rect.top) / rect.height - 0.5;
    const py = (ev.clientX - rect.left) / rect.width - 0.5;
    panel.style.transform = `perspective(1000px) rotateX(${px * -MAX_DEGREES}deg) rotateY(${py * MAX_DEGREES}deg)`;
  });
  panel.addEventListener("mouseleave", () => {
    panel.style.transform = "";
  });
}

// Auto-init so a page can opt in with nothing but <script type="module" src>.
// Module scripts are deferred, so the panel is already parsed by now.
const panel = document.querySelector(".panel");
if (panel) {
  enableTilt(panel);
}
