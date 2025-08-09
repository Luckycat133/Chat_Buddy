import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  padding: 10px;
  background-color: #fff;
  height: 100%;
  box-shadow: -2px 0 4px rgba(0,0,0,0.1);
  overflow-y: auto;
`;

const MemoryItem = styled.div`
  margin-bottom: 8px;
`;

const Button = styled.button`
  margin-left: 4px;
`;

export default function MemoryManager({ userId, role }) {
  const [memories, setMemories] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:5001/api/memory/${userId}/${role}`)
      .then(res => res.json())
      .then(data => setMemories(data.memories || []))
      .catch(() => setMemories([]));
  }, [userId, role]);

  const handleDelete = async (id) => {
    await fetch(`http://localhost:5001/api/memory/${userId}/${role}/${id}`, { method: 'DELETE' });
    setMemories(memories.filter(m => m.id !== id));
  };

  const handleChange = (id, text) => {
    setMemories(memories.map(m => m.id === id ? { ...m, text } : m));
  };

  const handleSave = async (id, text) => {
    await fetch(`http://localhost:5001/api/memory/${userId}/${role}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
  };

  return (
    <Container>
      <h3>Memories</h3>
      {memories.map(m => (
        <MemoryItem key={m.id}>
          <input value={m.text} onChange={e => handleChange(m.id, e.target.value)} />
          <Button onClick={() => handleSave(m.id, m.text)}>Save</Button>
          <Button onClick={() => handleDelete(m.id)}>Delete</Button>
        </MemoryItem>
      ))}
    </Container>
  );
}
