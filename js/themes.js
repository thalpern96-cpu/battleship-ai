/* Visual themes: colours live in CSS (body[data-theme]); names and labels live here. */
(function (root) {
  'use strict';

  const THEMES = [
    {
      id: 'classic',
      label: 'Classic Navy',
      title: '⚓ Battleship',
      subtitle: 'Sink the enemy fleet before the AI sinks yours.',
      playerBoard: 'Your fleet',
      enemyBoard: 'Enemy waters',
      ships: { carrier: 'Carrier', battleship: 'Battleship', cruiser: 'Cruiser', submarine: 'Submarine', destroyer: 'Destroyer' },
    },
    {
      id: 'pirate',
      label: 'Pirate',
      title: '🏴‍☠️ Pirate Battleship',
      subtitle: 'Send the scurvy dogs to Davy Jones\' locker!',
      playerBoard: 'Your armada',
      enemyBoard: 'Enemy seas',
      ships: { carrier: 'Galleon', battleship: 'Man-o\'-War', cruiser: 'Frigate', submarine: 'Sloop', destroyer: 'Dinghy' },
    },
    {
      id: 'space',
      label: 'Space',
      title: '🚀 Star Battleship',
      subtitle: 'Destroy the alien armada drifting through the asteroid field.',
      playerBoard: 'Your squadron',
      enemyBoard: 'Deep space',
      ships: { carrier: 'Mothership', battleship: 'Dreadnought', cruiser: 'Star Cruiser', submarine: 'Stealth Probe', destroyer: 'Scout' },
    },
    {
      id: 'sonar',
      label: 'Submarine Sonar',
      title: '📡 Sonar Battleship',
      subtitle: 'Silent running. Hunt the enemy wolfpack by sonar.',
      playerBoard: 'Your wolfpack',
      enemyBoard: 'Sonar contacts',
      ships: { carrier: 'Boomer', battleship: 'Attack Sub', cruiser: 'Hunter-Killer', submarine: 'Mini-Sub', destroyer: 'Drone' },
    },
  ];

  const api = {
    list: THEMES,
    get(id) { return THEMES.find((t) => t.id === id) || THEMES[0]; },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BattleshipThemes = api;
})(typeof window !== 'undefined' ? window : this);
