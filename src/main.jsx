import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import Isoflow from "isoflow";
import diagram from "@diagram";
import thirdPartyNotices from "../licenses/generated-document-notices.txt?raw";
import { icons } from "./icons.js";
import { isoflowLicense } from "./license.js";
import "./style.css";

const IsoflowComponent = Isoflow.default ?? Isoflow;
const plainText = (value = "") => value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&");
const legend = [
  ["service", "Service request", "dashed"],
  ["context", "Shared context", "solid"],
  ["fact", "Fact result", "dashed"],
  ["source", "Source data", "dotted"],
  ["output", "Final output", "solid"],
  ["warning", "Migration or legacy", "dashed"],
];

function TextAlternative() {
  const [query, setQuery] = useState("");
  const items = useMemo(() => new Map(diagram.items.map((item) => [item.id, item])), []);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (item) => !normalizedQuery || `${item.id} ${item.name} ${plainText(item.description)}`.toLowerCase().includes(normalizedQuery);

  return (
    <section className="text-alternative" aria-labelledby="architecture-details">
      <h2 id="architecture-details">Architecture details</h2>
      <p>This text view contains the same nodes, flows, statuses, and simplified queries as the canvas.</p>
      <label className="search-label" htmlFor="model-search">Search models and queries</label>
      <input
        id="model-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="For example: event processor"
      />
      {diagram.views.map((view, index) => {
        const viewItems = view.items.map((entry) => items.get(entry.id)).filter((item) => item && matches(item));
        if (normalizedQuery && viewItems.length === 0) return null;
        return (
          <details key={view.id} open={index === 0}>
            <summary>{view.name}</summary>
            {view.description && <p>{plainText(view.description)}</p>}
            <h3>Components and responsibilities</h3>
            <div className="model-list">
              {viewItems.map((item) => (
                <details key={item.id}>
                  <summary><code>{item.name}</code></summary>
                  <pre>{plainText(item.description) || "No description"}</pre>
                </details>
              ))}
            </div>
            {!normalizedQuery && (
              <>
                <h3>Flows</h3>
                <table>
                  <thead><tr><th>From</th><th>To</th><th>Meaning</th></tr></thead>
                  <tbody>
                    {view.connectors.map((connector) => {
                      const from = connector.anchors.find((anchor) => anchor.ref.item)?.ref.item;
                      const to = [...connector.anchors].reverse().find((anchor) => anchor.ref.item)?.ref.item;
                      return (
                        <tr key={connector.id}>
                          <td>{items.get(from)?.name ?? from}</td>
                          <td>{items.get(to)?.name ?? to}</td>
                          <td>{plainText(connector.description) || "Data flow"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </details>
        );
      })}
    </section>
  );
}

function LicenseNotice() {
  return (
    <footer>
      <details>
        <summary>Open-source licenses</summary>
        <p>Pisoflow uses Isoflow Community Edition. Pisoflow is independent and is not affiliated with Isoflow.</p>
        <h3>Isoflow Community Edition</h3>
        <pre>{isoflowLicense}</pre>
        <h3>Third-party licenses and distribution notices</h3>
        <pre>{thirdPartyNotices}</pre>
      </details>
    </footer>
  );
}

function App() {
  useEffect(() => {
    document.title = diagram.title;
  }, []);

  return (
    <div className="app">
      <header>
        <div>
          <h1>{diagram.title}</h1>
          <p>Select a node to inspect its details. Use the bottom view selector to move through the explanation.</p>
          <p className="view-list">{diagram.views.map((view) => view.name).join(" · ")}</p>
        </div>
        <ul className="legend" aria-label="Diagram legend">
          {legend.map(([color, label, style]) => (
            <li key={color}><span className={`line ${color} ${style}`} />{label}</li>
          ))}
        </ul>
      </header>
      <main aria-label="Interactive Isoflow architecture diagram">
        <IsoflowComponent
          initialData={{ ...diagram, icons }}
          editorMode="EXPLORABLE_READONLY"
          mainMenuOptions={["EXPORT.JSON", "EXPORT.PNG"]}
        />
      </main>
      <TextAlternative />
      <LicenseNotice />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
