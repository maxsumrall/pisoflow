const icon = (id, body) => ({
  id,
  name: id,
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${body}</svg>`)}`,
  isIsometric: true,
  collection: "pisoflow",
});

const shadow = '<ellipse cx="60" cy="102" rx="42" ry="10" fill="#172033" opacity=".15"/>';
const cube = '<path d="M60 12 104 37 60 62 16 37Z" fill="#dbeafe" stroke="#172033" stroke-width="3"/><path d="M16 37 60 62v40L16 77Z" fill="#93c5fd" stroke="#172033" stroke-width="3"/><path d="M104 37 60 62v40l44-25Z" fill="#60a5fa" stroke="#172033" stroke-width="3"/>';

export const icons = [
  icon("block", `${shadow}${cube}`),
  icon("server", `${shadow}<path d="M60 12 102 36 60 60 18 36Z" fill="#ede9fe" stroke="#172033" stroke-width="3"/><path d="M18 36 60 60v42L18 78Z" fill="#c4b5fd" stroke="#172033" stroke-width="3"/><path d="M102 36 60 60v42l42-24Z" fill="#8b5cf6" stroke="#172033" stroke-width="3"/><path d="m25 51 27 15v7L25 58Zm0 15 27 15v7L25 73Z" fill="#fff"/><circle cx="91" cy="57" r="3" fill="#fff"/><circle cx="91" cy="70" r="3" fill="#fff"/>`),
  icon("storage", `${shadow}<ellipse cx="60" cy="32" rx="38" ry="20" fill="#fde68a" stroke="#172033" stroke-width="3"/><path d="M22 32v48c0 11 17 20 38 20s38-9 38-20V32c0 11-17 20-38 20s-38-9-38-20Z" fill="#f59e0b" stroke="#172033" stroke-width="3"/><path d="M22 55c0 11 17 20 38 20s38-9 38-20" fill="none" stroke="#172033" stroke-width="3"/>`),
  icon("queue", `${shadow}<g stroke="#172033" stroke-width="3"><path d="m38 20 30 17-30 17L8 37Z" fill="#fed7aa"/><path d="m38 54 30-17v22L38 76 8 59V37Z" fill="#fb923c"/><path d="m76 43 30 17-30 17-30-17Z" fill="#ffedd5"/><path d="m76 77 30-17v22L76 99 46 82V60Z" fill="#f97316"/></g>`),
  icon("function-module", `${shadow}${cube}<path d="m40 54-12 12 12 12m40-24 12 12-12 12M68 48 52 84" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`),
  icon("document", `${shadow}<path d="M36 12h38l20 20v66H36Z" fill="#ecfdf5" stroke="#172033" stroke-width="3"/><path d="M74 12v20h20" fill="#a7f3d0" stroke="#172033" stroke-width="3"/><path d="M48 48h34M48 61h34M48 74h25" stroke="#047857" stroke-width="5" stroke-linecap="round"/>`),
  icon("desktop", `${shadow}<path d="M22 18h76v54H22Z" fill="#e0f2fe" stroke="#172033" stroke-width="3"/><path d="M30 26h60v38H30Z" fill="#38bdf8"/><path d="M60 72v18m-20 0h40" stroke="#172033" stroke-width="5" stroke-linecap="round"/>`),
];
