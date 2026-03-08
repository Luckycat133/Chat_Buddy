/**
 * CharacterTheme - Character-specific theme management for immersive chat experience
 * 
 * Provides dynamic theme colors based on AI character personality,
 * enabling each character to have a unique visual atmosphere.
 */

// Character theme configurations
const characterThemes = {
  // Anime Characters
  'rem': {
    id: 'rem',
    name: 'Rem',
    primary: '#7DBED8',
    accent: '#FFB6C1',
    glow: 'rgba(125, 190, 216, 0.35)',
    glowClass: 'glow-rem',
    gradient: 'linear-gradient(135deg, #7DBED8 0%, #FFB6C1 100%)',
  },
  'zero-two': {
    id: 'zero-two',
    name: 'Zero Two',
    primary: '#FF6B8A',
    accent: '#FFD700',
    glow: 'rgba(255, 107, 138, 0.35)',
    glowClass: 'glow-zerotwo',
    gradient: 'linear-gradient(135deg, #FF6B8A 0%, #FFD700 100%)',
  },
  'miku': {
    id: 'miku',
    name: 'Hatsune Miku',
    primary: '#39C5BB',
    accent: '#E8F8F5',
    glow: 'rgba(57, 197, 187, 0.35)',
    glowClass: 'glow-miku',
    gradient: 'linear-gradient(135deg, #39C5BB 0%, #86E3CE 100%)',
  },
  'gojo': {
    id: 'gojo',
    name: 'Gojo Satoru',
    primary: '#4169E1',
    accent: '#E6E6FA',
    glow: 'rgba(65, 105, 225, 0.35)',
    glowClass: 'glow-gojo',
    gradient: 'linear-gradient(135deg, #4169E1 0%, #9370DB 100%)',
  },
  'rin': {
    id: 'rin',
    name: 'Rin Tohsaka',
    primary: '#DC143C',
    accent: '#2D2D2D',
    glow: 'rgba(220, 20, 60, 0.35)',
    glowClass: 'glow-rin',
    gradient: 'linear-gradient(135deg, #DC143C 0%, #8B0000 100%)',
  },
  'naruto': {
    id: 'naruto',
    name: 'Naruto Uzumaki',
    primary: '#FF8C00',
    accent: '#4682B4',
    glow: 'rgba(255, 140, 0, 0.35)',
    glowClass: 'glow-naruto',
    gradient: 'linear-gradient(135deg, #FF8C00 0%, #FFA500 100%)',
  },
  'l': {
    id: 'l',
    name: 'L',
    primary: '#2F4F4F',
    accent: '#F5F5F5',
    glow: 'rgba(47, 79, 79, 0.35)',
    glowClass: 'glow-l',
    gradient: 'linear-gradient(135deg, #2F4F4F 0%, #696969 100%)',
  },
  'asuna': {
    id: 'asuna',
    name: 'Asuna',
    primary: '#FF6347',
    accent: '#FFFAF0',
    glow: 'rgba(255, 99, 71, 0.35)',
    glowClass: 'glow-asuna',
    gradient: 'linear-gradient(135deg, #FF6347 0%, #FF7F50 100%)',
  },
};

// Default theme for unknown characters
const defaultTheme = {
  id: 'default',
  name: 'Default',
  primary: '#FF9B7A',
  accent: '#B8A4E3',
  glow: 'rgba(255, 155, 122, 0.35)',
  glowClass: '',
  gradient: 'linear-gradient(135deg, #FF9B7A 0%, #FF7E9D 50%, #B8A4E3 100%)',
};

/**
 * Get character theme by persona ID
 * @param {string} personaId - The ID of the AI persona
 * @returns {object} Theme configuration object
 */
export function getCharacterTheme(personaId) {
  if (!personaId) return defaultTheme;
  
  // Normalize the ID (handle various formats)
  const normalizedId = personaId.toLowerCase().replace(/[-_\s]/g, '');
  
  // Try to find matching theme
  for (const [key, theme] of Object.entries(characterThemes)) {
    const normalizedKey = key.toLowerCase().replace(/[-_\s]/g, '');
    if (normalizedId.includes(normalizedKey) || normalizedKey.includes(normalizedId)) {
      return theme;
    }
  }
  
  return defaultTheme;
}

/**
 * Get glow class name for a character
 * @param {string} personaId - The ID of the AI persona
 * @returns {string} CSS class name for the glow effect
 */
export function getCharacterGlowClass(personaId) {
  const theme = getCharacterTheme(personaId);
  return theme.glowClass || '';
}

/**
 * Get inline style object for character theme
 * @param {string} personaId - The ID of the AI persona
 * @returns {object} CSS style object
 */
export function getCharacterThemeStyle(personaId) {
  const theme = getCharacterTheme(personaId);
  return {
    '--character-glow': theme.glow,
    '--character-primary': theme.primary,
    '--character-accent': theme.accent,
    '--character-gradient': theme.gradient,
  };
}

/**
 * Check if a character has a custom theme
 * @param {string} personaId - The ID of the AI persona
 * @returns {boolean}
 */
export function hasCustomTheme(personaId) {
  if (!personaId) return false;
  const normalizedId = personaId.toLowerCase().replace(/[-_\s]/g, '');
  
  return Object.keys(characterThemes).some(key => {
    const normalizedKey = key.toLowerCase().replace(/[-_\s]/g, '');
    return normalizedId.includes(normalizedKey) || normalizedKey.includes(normalizedId);
  });
}

export { characterThemes, defaultTheme };
export default { getCharacterTheme, getCharacterGlowClass, getCharacterThemeStyle, hasCustomTheme };
