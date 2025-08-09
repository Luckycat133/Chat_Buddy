import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

const Sidebar = styled.div`
  padding: 10px;
  background-color: #fff;
  height: 100%;
  box-shadow: 2px 0 4px rgba(0,0,0,0.1);
`;

const RoleButton = styled.button`
  display: block;
  width: 100%;
  margin-bottom: 8px;
  padding: 8px 12px;
  border: none;
  background-color: ${props => props.active ? '#FFB48A' : '#f0f0f0'};
  color: ${props => props.active ? '#fff' : '#333'};
  cursor: pointer;
  text-align: left;
`;

export default function RoleSidebar({ selectedRole, onSelect }) {
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5001/api/roles')
      .then(res => res.json())
      .then(data => setRoles(data.roles || []))
      .catch(() => setRoles([]));
  }, []);

  return (
    <Sidebar>
      {roles.map(role => (
        <RoleButton key={role} active={role === selectedRole} onClick={() => onSelect(role)}>
          {role}
        </RoleButton>
      ))}
    </Sidebar>
  );
}
