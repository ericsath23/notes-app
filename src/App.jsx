import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function App() {
  const [session, setSession] = useState(null);
  const [notes, setNotes] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadNotes();
  }, [session]);
  useEffect(() => {
    if (!editing) return;
    const timer = setTimeout(async () => {
      await supabase
        .from("notes")
        .update({
          title: editing.title,
          body: editing.body,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);
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

  if (!session) {
    return (
      <div>
        <h1>Notes</h1>
        <button onClick={signIn}>Sign in with Google</button>
      </div>
    );
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
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) return console.error(error);
    setNotes(notes.filter((n) => n.id !== id));
  }

  function closeEditor() {
    setEditing(null);
    loadNotes();
  }

  if (editing) {
    return (
      <div className="editor">
        <button onClick={closeEditor}>← Notes</button>
        <input
          value={editing.title}
          onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          placeholder="Title"
        />
        <textarea
          value={editing.body}
          onChange={(e) => setEditing({ ...editing, body: e.target.value })}
          placeholder="Start writing…"
        />
      </div>
    );
  }

  return (
    <div className="app">
      <h1>Notes</h1>
      <button onClick={createNote}>New note</button>
      <button onClick={signOut}>Sign out</button>
      {notes.map((note) => (
        <div key={note.id} className="note" onClick={() => setEditing(note)}>
          <h3>{note.title}</h3>
          <p>{note.body || "Empty"}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteNote(note.id);
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
