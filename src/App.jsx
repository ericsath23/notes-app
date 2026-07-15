import { useEffect, useState } from "react";
import { supabase } from "./supabase";

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
function folderName(folders, id) {
  const f = folders.find((f) => f.id === id);
  return f ? f.name : null;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState("all");
  const [editing, setEditing] = useState(null);
  const [saveState, setSaveState] = useState("saved");
  const [query, setQuery] = useState("");
  const [newFolderName, setNewFolderName] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadNotes();
      loadFolders();
    }
  }, [session]);

  useEffect(() => {
    if (!editing) return;
    setSaveState("saving");
    const timer = setTimeout(async () => {
      const { error } = await supabase
        .from("notes")
        .update({
          title: editing.title,
          body: editing.body,
          folder_id: editing.folder_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);
      setSaveState(error ? "error" : "saved");
    }, 800);
    return () => clearTimeout(timer);
  }, [editing]);

  useEffect(() => {
    if (editing) {
      window.history.pushState({ editing: true }, "");
      const onPop = () => {
        setEditing(null);
        loadNotes();
      };
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    }
  }, [editing]);
  async function signIn() {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  }
  async function signOut() {
    await supabase.auth.signOut();
    setNotes([]);
    setFolders([]);
  }

  async function loadNotes() {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) console.error(error);
    else setNotes(data);
  }

  async function loadFolders() {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) console.error(error);
    else setFolders(data);
  }

  async function createFolder(assignToEditing = false) {
    const name = newFolderName?.trim();
    if (!name) {
      setNewFolderName(null);
      return;
    }
    const { data, error } = await supabase
      .from("folders")
      .insert({ name })
      .select()
      .single();
    if (error) return console.error(error);
    setFolders([...folders, data]);
    setNewFolderName(null);
    if (assignToEditing && editing) {
      setEditing({ ...editing, folder_id: data.id });
    }
  }

  async function createNote() {
    const folder_id = activeFolder === "all" ? null : activeFolder;
    const { data, error } = await supabase
      .from("notes")
      .insert({
        user_id: session.user.id,
        title: "Untitled",
        body: "",
        folder_id,
      })
      .select()
      .single();
    if (error) return console.error(error);
    setNotes([data, ...notes]);
    setEditing(data);
  }

  async function deleteNote(id) {
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) return console.error(error);
    setNotes(notes.filter((n) => n.id !== id));
  }

  function closeEditor() {
    window.history.back();
  }
  async function deleteFolder(id) {
    const folder = folders.find((f) => f.id === id);
    if (
      !window.confirm(`Delete "${folder?.name}"? Notes inside become unfiled.`)
    )
      return;
    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (error) return console.error(error);
    setFolders(folders.filter((f) => f.id !== id));
    if (activeFolder === id) setActiveFolder("all");
    loadNotes();
  }
  if (!session) {
    return (
      <div className="login">
        <h1 className="brand">Notes</h1>
        <p>A quiet place to write things down — on any device, only yours.</p>
        <button className="btn-primary" onClick={signIn}>
          Sign in with Google
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="editor">
        <div className="editor-bar">
          <button className="editor-back" onClick={closeEditor}>
            ← Notes
          </button>
          <span className="save-state">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "error"
                ? "Not saved"
                : "Saved"}
          </span>
        </div>
        <input
          className="editor-title"
          value={editing.title}
          onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          placeholder="Title"
        />
        <div className="folder-pills">
          <button
            className={!editing.folder_id ? "fpill fpill-active" : "fpill"}
            onClick={() => setEditing({ ...editing, folder_id: null })}
          >
            No folder
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              className={
                editing.folder_id === f.id ? "fpill fpill-active" : "fpill"
              }
              onClick={() => setEditing({ ...editing, folder_id: f.id })}
            >
              {f.name}
            </button>
          ))}
          {newFolderName === null ? (
            <button
              className="fpill fpill-add"
              onClick={() => setNewFolderName("")}
            >
              + New
            </button>
          ) : (
            <input
              className="fpill-input"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createFolder(true);
                if (e.key === "Escape") setNewFolderName(null);
              }}
              onBlur={() => createFolder(true)}
              placeholder="Folder name…"
            />
          )}
        </div>
        <textarea
          className="editor-body"
          value={editing.body}
          onChange={(e) => setEditing({ ...editing, body: e.target.value })}
          placeholder="Start writing…"
        />
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const visible = notes.filter((n) => {
    if (activeFolder !== "all" && n.folder_id !== activeFolder) return false;
    if (
      q &&
      !n.title.toLowerCase().includes(q) &&
      !n.body.toLowerCase().includes(q)
    )
      return false;
    return true;
  });

  return (
    <div className="app">
      <div className="topbar">
        <h1 className="brand">Notes</h1>
        <div className="actions">
          <button className="btn-primary desktop-only" onClick={createNote}>
            New note
          </button>
          <button className="btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <div className="chips">
        <button
          className={activeFolder === "all" ? "chip chip-active" : "chip"}
          onClick={() => setActiveFolder("all")}
        >
          All
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            className={activeFolder === f.id ? "chip chip-active" : "chip"}
            onClick={() => setActiveFolder(f.id)}
          >
            {f.name}
            {activeFolder === f.id && (
              <span
                className="chip-del"
                role="button"
                aria-label={`Delete ${f.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFolder(f.id);
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
        {newFolderName === null ? (
          <button
            className="chip chip-add"
            onClick={() => setNewFolderName("")}
          >
            + Folder
          </button>
        ) : (
          <input
            className="chip-input"
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createFolder();
              if (e.key === "Escape") setNewFolderName(null);
            }}
            onBlur={createFolder}
            placeholder="Folder name…"
          />
        )}
      </div>

      {notes.length > 0 && (
        <input
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
        />
      )}

      {visible.length === 0 ? (
        <div className="empty">
          <div className="empty-title">
            {q ? "No matches" : "Nothing here yet"}
          </div>
          <div>
            {q
              ? "Try a different word."
              : "Tap New note to write your first one."}
          </div>
        </div>
      ) : (
        <div className="notes">
          {visible.map((note) => (
            <div
              key={note.id}
              className="note"
              onClick={() => setEditing(note)}
            >
              <div className="note-title">{note.title || "Untitled"}</div>
              <div className="note-body">{note.body || "No text yet"}</div>
              <div className="note-foot">
                <span className="note-time">
                  {timeAgo(note.updated_at)}
                  {activeFolder === "all" &&
                    note.folder_id &&
                    folderName(folders, note.folder_id) && (
                      <span className="note-folder">
                        {" · "}
                        {folderName(folders, note.folder_id)}
                      </span>
                    )}
                </span>
                <button
                  className="note-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNote(note.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button className="fab" onClick={createNote} aria-label="New note">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
