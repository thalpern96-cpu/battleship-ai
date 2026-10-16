/* AI opponent personalities, one per difficulty. {ship} is replaced by a ship name. */
(function (root) {
  'use strict';

  // `photo` is optional (path under img/personas/); without it the initials are shown.
  const PERSONAS = {
    easy: {
      name: 'Arif Shenoy',
      initials: 'AS',
      photo: 'img/personas/arif-shenoy.jpg',
      mood: 'cheerful and encouraging',
      lines: {
        start: ['Welcome aboard! Let\'s have some fun out here.', 'Great to have you on the water today. Fire when ready!', 'Friendly match? Friendly match. Let\'s go!'],
        aiMiss: ['Ha, just water. Your turn!', 'Missed! Nice hiding spot.', 'Splash! I\'ll get the hang of this.', 'Not quite. You\'re good at this.'],
        aiHit: ['Oh nice, I found one!', 'Got a hit! Don\'t worry, you\'re still in it.', 'Hit! That was a lucky one.'],
        aiSunk: ['Sank your {ship}! Shake it off, you\'ve got plenty left.', 'Your {ship} is down, but this is anyone\'s game.'],
        playerMiss: ['So close! Keep going.', 'Just water, but good instinct.', 'Missed, but I like your thinking.'],
        playerHit: ['Great shot!', 'Right in the hull! Nicely done.', 'Ooh, you found me!'],
        playerSunk: ['You sank my {ship}! Impressive.', 'There goes my {ship}. Well played!'],
        playerMoved: ['Smart move! Where did it go?', 'Ha, sneaky! I love it.'],
        aiWin: ['I won! That was a blast. Rematch?'],
        aiLose: ['You won! Fantastic game. You earned that one.'],
      },
    },
    normal: {
      name: 'Austin Mead',
      initials: 'AM',
      photo: 'img/personas/austin-mead.jpg',
      mood: 'a good sport',
      lines: {
        start: ['May the best captain win!', 'Battle stations! Let\'s have a proper match.', 'Good luck out there. You\'ll need it… just kidding. Mostly.'],
        aiMiss: ['The swell threw my aim.', 'Lucky you, that was a near thing.', 'Adjusting the range…', 'Just warming up the cannons.'],
        aiHit: ['Ha! Right in the hull!', 'A palpable hit!', 'Got you!'],
        aiSunk: ['Down goes your {ship}! Better luck with the rest.', 'Your {ship} is out of the game. Still plenty of fight left.'],
        playerMiss: ['Lucky shot… for me!', 'Not even close!', 'The fish thank you for the warning shot.'],
        playerHit: ['Ooh, good shot!', 'Damage control!', 'You\'ve found one. Well done.'],
        playerSunk: ['You sank my {ship}! A fine shot, I\'ll give you that.', 'There goes the {ship}. A good captain never panics… mostly.'],
        playerMoved: ['A crafty manoeuvre! I respect that.', 'Hiding from my guns, eh?'],
        aiWin: ['Victory! Good fight, though.'],
        aiLose: ['Well fought! You out-sailed me today.'],
      },
    },
    hard: {
      name: 'Chris Degnan',
      initials: 'CD',
      photo: 'img/personas/chris-degnan.jpg',
      mood: 'confident champion',
      lines: {
        start: ['I\'ve mapped every square already. Let\'s see what you\'ve got.', 'Bring your best game. I always do.', 'Champions don\'t guess. Let\'s begin.'],
        aiMiss: ['A calculated miss. It narrows things down.', 'Every miss tells me where you aren\'t.', 'Ruling that sector out.'],
        aiHit: ['Right where the numbers said.', 'Target found.', 'Exactly as planned.'],
        aiSunk: ['Your {ship} is down. Right on schedule.', '{ship} closed out. On to the next one.'],
        playerMiss: ['Close, but the board is mine.', 'Keep swinging!', 'Not this time.'],
        playerHit: ['Nice shot. Don\'t get comfortable.', 'You found one. Respect.', 'A rare hit!'],
        playerSunk: ['You sank my {ship}. Impressive. Won\'t happen twice.', 'Fine shot on the {ship}. Game on.'],
        playerMoved: ['Bold move. I like a challenger.', 'Repositioning? I\'ll find it anyway.'],
        aiWin: ['Undefeated. Great match, though. Come back anytime.'],
        aiLose: ['You beat me fair and square. I want a rematch!'],
      },
    },
  };

  function forDifficulty(difficulty) {
    return PERSONAS[difficulty] || PERSONAS.normal;
  }

  // Pick a line for an event, avoiding repeating the previous line.
  function line(persona, event, vars, previous, rng) {
    rng = rng || Math.random;
    const options = persona.lines[event] || [];
    if (options.length === 0) return '';
    let choices = options.filter((l) => l !== previous);
    if (choices.length === 0) choices = options;
    let text = choices[Math.floor(rng() * choices.length)];
    for (const [k, v] of Object.entries(vars || {})) text = text.split(`{${k}}`).join(v);
    return text;
  }

  const api = { PERSONAS, forDifficulty, line };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BattleshipPersonas = api;
})(typeof window !== 'undefined' ? window : this);
