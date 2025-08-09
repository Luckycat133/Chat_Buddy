import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  position: fixed;
  right: 0;
  top: 0;
  width: 300px;
  height: 100vh;
  background: #ffffff;
  border-left: 1px solid #ccc;
  padding: 10px;
  overflow-y: auto;
`;

export default function MemoryManager({ userId, onClose }) {
  const [memories, setMemories] = useState([]);
  const [editIndex, setEditIndex] = useState(-1);
  const [text, setText] = useState('');

  const load = () => {
    fetch(`/api/memory/${userId}`)
      .then(r => r.json())
      .then(data => setMemories(data.memories || []));
  };

  useEffect(() => {
    load();
  }, [userId]);

  const save = (idx) => {
    fetch(`/api/memory/${userId}/${idx}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    }).then(() => {
      setEditIndex(-1);
      load();
    });
  };

  const del = (idx) => {
    fetch(`/api/memory/${userId}/${idx}`, { method: 'DELETE' }).then(() => load());
  };

  return (
    <Container>
      <button onClick={onClose}>Close</button>
      {memories.map((m, idx) => (
        <div key={idx}>
          {editIndex === idx ? (
            <div>
              <input value={text} onChange={e => setText(e.target.value)} />
              <button onClick={() => save(idx)}>Save</button>
            </div>
          ) : (
            <div>
              <span>{m.text}</span>
              <button onClick={() => { setEditIndex(idx); setText(m.text); }}>Edit</button>
              <button onClick={() => del(idx)}>Delete</button>
            </div>
          )}
        </div>
      ))}
    </Container>
  );
}
