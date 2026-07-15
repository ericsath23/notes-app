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

export default function App() {
  const [session, setSession] = useState(null);
  const [notes, setNotes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saveState, setSaveState] = useState("saved");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadNotes();
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
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);
      setSaveState(error ? "error" : "saved");
    }, 800);
    return () => clearTimeout(timer);
  }, [editing]);

  async function signIn() {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  }
  async function signOut() {
    await supabase.auth.signOut();
    setNotes([]);
  }

  async function loadNotes() {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) console.error(error);
    else setNotes(data);
  }

  async function createNote() {
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: session.user.id, title: "Untitled", body: "" })
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
    setEditing(null);
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
        <textarea
          className="editor-body"
          value={editing.body}
          onChange={(e) => setEditing({ ...editing, body: e.target.value })}
          placeholder="Start writing…"
        />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1 className="brand">Notes</h1>
        <div className="actions">
          <button className="btn-primary" onClick={createNote}>
            New note
          </button>
          <button className="btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Nothing here yet</div>
          <div>Tap New note to write your first one.</div>
        </div>
      ) : (
        <div className="notes">
          {notes.map((note) => (
            <div
              key={note.id}
              className="note"
              onClick={() => setEditing(note)}
            >
              <div className="note-title">{note.title || "Untitled"}</div>
              <div className="note-body">{note.body || "No text yet"}</div>
              <div className="note-foot">
                <span className="note-time">{timeAgo(note.updated_at)}</span>
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
    </div>
  );
}
