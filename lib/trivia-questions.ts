export type TriviaOption = {
  id: 'a' | 'b' | 'c' | 'd';
  text: string;
  feedback: string;
};

export type TriviaQuestion = {
  id: number;
  question: string;
  options: TriviaOption[];
};

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    id: 1,
    question: "You matched on Hinge. What's your opener?",
    options: [
      { id: 'a', text: '"Hey, how\'s your week going?"', feedback: "She's already forgotten you." },
      { id: 'b', text: '"You had me at the dog photo."', feedback: 'Specific = winning. She\'s typing.' },
      { id: 'c', text: '"Hey"', feedback: 'Congrats, you\'re officially in her "maybe" pile forever.' },
      { id: 'd', text: '"You\'re gorgeous"', feedback: "She's heard it from 47 guys this week." },
    ],
  },
  {
    id: 2,
    question: 'Texting 3 days in. They left you on read 12 hours ago. You:',
    options: [
      { id: 'a', text: 'Send "?"', feedback: 'You just lost them.' },
      { id: 'b', text: 'Double-text with something funny', feedback: 'Bold. Might land, might tank it.' },
      { id: 'c', text: 'Wait it out', feedback: "Grown-up move. They come back or they don't." },
      { id: 'd', text: 'Unmatch', feedback: 'Petty, but honestly respectable.' },
    ],
  },
  {
    id: 3,
    question: 'Three dates in, they say "I\'m not looking for anything serious — just fun?"',
    options: [
      { id: 'a', text: '"Yeah same, fun works"', feedback: 'Enjoy 2 months of "fun" before the 3am emptiness hits.' },
      { id: 'b', text: '"I am, actually. Good luck out there."', feedback: 'Self-worth intact. Rare.' },
      { id: 'c', text: 'Agree, secretly hope they\'ll change', feedback: "You already know how this ends. Months of wondering why you weren't enough." },
      { id: 'd', text: '"Let\'s keep going and see"', feedback: "Middle ground. Someone's getting hurt." },
    ],
  },
  {
    id: 4,
    question: '2am text from a week-old match: "u up?"',
    options: [
      { id: 'a', text: '"Yeah, come over"', feedback: 'Enjoy the 6am Uber home and the silence after.' },
      { id: 'b', text: 'Ignore until morning', feedback: 'You just saved a week of overthinking.' },
      { id: 'c', text: '"lol what\'s up"', feedback: 'You know what "u up" means. Stop pretending.' },
      { id: 'd', text: '"Not for this"', feedback: 'Boundaries with wit. Elite.' },
    ],
  },
  {
    id: 5,
    question: "First date check arrives. They don't reach for their wallet. You:",
    options: [
      { id: 'a', text: "Pay, don't mention it", feedback: 'Classy. Also: test failed for you.' },
      { id: 'b', text: '"Want to split?"', feedback: 'Honest. Might kill the vibe, might not.' },
      { id: 'c', text: 'Pay now, Venmo request later', feedback: 'Iconic. No second date though.' },
      { id: 'd', text: '"You owe me a second date"', feedback: 'Smooth. Passed the check AND got the check.' },
    ],
  },
  {
    id: 6,
    question: 'You see your date is still active on Tinder after date #4. You:',
    options: [
      { id: 'a', text: 'Confront them', feedback: "Fair, but it's gonna get ugly." },
      { id: 'b', text: 'Stay on the apps yourself', feedback: 'Parallel play. Welcome to your situationship.' },
      { id: 'c', text: "Pretend you didn't see", feedback: "You're just hurting yourself in silence." },
      { id: 'd', text: 'Casually: "are we exclusive or..."', feedback: 'DTR energy. Do this.' },
    ],
  },
  {
    id: 7,
    question: 'They ghosted you a week. Now: "hey stranger 😏". You:',
    options: [
      { id: 'a', text: '"Hey! How\'ve you been?"', feedback: 'You just taught them ghosting is free. Round 2 inbound.' },
      { id: 'b', text: 'Leave on read for a week', feedback: 'Petty justice. Iconic.' },
      { id: 'c', text: '"Sorry, who\'s this?"', feedback: 'Ice cold. Deserved.' },
      { id: 'd', text: 'Block', feedback: 'Clean slate. Next.' },
    ],
  },
  {
    id: 8,
    question: 'First date, they brought their best friend "for safety."',
    options: [
      { id: 'a', text: 'Get annoyed, leave', feedback: 'Failed the vibe check in 10 seconds.' },
      { id: 'b', text: 'Hit on the friend', feedback: 'Lost them, the friend, and your dignity.' },
      { id: 'c', text: 'Bring your friend, make it a group', feedback: 'Why is this a group project?' },
      { id: 'd', text: 'Roll with it, charm both', feedback: "Mature. Don't over-charm the friend though." },
    ],
  },
  {
    id: 9,
    question: 'Match suggests "Netflix at mine" for date #1. You:',
    options: [
      { id: 'a', text: '"Sure, what are we watching?"', feedback: "You know what you signed up for. Don't act surprised after." },
      { id: 'b', text: '"Coffee first, then we\'ll see"', feedback: 'Boundary with grace.' },
      { id: 'c', text: '"Haha nice try, pick a bar"', feedback: 'Playful pushback. Elite.' },
      { id: 'd', text: '"Down"', feedback: 'Enjoy the vibe, and the silence that follows.' },
    ],
  },
  {
    id: 10,
    question: 'They flaked 30 min before the date: "something came up 🥺". You:',
    options: [
      { id: 'a', text: '"No worries, let\'s reschedule!"', feedback: 'You just made flaking free for them.' },
      { id: 'b', text: '"Disappointing. Let me know if you actually want to meet."', feedback: 'Direct, self-respecting.' },
      { id: 'c', text: "Don't reply", feedback: "They'll text again in 3 weeks. Be ready." },
      { id: 'd', text: '"Ok when?"', feedback: 'Too eager. Way too eager.' },
    ],
  },
  {
    id: 11,
    question: 'They posted a thirst trap. You:',
    options: [
      { id: 'a', text: 'Like immediately', feedback: "Instant like at 9pm = you're stalking the page." },
      { id: 'b', text: 'Comment "🔥🔥🔥"', feedback: 'Too public. Their ex is watching.' },
      { id: 'c', text: "Don't like. Wait.", feedback: 'Main character energy.' },
      { id: 'd', text: 'Screenshot, text "who\'s this for??"', feedback: 'One text away from being called "psycho."' },
    ],
  },
  {
    id: 12,
    question: "3 months in, they still haven't called you their partner. You:",
    options: [
      { id: 'a', text: 'Bring it up directly', feedback: 'Scary but necessary.' },
      { id: 'b', text: 'Wait for them', feedback: "Month 6 you'll still be waiting." },
      { id: 'c', text: 'Pull back to "match their energy"', feedback: 'Passive aggression loading.' },
      { id: 'd', text: 'Post a cryptic story about self-love', feedback: "They won't see it. Their ex will." },
    ],
  },
  {
    id: 13,
    question: 'You\'re out. Their ex walks in. They go "say hi for a minute." 20 min pass. You:',
    options: [
      { id: 'a', text: 'Walk over, introduce yourself', feedback: 'Power move. Iconic.' },
      { id: 'b', text: 'Text them "everything ok?"', feedback: 'Reasonable check-in.' },
      { id: 'c', text: 'Leave', feedback: 'Dramatic. Also fair.' },
      { id: 'd', text: 'Order another drink, wait silently', feedback: "You're collecting evidence. For what?" },
    ],
  },
  {
    id: 14,
    question: "It's 1am, 3 drinks in. You want to text your ex. You:",
    options: [
      { id: 'a', text: '"I miss you"', feedback: 'Tomorrow-you is screaming.' },
      { id: 'b', text: 'Send a meme like it\'s nothing', feedback: "It's not a meme they want. It's you. Back. Again." },
      { id: 'c', text: 'Hand your phone to a friend', feedback: 'Real friend. Future-you says thanks.' },
      { id: 'd', text: 'Type, delete, retype, delete...', feedback: 'Still an L. Just slower.' },
    ],
  },
  {
    id: 15,
    question: '3 weeks in, they want you to meet their friends. You:',
    options: [
      { id: 'a', text: 'Yes, this weekend', feedback: 'Fast track. Hope it works.' },
      { id: 'b', text: '"Let\'s wait a bit"', feedback: 'Healthy pacing.' },
      { id: 'c', text: 'Make excuses', feedback: "They'll feel it. They'll leave." },
      { id: 'd', text: '"Sure — why the rush though?"', feedback: 'Fair question. Ask it kindly.' },
    ],
  },
  {
    id: 16,
    question: 'First weekend trip together. Booking — one bed or two?',
    options: [
      { id: 'a', text: 'One, obviously', feedback: 'Confident. Also presumptuous.' },
      { id: 'b', text: 'Two, just in case', feedback: 'Safe. Maybe too safe.' },
      { id: 'c', text: '"Up to you"', feedback: "Pick one. That's the whole job." },
      { id: 'd', text: '"Depends how you behave 😏"', feedback: "Flirty. Works if the chemistry's there." },
    ],
  },
  {
    id: 17,
    question: 'Coworker is flirting hard. You have a partner.',
    options: [
      { id: 'a', text: "Flirt back a little — it's harmless", feedback: '"Harmless" is how every affair starts. You know this.' },
      { id: 'b', text: 'Shut it down clearly', feedback: 'Adult behavior. Do this.' },
      { id: 'c', text: 'Ignore and hope it stops', feedback: "It won't stop. It'll escalate. You already feel it." },
      { id: 'd', text: 'Tell your partner immediately', feedback: 'Transparent. Sometimes too much info at once.' },
    ],
  },
  {
    id: 18,
    question: 'Two months "talking," no exclusivity convo yet. You:',
    options: [
      { id: 'a', text: 'Have the talk this week', feedback: 'Uncomfortable but necessary.' },
      { id: 'b', text: "Assume you're exclusive", feedback: 'Dangerous assumption.' },
      { id: 'c', text: 'Keep your options open', feedback: 'Fine — as long as you accept the same of them.' },
      { id: 'd', text: 'Wait for them to bring it up', feedback: "You'll wait forever." },
    ],
  },
  {
    id: 19,
    question: 'Date #2: "I\'ve never met anyone like you." You:',
    options: [
      { id: 'a', text: 'Melt', feedback: 'Love-bombing works on you. Noted.' },
      { id: 'b', text: '"Lol, same"', feedback: 'Cool, unbothered. Good.' },
      { id: 'c', text: '"Do you say that to everyone?"', feedback: "Playful call-out. They'll laugh or bolt." },
      { id: 'd', text: 'Smile, log it as a yellow flag', feedback: 'Smart. Watch the pattern over the next 3 weeks.' },
    ],
  },
  {
    id: 20,
    question: 'Long-time FWB texts: "I think I\'m catching feelings for you." You:',
    options: [
      { id: 'a', text: '"I do too" (you don\'t, really)', feedback: "Trapped. Situationship with an expiration date you both pretend isn't there." },
      { id: 'b', text: '"Let\'s talk about it in person"', feedback: 'Adult. Do it sober.' },
      { id: 'c', text: '"I don\'t. I\'m sorry."', feedback: 'Kind, clean, honest.' },
      { id: 'd', text: 'Ignore, hope it goes away', feedback: "They'll text again. Worse. Drunker." },
    ],
  },
];
