import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const USER_ID = "ea58bebb-be25-42f2-8f5a-86c090fe0ea6";

export default function App() {
  const [notes, setNotes] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    loadNotes();
  }, []);

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
      .insert({ user_id: USER_ID, title: "Untitled", body: "" })
      .select()
      .single();
    if (error) return console.error(error);
    setNotes([data, ...notes]);
    setEditing(data);
  }

  async function saveNote() {
    const { error } = await supabase
      .from("notes")
      .update({
        title: editing.title,
        body: editing.body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editing.id);
    if (error) return console.error(error);
    setEditing(null);
    loadNotes();
  }

  async function deleteNote(id) {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) return console.error(error);
    setNotes(notes.filter((n) => n.id !== id));
  }

  if (editing) {
    return (
      <div>
        <input
          value={editing.title}
          onChange={(e) => setEditing({ ...editing, title: e.target.value })}
        />
        <textarea
          value={editing.body}
          onChange={(e) => setEditing({ ...editing, body: e.target.value })}
        />
        <button onClick={saveNote}>Save</button>
        <button onClick={() => setEditing(null)}>Cancel</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Notes</h1>
      <button onClick={createNote}>New note</button>
      {notes.map((note) => (
        <div key={note.id}>
          <h3 onClick={() => setEditing(note)}>{note.title}</h3>
          <p>{note.body}</p>
          <button onClick={() => deleteNote(note.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
