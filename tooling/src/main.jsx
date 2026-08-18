import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Isoflow from "isoflow";
import thirdPartyNotices from "../../licenses/generated-document-notices.txt?raw";
import { icons } from "./icons.js";
import { isoflowLicense } from "./license.js";
import "./style.css";

const IsoflowComponent = Isoflow.default ?? Isoflow;
const encoded = document.getElementById("pisoflow-data")?.textContent?.trim() ?? "";
const bytes = Uint8Array.from(atob(encoded), (value) => value.charCodeAt(0));
const diagram = JSON.parse(new TextDecoder().decode(bytes));
const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
const evidenceText = (entries) => entries.map((entry) => `${entry.source} ${entry.detail ?? ""}`).join(" ");
const contains = (values, query) => values.filter(Boolean).join(" ").toLowerCase().includes(query);
const viewNodeIds = (view) => view.groups.flatMap((group) => group.nodes);

function Evidence({ entries }) {
  if (entries.length === 0) return <p className="muted">No evidence recorded.</p>;
  return <ul className="evidence-list">{entries.map((entry, index) => <li key={`${entry.source}-${index}`}><code>{entry.source}</code>{entry.detail && <span> — {entry.detail}</span>}</li>)}</ul>;
}

function Status({ value }) {
  const status = diagram.catalogs.statuses[value];
  return <span className="status" style={{ "--status-color": status.color }}>{status.label}</span>;
}

function Legend({ entries }) {
  return (
    <ul className="legend" aria-label="Active view flow legend">
      {entries.map((entry) => (
        <li key={entry.id}>
          <span className={`line ${entry.style.toLowerCase()}`} style={{ borderColor: entry.color }} />
          <span>{entry.label} <small>flow</small></span>
        </li>
      ))}
    </ul>
  );
}

function NodeInspector({ node }) {
  if (!node) return null;
  return (
    <article className="inspector-content" id="component-details" aria-live="polite">
      <div className="inspector-title"><h3>{node.name}</h3><Status value={node.status} /></div>
      <p>{node.summary}</p>
      {node.details && <pre>{node.details}</pre>}
      <h4>Evidence</h4>
      <Evidence entries={node.evidence} />
    </article>
  );
}

function TextAlternative() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const metadataMatch = !normalized || contains(Object.values(diagram.metadata), normalized);
  const results = diagram.views.map((view) => {
    const viewMatch = metadataMatch || contains([view.id, view.name, view.question, view.description, ...view.groups.flatMap((group) => [group.id, group.name])], normalized);
    const directNodes = new Set(viewNodeIds(view).filter((nodeId) => {
      const node = nodeById.get(nodeId);
      return viewMatch || contains([node.id, node.name, node.summary, node.details, node.status, evidenceText(node.evidence)], normalized);
    }));
    const edges = view.edges.filter((edge) => viewMatch || contains([edge.id, edge.label, edge.kind, edge.status, edge.contract, evidenceText(edge.evidence)], normalized) || directNodes.has(edge.from) || directNodes.has(edge.to));
    const visibleNodes = new Set(directNodes);
    edges.forEach((edge) => {
      visibleNodes.add(edge.from);
      visibleNodes.add(edge.to);
    });
    return { view, edges, visibleNodes };
  }).filter((result) => !normalized || result.visibleNodes.size > 0 || result.edges.length > 0);

  return (
    <section className="text-alternative" aria-labelledby="architecture-details">
      <h2 id="architecture-details">Architecture details</h2>
      <p>This text view contains every view, group, component, flow, status, contract, and evidence record.</p>
      <label className="search-label" htmlFor="architecture-search">Search the complete architecture</label>
      <input id="architecture-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="For example: payment contract or source path" />
      {results.length === 0 && <p role="status">No architecture details match this search.</p>}
      {results.map(({ view, edges, visibleNodes }, index) => (
        <details className="view-details" key={view.id} open={Boolean(normalized) || index === 0}>
          <summary>{view.name}</summary>
          <p><strong>Question:</strong> {view.question}</p>
          <p>{view.description}</p>
          <h3>Groups and components</h3>
          {view.groups.map((group) => {
            const nodes = group.nodes.filter((nodeId) => visibleNodes.has(nodeId));
            if (normalized && nodes.length === 0) return null;
            return (
              <section className="text-group" key={group.id} aria-labelledby={group.heading.id}>
                <h4 id={group.heading.id}>{group.name}</h4>
                <div className="model-list">{nodes.map((nodeId) => {
                  const node = nodeById.get(nodeId);
                  return (
                    <details key={node.id}>
                      <summary>{node.name} <Status value={node.status} /></summary>
                      <p>{node.summary}</p>
                      {node.details && <pre>{node.details}</pre>}
                      <h5>Evidence</h5>
                      <Evidence entries={node.evidence} />
                    </details>
                  );
                })}</div>
              </section>
            );
          })}
          <h3>Flows</h3>
          <div className="table-scroll">
            <table>
              <thead><tr><th>From</th><th>To</th><th>Flow</th><th>Status</th><th>Contract and evidence</th></tr></thead>
              <tbody>{edges.map((edge) => (
                <tr key={edge.id}>
                  <td>{nodeById.get(edge.from).name}</td>
                  <td>{nodeById.get(edge.to).name}</td>
                  <td>{diagram.catalogs.edgeKinds[edge.kind].label}: {edge.label}</td>
                  <td><Status value={edge.status} /></td>
                  <td>{edge.contract && <p><strong>Contract:</strong> {edge.contract}</p>}<Evidence entries={edge.evidence} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      ))}
    </section>
  );
}

function LicenseNotice() {
  return (
    <footer><details><summary>Open-source licenses</summary><p>Pisoflow uses Isoflow Community Edition. Pisoflow is independent and is not affiliated with Isoflow.</p><h3>Isoflow Community Edition</h3><pre>{isoflowLicense}</pre><h3>Third-party licenses and distribution notices</h3><pre>{thirdPartyNotices}</pre></details></footer>
  );
}

function App() {
  const [activeViewId, setActiveViewId] = useState(diagram.views[0].id);
  const activeView = diagram.views.find((view) => view.id === activeViewId);
  const activeNodeIds = useMemo(() => viewNodeIds(activeView), [activeView]);
  const [selectedNodeId, setSelectedNodeId] = useState(activeNodeIds[0]);
  const inspectorRef = useRef(null);
  const isoflowView = diagram.isoflow.views.find((view) => view.id === activeViewId);
  useEffect(() => {
    document.title = diagram.metadata.title;
  }, []);
  useEffect(() => {
    if (!activeNodeIds.includes(selectedNodeId)) setSelectedNodeId(activeNodeIds[0]);
  }, [activeNodeIds, selectedNodeId]);
  const selectNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    requestAnimationFrame(() => inspectorRef.current?.focus());
  };
  const moveViewFocus = (event) => {
    const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
    const current = tabs.indexOf(document.activeElement);
    const offsets = { ArrowRight: 1, ArrowLeft: -1, Home: -current, End: tabs.length - current - 1 };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next = (current + offsets[event.key] + tabs.length) % tabs.length;
    tabs[next].focus();
    tabs[next].click();
  };
  const initialData = useMemo(() => ({ ...diagram.isoflow, views: [isoflowView], view: activeViewId, icons }), [activeViewId, isoflowView]);

  return (
    <div className="app">
      <header>
        <div className="header-copy">
          <h1>{diagram.metadata.title}</h1>
          <p>{diagram.metadata.description}</p>
          <dl className="metadata"><div><dt>Question</dt><dd>{diagram.metadata.question}</dd></div><div><dt>Audience</dt><dd>{diagram.metadata.audience}</dd></div><div><dt>Scope</dt><dd>{diagram.metadata.scope}</dd></div></dl>
        </div>
        <Legend entries={activeView.legend} />
      </header>
      <nav className="view-tabs" aria-label="Architecture views" role="tablist" onKeyDown={moveViewFocus}>
        {diagram.views.map((view) => <button id={`view-tab-${view.id}`} key={view.id} type="button" role="tab" aria-controls="view-panel" aria-selected={view.id === activeViewId} tabIndex={view.id === activeViewId ? 0 : -1} onClick={() => setActiveViewId(view.id)}>{view.name}</button>)}
      </nav>
      <section id="view-panel" role="tabpanel" aria-labelledby={`view-tab-${activeViewId}`}>
        <div className="view-introduction"><h2>{activeView.name}</h2><p><strong>{activeView.question}</strong></p><p>{activeView.description}</p><p className="canvas-help">The canvas is an overview. Zoom or pan for labels. Exact details stay in the inspector and searchable text view.</p></div>
        <div className="workspace">
          <main className="canvas" aria-label={`${activeView.name} isometric architecture diagram`}>
            <IsoflowComponent key={activeViewId} initialData={initialData} editorMode="EXPLORABLE_READONLY" mainMenuOptions={[]} />
          </main>
          <aside className="inspector" aria-labelledby="component-inspector-heading">
            <h2 id="component-inspector-heading">Component inspector</h2>
            <div className="component-controls" aria-label="Components in this view">{activeNodeIds.map((nodeId) => {
              const node = nodeById.get(nodeId);
              return <button key={nodeId} type="button" aria-pressed={selectedNodeId === nodeId} aria-controls="component-details" onClick={() => selectNode(nodeId)}>{node.name}</button>;
            })}</div>
            <div ref={inspectorRef} tabIndex="-1"><NodeInspector node={nodeById.get(selectedNodeId)} /></div>
          </aside>
        </div>
      </section>
      <TextAlternative />
      <LicenseNotice />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
