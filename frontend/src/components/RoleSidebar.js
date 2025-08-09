import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

const Sidebar = styled.div`
  width: 200px;
  background: #f0f0f0;
  padding: 10px;
  box-sizing: border-box;
`;

const Item = styled.div`
  padding: 8px;
  cursor: pointer;
  background: ${props => (props.active ? '#ddd' : 'transparent')};
  margin-bottom: 4px;
`;

export default function RoleSidebar({ currentRole, onSelect, onShowMemory }) {
  const [roles, setRoles] = useState([]);
  useEffect(() => {
    fetch('/api/roles')
      .then(r => r.json())
      .then(data => {
        setRoles(data.roles || []);
        if (!currentRole && data.roles && data.roles.length > 0) {
          onSelect(data.roles[0]);
        }
      });
  }, []);
  return (
    <Sidebar>
      {roles.map(r => (
        <Item key={r} active={r === currentRole} onClick={() => onSelect(r)}>
          {r}
        </Item>
      ))}
      <Item onClick={onShowMemory}>Memories</Item>
    </Sidebar>
  );
}
