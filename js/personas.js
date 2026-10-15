/* AI opponent personalities, one per difficulty. {ship} is replaced by a ship name. */
(function (root) {
  'use strict';

  const PERSONAS = {
    easy: {
      name: 'Ensign Pip',
      avatar: '🐣',
      mood: 'nervous rookie',
      lines: {
        start: ['Oh! Is it starting already? Okay. Okay okay okay.', 'Hi! I just finished training. Please go easy on me!', 'I read the manual twice. I think.'],
        aiMiss: ['Oops. That was just water.', 'Was that close? It felt close.', 'I meant to do that. Mostly.', 'Splash… sorry, ocean.'],
        aiHit: ['Wait, I HIT something?!', 'Oh wow, sorry! Was that your boat?', 'Beginner\'s luck, I promise!'],
        aiSunk: ['I sank your {ship}?! I am SO sorry!', 'Mom is going to be so proud. Sorry about your {ship}.'],
        playerMiss: ['Phew!', 'Ha… I mean, good try!', 'You missed! Is that allowed to make me happy?'],
        playerHit: ['Eek! Right in the hull!', 'Ow ow ow!', 'Hey, that one hurt!'],
        playerSunk: ['My {ship}! The instructor is going to kill me.', 'Not the {ship}! I just painted it!'],
        playerMoved: ['Wait, where did it go? Is that legal?', 'You can MOVE them?!'],
        aiWin: ['I… won? I WON! Can I keep the medal?'],
        aiLose: ['Good game! You were amazing. I\'ll practise more.'],
      },
    },
    normal: {
      name: 'Captain Brine',
      avatar: '🧔',
      mood: 'sporting sea captain',
      lines: {
        start: ['Fair winds, friend. May the best captain win!', 'Battle stations! Let\'s have a proper scrap.', 'Ready the guns, lads, we\'ve got company.'],
        aiMiss: ['Bah, the swell threw my aim.', 'Lucky you, that was a near thing.', 'Adjusting the range…', 'Just warming up the cannons.'],
        aiHit: ['Ha! Right in the hull!', 'A palpable hit, old sport!', 'Got you, I did!'],
        aiSunk: ['Down goes your {ship}! Better luck with the rest.', 'Your {ship} sleeps with the fishes now.'],
        playerMiss: ['Lucky shot… for me!', 'Not even close, matey!', 'The fish thank you for the warning shot.'],
        playerHit: ['Ooh, good shot!', 'Blast! Damage control!', 'Hah, you\'ve found one. Well done.'],
        playerSunk: ['You sank my {ship}! A fine shot, I\'ll give you that.', 'There goes the {ship}. A good captain never panics… mostly.'],
        playerMoved: ['A crafty manoeuvre! I respect that.', 'Hiding from my guns, eh?'],
        aiWin: ['Victory is mine! Good fight though, captain.'],
        aiLose: ['Well fought! You\'ve out-sailed me today.'],
      },
    },
    hard: {
      name: 'Admiral Vex',
      avatar: '🦈',
      mood: 'cold, smug strategist',
      lines: {
        start: ['I have calculated 4,812 ways to defeat you. Begin.', 'Your fleet is already sunk. You just don\'t know it yet.', 'Let us get this over with.'],
        aiMiss: ['A calculated miss. It narrows the possibilities.', 'Eliminating sector. Probability recalculated.', 'Every miss tells me where you are not.'],
        aiHit: ['Predictable.', 'Exactly where the numbers said you\'d be.', 'Target acquired.'],
        aiSunk: ['Your {ship} is gone. As foreseen.', '{ship} eliminated. How many left? Not many.'],
        playerMiss: ['Random guessing. How quaint.', 'Is that your strategy?', 'Pathetic.'],
        playerHit: ['A statistical fluke.', 'Irrelevant.', 'You found one. Do not get comfortable.'],
        playerSunk: ['My {ship}… an acceptable loss.', 'You will regret the {ship}.'],
        playerMoved: ['Moving pieces will not save you.', 'A desperate move. Noted.'],
        aiWin: ['Checkmate. Or whatever you call it in this primitive game.'],
        aiLose: ['Impossible. I demand a rematch.'],
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
