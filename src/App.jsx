import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function App() {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    supabase
      .from("notes")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setNotes(data);
      });
  }, []);

  return (
    <div>
      <h1>Notes</h1>
      {notes.map((note) => (
        <div key={note.id}>
          <h3>{note.title}</h3>
          <p>{note.body}</p>
        </div>
      ))}
    </div>
  );
}
